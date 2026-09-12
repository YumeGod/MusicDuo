import type {
  GameMode,
  HandControlState,
  HarmonyState,
  RoleOverride,
  SoundObject,
} from '../types';
import type { MusicEngine } from '../audio/MusicEngine';
import type { HandTrackingEngine } from '../vision/HandTrackingEngine';
import type { ObjectRecognitionEngine } from '../vision/ObjectRecognitionEngine';
import { CameraManager } from '../vision/CameraManager';
import { ObjectTracker } from '../vision/ObjectTracker';
import { GestureInterpreter } from '../gestures/GestureInterpreter';
import { ObjectSelectionManager } from '../interaction/ObjectSelectionManager';
import { GameModeManager } from '../interaction/GameModeManager';
import { GlobalMusicController } from '../audio/GlobalMusicController';
import { MultiplayerSyncManager } from '../multiplayer/MultiplayerSyncManager';
import { VISION } from '../config/gestureConfig';
import { ChordProgressionEngine } from '../audio/ChordProgressionEngine';
export interface Snapshot {
  running: boolean;
  loading: boolean;
  practice: boolean;
  camera: string;
  status: string;
  objects: SoundObject[];
  hands: HandControlState[];
  harmony: HarmonyState;
  selectedId?: string;
  interaction: string;
  notice: string;
  volume: number;
  reverb: number;
  fps: number;
  network: string;
  objectHand?: HandControlState;
}
export class PerformanceController {
  music?: MusicEngine;
  camera = new CameraManager();
  tracker = new ObjectTracker();
  selection = new ObjectSelectionManager();
  global = new GlobalMusicController();
  network = new MultiplayerSyncManager();
  mode: GameMode = 'DESKTOP_DUO';
  override: RoleOverride = 'AUTO';
  mirror = true;
  practice = false;
  running = false;
  loading = false;
  status = 'Your surroundings. Your sound.';
  cameraStatus = 'Camera off';
  networkStatus = 'Solo session';
  hands: HandControlState[] = [];
  harmony = new ChordProgressionEngine().state();
  private handEngine?: HandTrackingEngine;
  private objectEngine?: ObjectRecognitionEngine;
  private interpreter = new GestureInterpreter();
  private frame = 0;
  private generation = 0;
  private lastVideo = -1;
  private lastHand = 0;
  private lastObject = 0;
  private lastUI = 0;
  private fps = 0;
  private remote?: {
    hand: HandControlState;
    role: 'GLOBAL_CONTROLLER' | 'OBJECT_CONTROLLER';
    time: number;
  };
  constructor(
    private video: HTMLVideoElement,
    private publish: (s: Snapshot) => void,
  ) {}
  objects() {
    return this.tracker.stable();
  }
  emit() {
    this.publish({
      running: this.running,
      loading: this.loading,
      practice: this.practice,
      camera: this.cameraStatus,
      status: this.status,
      objects: this.objects().map((o) => ({ ...o, bbox: { ...o.bbox } })),
      hands: this.hands,
      harmony: this.harmony,
      selectedId: this.selection.selectedId,
      interaction: this.selection.machine.state,
      notice:
        performance.now() - this.selection.noticeAt < 1800
          ? this.selection.notice
          : '',
      volume: this.global.volume,
      reverb: this.global.reverb,
      fps: this.fps,
      network: this.networkStatus,
      objectHand:
        this.hands.find(
          (h) =>
            GameModeManager.role(h, this.mode, this.override) ===
            'OBJECT_CONTROLLER',
        ) ??
        (this.remote?.role === 'OBJECT_CONTROLLER'
          ? this.remote.hand
          : undefined),
    });
  }
  async start(practice = false) {
    if (this.running || this.loading) return;
    const generation = ++this.generation;
    this.loading = true;
    this.practice = practice;
    this.status = 'Preparing your instrument…';
    this.emit();
    try {
      const { MusicEngine } = await import('../audio/MusicEngine');
      if (generation !== this.generation) return;
      const music = new MusicEngine();
      this.music = music;
      music.harmony.key = this.harmony.key;
      music.harmony.bpm = this.harmony.bpm;
      await music.start((h) => {
        this.harmony = h;
      });
      if (generation !== this.generation) {
        music.dispose();
        return;
      }
      this.running = true;
      this.music.controls(this.global.volume, this.global.reverb);
      if (practice) this.seedPractice();
      else {
        this.cameraStatus = 'Requesting camera…';
        this.emit();
        try {
          await this.camera.start(
            this.video,
            GameModeManager.facing(this.mode),
          );
          if (generation !== this.generation) {
            this.camera.stop();
            return;
          }
        } catch (e) {
          if (generation !== this.generation) return;
          this.cameraStatus = 'Camera unavailable';
          this.status =
            e instanceof Error && e.name === 'NotAllowedError'
              ? 'Camera permission was denied. Try practice mode or allow camera access and retry.'
              : 'Could not open the camera. Try practice mode or check camera access.';
          this.loading = false;
          this.tick(performance.now());
          this.emit();
          return;
        }
        this.cameraStatus = 'Camera live · loading vision';
        this.status = 'Loading hand and object recognition…';
        this.emit();
        const [{ HandTrackingEngine }, { ObjectRecognitionEngine }] =
          await Promise.all([
            import('../vision/HandTrackingEngine'),
            import('../vision/ObjectRecognitionEngine'),
          ]);
        if (generation !== this.generation) return;
        const hands = new HandTrackingEngine(),
          objects = new ObjectRecognitionEngine();
        const results = await Promise.allSettled([
          hands.load(),
          objects.load(),
        ]);
        if (generation !== this.generation) {
          hands.dispose();
          objects.dispose();
          return;
        }
        if (results[0].status === 'fulfilled') this.handEngine = hands;
        else hands.dispose();
        if (results[1].status === 'fulfilled') this.objectEngine = objects;
        else objects.dispose();
        this.cameraStatus = 'Camera live';
        this.status = results.every((r) => r.status === 'fulfilled')
          ? 'Show an object. Pinch to make it yours.'
          : `Vision partially unavailable (${results[0].status === 'rejected' ? 'hands ' : ''}${results[1].status === 'rejected' ? 'objects' : ''}). Check your connection or use practice mode.`;
      }
      this.loading = false;
      this.tick(performance.now());
      this.emit();
    } catch (e) {
      if (generation !== this.generation) return;
      this.music?.dispose();
      this.camera.stop();
      this.running = false;
      this.loading = false;
      this.status =
        e instanceof Error ? e.message : 'Could not start audio. Please retry.';
      this.emit();
    }
  }
  seedPractice() {
    this.tracker.reset();
    const now = performance.now();
    this.tracker.objects = [
      { label: 'bottle', bbox: { x: 0.13, y: 0.3, width: 0.16, height: 0.37 } },
      { label: 'book', bbox: { x: 0.63, y: 0.52, width: 0.22, height: 0.18 } },
      {
        label: 'potted plant',
        bbox: { x: 0.4, y: 0.2, width: 0.19, height: 0.25 },
      },
    ].map((d) => ({
      ...this.tracker.create({ ...d, confidence: 1 }, now),
      observations: 3,
    }));
    this.cameraStatus = 'Practice · no camera';
    this.status =
      'Click an object to link it. Move vertically to play. Use the controls to shape its sound.';
  }
  private tick = (now: number) => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);
    if (
      !this.practice &&
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastVideo &&
      now - this.lastHand >= VISION.handIntervalMs
    ) {
      this.fps = Math.round(1000 / (now - this.lastHand));
      this.lastHand = now;
      this.lastVideo = this.video.currentTime;
      try {
        const result = this.handEngine?.detect(this.video, now);
        this.hands = [];
        for (let i = 0; i < (result?.landmarks.length ?? 0); i++) {
          const category = result!.handedness[i][0];
          const points = result!.landmarks[i].map((p) => ({
            ...p,
            x: this.mirror ? 1 - p.x : p.x,
          }));
          // MediaPipe handedness assumes mirrored input; inference uses the unmirrored video.
          const handedness =
            category.categoryName === 'Left' ? 'right' : 'left';
          const hand = this.interpreter.interpret(
            points,
            handedness,
            category.score,
            now,
          );
          if (hand) this.hands.push(hand);
        }
        if (now - this.lastObject > VISION.detectIntervalMs) {
          this.lastObject = now;
          if (this.objectEngine)
            this.tracker.update(
              this.objectEngine.detect(this.video, now, this.mirror),
              now,
            );
        }
      } catch {
        this.status =
          'Vision paused after a tracking error. Stop and restart, or try practice mode.';
        this.handEngine?.dispose();
        this.objectEngine?.dispose();
        this.handEngine = undefined;
        this.objectEngine = undefined;
        this.hands = [];
      }
    }
    if (!this.practice && now - this.lastHand > 600) this.hands = [];
    if (!this.practice) {
      const controls = new Map<string, HandControlState>();
      for (const hand of this.hands) {
        const role = GameModeManager.role(hand, this.mode, this.override);
        if (!controls.has(role)) controls.set(role, hand);
      }
      for (const [role, hand] of controls)
        this.network.send({
          role: role as 'GLOBAL_CONTROLLER' | 'OBJECT_CONTROLLER',
          controls: {
            x: hand.x,
            y: hand.y,
            cursorY: hand.cursorY,
            pinchDistance: hand.pinchDistance,
            handExpansion: hand.handExpansion,
            handAngle: hand.handAngle,
            isSelecting: hand.isSelecting,
          },
        });
      if (this.remote && now - this.remote.time < 800)
        controls.set(this.remote.role, this.remote.hand);
      const global = controls.get('GLOBAL_CONTROLLER');
      if (global) {
        const key = this.global.update(global, now);
        if (key) this.music?.harmony.requestKey(key);
      }
      this.selection.update(
        controls.get('OBJECT_CONTROLLER'),
        this.objects(),
        now,
      );
    } else if (this.remote && now - this.remote.time < 800) {
      if (this.remote.role === 'GLOBAL_CONTROLLER')
        this.global.update(this.remote.hand, now);
      else this.selection.update(this.remote.hand, this.objects(), now);
    }
    if (now - this.lastUI > 80) {
      this.lastUI = now;
      this.music?.sync(this.objects());
      this.music?.controls(this.global.volume, this.global.reverb);
      this.emit();
    }
  };
  select(id: string) {
    const o = this.objects().find((o) => o.id === id);
    if (o) {
      this.selection.select(o, this.objects(), performance.now());
      this.emit();
    }
  }
  detach() {
    this.selection.detach(this.objects(), performance.now());
    this.emit();
  }
  pointer(x: number, y: number) {
    if (!this.practice) return;
    const o = this.objects().find((o) => o.id === this.selection.selectedId);
    if (o) o.pitchY = 1 - y;
    this.hands = [
      {
        handedness: 'left',
        x,
        y: 1 - y,
        cursorY: y,
        pinchDistance: 0.65,
        handAngle: 0,
        handExpansion: o?.mode === 'FREE_LONG_NOTE' ? 1 : 0.5,
        isSelecting: false,
        confidence: 1,
        landmarks: [],
      },
    ];
    if (this.override === 'OBJECT_CONTROLLER')
      this.network.send({
        role: 'OBJECT_CONTROLLER',
        controls: {
          x,
          y: 1 - y,
          cursorY: y,
          pinchDistance: 0.65,
          handExpansion: o?.mode === 'FREE_LONG_NOTE' ? 1 : 0.5,
          isSelecting: false,
        },
      });
  }
  patch(id: string, patch: Partial<SoundObject>) {
    const o = this.objects().find((o) => o.id === id);
    if (o) Object.assign(o, patch);
    this.emit();
  }
  controls(volume: number, reverb: number) {
    this.global.volume = volume;
    this.global.reverb = reverb;
    if (this.override === 'GLOBAL_CONTROLLER')
      this.network.send({
        role: 'GLOBAL_CONTROLLER',
        controls: { pinchDistance: volume * 1.2, handExpansion: reverb },
      });
    this.music?.controls(volume, reverb);
    this.emit();
  }
  key(key: string) {
    if (this.running) {
      this.music?.harmony.requestKey(key);
      this.status = `${key} major queued for the next bar.`;
    } else {
      this.harmony = { ...this.harmony, key };
    }
    this.emit();
  }
  bpm(bpm: number) {
    this.music?.bpm(bpm);
    this.harmony = { ...this.harmony, bpm };
    this.emit();
  }
  regenerate() {
    this.music?.harmony.requestRegenerate();
    this.status = 'New progression queued for the next four-bar phrase.';
    this.emit();
  }
  connect(room: string) {
    this.network.connect(
      room,
      (m) => {
        this.networkStatus = 'Partner connected · local room';
        this.remote = {
          role: m.role,
          time: performance.now(),
          hand: {
            handedness: m.role === 'GLOBAL_CONTROLLER' ? 'right' : 'left',
            x: 0.5,
            y: 0.5,
            cursorY: 0.5,
            pinchDistance: 0.6,
            handExpansion: 0.4,
            handAngle: 0,
            isSelecting: false,
            confidence: 1,
            landmarks: [],
            ...m.controls,
          },
        };
      },
      undefined,
      (s) => {
        this.networkStatus = s;
        this.emit();
      },
    );
  }
  disconnect() {
    this.network.disconnect();
    this.remote = undefined;
    this.networkStatus = 'Solo session';
    this.emit();
  }
  stop() {
    ++this.generation;
    cancelAnimationFrame(this.frame);
    this.running = false;
    this.loading = false;
    this.music?.dispose();
    this.music = undefined;
    this.camera.stop();
    this.handEngine?.dispose();
    this.objectEngine?.dispose();
    this.handEngine = undefined;
    this.objectEngine = undefined;
    this.video.srcObject = null;
    this.tracker.reset();
    this.hands = [];
    this.selection.detach([], performance.now());
    this.lastVideo = -1;
    this.cameraStatus = 'Camera off';
    this.status = 'Ready when you are.';
    this.emit();
  }
  dispose() {
    this.stop();
    this.network.disconnect();
  }
}
