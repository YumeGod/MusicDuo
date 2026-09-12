import { manualWorld } from '../audio/manualTonality';
import { guestVoices, type RemoteRole } from '../multiplayer/remoteProtocol';
import type { ScaleId } from '../types';
import type {
  GameMode,
  HandObjectLink,
  HandControlState,
  HarmonyState,
  RoleOverride,
  SoundObject,
  SceneMoodState,
  WorldSyncSnapshot,
} from '../types';
import type { MusicEngine } from '../audio/MusicEngine';
import type { HandTrackingEngine } from '../vision/HandTrackingEngine';
import type { ObjectRecognitionEngine } from '../vision/ObjectRecognitionEngine';
import { CameraManager } from '../vision/CameraManager';
import { ObjectTracker } from '../vision/ObjectTracker';
import { GestureInterpreter } from '../gestures/GestureInterpreter';
import { MultiHandSelectionManager } from '../interaction/MultiHandSelectionManager';
import { HandIdentityTracker } from '../vision/HandIdentityTracker';
import { GameModeManager } from '../interaction/GameModeManager';
import { GlobalMusicController } from '../audio/GlobalMusicController';
import { MultiplayerSyncManager } from '../multiplayer/MultiplayerSyncManager';
import { VISION } from '../config/gestureConfig';
import { SceneAnalysisEngine } from '../vision/SceneAnalysisEngine';
import { SceneMoodStabilizer } from '../vision/sceneMood';
import { SCENE, DEFAULT_MOOD } from '../config/sceneConfig';
import {
  CALIBRATION,
  type CalibrationState,
  type CalibrationSide,
} from '../gestures/ExpansionCalibration';
import { ChordProgressionEngine } from '../audio/ChordProgressionEngine';
export interface Snapshot {
  remoteRole?: RemoteRole;
  partnerStream?: MediaStream;
  remoteStatus: string;
  remoteConnected: boolean;
  guestVoiceCount: number;
  manualTonality: boolean;
  requestedKey?: string;
  requestedScale?: ScaleId;
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
  links: HandObjectLink[];
  sceneMood: SceneMoodState;
  sceneLocked: boolean;
  sceneAuthority: boolean;
  calibration: CalibrationState;
}
export class PerformanceController {
  music?: MusicEngine;
  private guestObjects: SoundObject[] = [];
  private guestSeen = 0;
  private manual?: { key: string; scale: ScaleId };
  private remoteManual = false;
  camera = new CameraManager();
  tracker = new ObjectTracker();
  selections = new MultiHandSelectionManager();
  private identities = new HandIdentityTracker();
  get selection() {
    return this.selections.focused;
  }
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
  scene = new SceneMoodStabilizer();
  private sceneAnalysis = new SceneAnalysisEngine();
  private lastScene = 0;
  private remoteWorld?: WorldSyncSnapshot;
  private lastWorld?: WorldSyncSnapshot;
  private frame = 0;
  private generation = 0;
  private lastVideo = -1;
  private lastHand = 0;
  private lastObject = 0;
  private lastUI = 0;
  private fps = 0;
  private remotes = new Map<
    string,
    {
      hand: HandControlState;
      role: 'GLOBAL_CONTROLLER' | 'OBJECT_CONTROLLER';
      time: number;
    }
  >();
  constructor(
    private video: HTMLVideoElement,
    private publish: (s: Snapshot) => void,
  ) {
    this.network.lan.onChange = () => {
      if (!this.network.lan.peerPresent) this.guestObjects = [];
      this.emit();
    };
    this.network.lan.onPacket = (packet) => {
      if (packet.type === 'objects' && this.network.lan.role === 'host') {
        this.guestSeen = performance.now();
        this.guestObjects = guestVoices(packet.objects, this.guestSeen);
      } else if (packet.type === 'world' && this.network.lan.role === 'guest') {
        this.lastWorld = packet.snapshot;
        this.harmony = new ChordProgressionEngine().follow(packet.snapshot);
        this.global.volume = packet.volume;
        this.global.reverb = packet.reverb;
        this.remoteManual = packet.manual;
      } else if (packet.type === 'global' && this.network.lan.role === 'host') {
        this.global.volume = packet.volume;
        this.global.reverb = packet.reverb;
      }
    };
    this.network.priority = () =>
      this.override === 'GLOBAL_CONTROLLER'
        ? 0
        : this.override === 'OBJECT_CONTROLLER'
          ? 2
          : 1;
    try {
      const saved = localStorage.getItem(CALIBRATION.storageKey);
      if (saved) this.interpreter.calibration.restore(saved);
    } catch {
      /* Storage optional. */
    }
  }
  private allHands() {
    return [...this.hands, ...[...this.remotes.values()].map((r) => r.hand)];
  }
  objects() {
    return this.tracker.stable();
  }
  emit() {
    this.publish({
      remoteRole: this.network.lan.role,
      remoteStatus: this.network.lan.status,
      remoteConnected: this.network.lan.connected,
      partnerStream: this.network.lan.remoteStream,
      guestVoiceCount: this.guestObjects.length,
      manualTonality:
        this.network.lan.role === 'guest'
          ? this.remoteManual
          : Boolean(this.manual),
      requestedKey:
        this.network.lan.role === 'guest' ? undefined : this.manual?.key,
      requestedScale:
        this.network.lan.role === 'guest' ? undefined : this.manual?.scale,
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
        performance.now() - this.selections.noticeAt < 1800
          ? this.selections.notice
          : '',
      volume: this.global.volume,
      reverb: this.global.reverb,
      fps: this.fps,
      network: this.network.lan.role
        ? this.network.lan.status
        : this.networkStatus,
      sceneMood: this.network.isAuthority()
        ? (this.scene.smoothed ?? DEFAULT_MOOD)
        : this.harmony.sceneMood,
      sceneLocked: this.scene.manualLock,
      sceneAuthority: this.network.isAuthority(),
      calibration: { ...this.interpreter.calibration.state },
      links: this.selections.links(this.objects(), this.allHands()),
      objectHand: this.allHands().find(
        (h) =>
          h.handId ===
          this.objects().find((o) => o.id === this.selection.selectedId)
            ?.selectedBy,
      ),
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
      if (this.network.lan.role !== 'guest') {
        const { MusicEngine } = await import('../audio/MusicEngine');
        if (generation !== this.generation) return;
        const music = new MusicEngine();
        this.music = music;
        if (this.lastWorld) music.harmony.follow(this.lastWorld, 0);
        music.harmony.key = this.harmony.key;
        music.harmony.bpm = this.harmony.bpm;
        if (this.manual) {
          music.harmony.key = this.manual.key;
          music.harmony.world = manualWorld(
            music.harmony.world,
            this.manual.key,
            this.manual.scale,
          );
        } else if (this.scene.locked)
          music.harmony.requestWorld(this.scene.locked);
        if (this.remoteWorld && !this.network.isAuthority())
          music.followWorld(this.remoteWorld);
        await music.start(
          (h) => {
            this.harmony = h;
          },
          (snapshot) => {
            this.lastWorld = snapshot;
            this.network.sendWorld(snapshot);
            this.network.lan.send({
              type: 'world',
              snapshot,
              volume: this.global.volume,
              reverb: this.global.reverb,
              manual: Boolean(this.manual),
            });
          },
        );
        if (generation !== this.generation) {
          music.dispose();
          return;
        }
      }
      this.running = true;
      this.music?.controls(this.global.volume, this.global.reverb);
      this.refreshRemoteMedia();
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
        this.refreshRemoteMedia();
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
          ? 'Show an object. Make a fist over it to link.'
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
    this.selections.reset(this.objects(), performance.now());
    this.identities.reset();
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
        const observed = (result?.landmarks ?? []).map((landmarks, i) => ({
          landmarks: landmarks.map((p) => ({
            ...p,
            x: this.mirror ? 1 - p.x : p.x,
          })),
          handedness: (result!.handedness[i][0].categoryName === 'Left'
            ? 'right'
            : 'left') as 'left' | 'right',
          confidence: result!.handedness[i][0].score,
        }));
        for (const tracked of this.identities.update(observed, now)) {
          const hand = this.interpreter.interpret(
            tracked.landmarks,
            tracked.handedness,
            tracked.confidence,
            now,
            tracked.handId,
          );
          if (hand)
            this.hands.push({ ...hand, controlLabel: tracked.controlLabel });
        }
        if (now - this.lastScene >= SCENE.sampleMs) {
          this.lastScene = now;
          const mood = this.sceneAnalysis.sample(this.video, this.objects());
          if (mood && this.network.isAuthority() && !this.manual) {
            const world = this.scene.update(mood, now);
            if (world) {
              this.music?.harmony.requestWorld(world);
              this.status = `Scene interpreted · ${world.key} ${world.scale.replaceAll('_', ' ')} queued for the next phrase.`;
            }
          }
        }
        if (now - this.lastObject > VISION.detectIntervalMs) {
          this.lastObject = now;
          if (this.objectEngine)
            this.tracker.update(
              this.objectEngine
                .detect(this.video, now, this.mirror)
                .map((d) => ({
                  ...d,
                  edgeDensity: this.sceneAnalysis.edgeDensity(
                    d.bbox,
                    this.mirror,
                  ),
                })),
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
    for (const [id, remote] of this.remotes)
      if (now - remote.time >= 800) this.remotes.delete(id);
    if (this.interpreter.calibration.state.step === 'idle') {
      const local = this.practice ? [] : this.hands;
      const eligible = local.filter(
        () =>
          this.mode === 'MOBILE_SHARED' ||
          this.override !== 'GLOBAL_CONTROLLER',
      );
      const remoteObjects = [...this.remotes.values()]
        .filter(
          (r) =>
            r.role === 'OBJECT_CONTROLLER' || this.selections.isLinked(r.hand),
        )
        .map((r) => r.hand);
      this.selections.update(
        [...eligible, ...remoteObjects],
        this.objects(),
        now,
      );
      let global: HandControlState | undefined;
      for (const hand of local) {
        const role =
          this.selections.isLinked(hand) ||
          (eligible.includes(hand) && hand.isSelecting)
            ? 'OBJECT_CONTROLLER'
            : GameModeManager.role(hand, this.mode, this.override);
        if (role === 'GLOBAL_CONTROLLER' && !hand.isSelecting && !global)
          global = hand;
        if (
          this.network.lan.role === 'guest' &&
          role === 'GLOBAL_CONTROLLER' &&
          !hand.isSelecting
        )
          this.network.lan.send({
            type: 'global',
            volume: Math.min(1, hand.pinchDistance / 1.2),
            reverb: hand.handExpansion,
          });
        this.network.send({
          role,
          controls: {
            handId: hand.handId,
            handedness: hand.handedness,
            x: hand.x,
            y: hand.y,
            cursorY: hand.cursorY,
            pinchDistance: hand.pinchDistance,
            handExpansion: hand.handExpansion,
            handAngle: hand.handAngle,
            isSelecting: hand.isSelecting,
          },
        });
      }
      const remoteGlobal = [...this.remotes.values()].find(
        (r) =>
          r.role === 'GLOBAL_CONTROLLER' &&
          !r.hand.isSelecting &&
          !this.selections.isLinked(r.hand),
      );
      global = remoteGlobal?.hand ?? global;
      if (global) {
        const key = this.global.update(global, now);
        if (key && this.network.isAuthority() && !this.manual)
          this.music?.harmony.requestKey(key);
      }
    }
    if (now - this.lastUI > 80) {
      this.lastUI = now;
      if (now - this.guestSeen > 1200) this.guestObjects = [];
      if (this.network.lan.role === 'guest')
        this.network.lan.send({ type: 'objects', objects: this.objects() });
      this.music?.sync([...this.objects(), ...this.guestObjects]);
      this.music?.controls(this.global.volume, this.global.reverb);
      this.emit();
    }
  };
  select(id: string) {
    const o = this.objects().find((o) => o.id === id);
    if (o) {
      this.selections.select(
        o,
        this.objects(),
        this.practice
          ? []
          : this.hands.filter(
              () =>
                this.mode === 'MOBILE_SHARED' ||
                this.override !== 'GLOBAL_CONTROLLER',
            ),
        performance.now(),
      );
      this.emit();
    }
  }
  detach() {
    this.selections.detach(this.objects(), performance.now());
    this.emit();
  }
  pointer(x: number, y: number) {
    if (!this.practice) return;
    const o = this.objects().find((o) => o.id === this.selection.selectedId);
    if (o) o.pitchY = 1 - y;
    this.hands = [
      {
        handedness: 'left',
        handId: 'pointer',
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
    if (this.network.lan.role === 'guest')
      this.network.lan.send({ type: 'global', volume, reverb });
    if (this.override === 'GLOBAL_CONTROLLER')
      this.network.send({
        role: 'GLOBAL_CONTROLLER',
        controls: { pinchDistance: volume * 1.2, handExpansion: reverb },
      });
    this.music?.controls(volume, reverb);
    this.emit();
  }
  private refreshRemoteMedia() {
    this.network.lan.setMedia(
      typeof MediaStream !== 'undefined' &&
        this.video.srcObject instanceof MediaStream
        ? this.video.srcObject
        : undefined,
      this.music?.audioStream,
    );
  }
  connectRemote(role: RemoteRole, room: string) {
    // Change audio ownership before a guest can start a local transport.
    this.stop();
    this.network.disconnect();
    this.remotes.clear();
    this.remoteWorld = undefined;
    this.network.lan.connect(role, room);
    this.emit();
  }
  setTonality(
    enabled: boolean,
    key = this.manual?.key ?? this.harmony.key,
    scale = this.manual?.scale ?? this.harmony.scale,
  ) {
    if (!this.network.isAuthority()) return;
    if (!enabled) {
      this.manual = undefined;
      this.scene.reanalyze();
      this.status = 'Scene-driven harmony restored.';
    } else {
      const base =
        this.music?.harmony.world ?? new ChordProgressionEngine().world;
      const world = manualWorld(base, key, scale);
      this.manual = { key, scale };
      if (this.running) this.music?.harmony.requestWorld(world);
      else {
        const h = new ChordProgressionEngine();
        h.world = world;
        h.key = key;
        h.bpm = this.harmony.bpm;
        this.harmony = h.state();
      }
      this.status = `${key} ${scale.replaceAll('_', ' ')}${this.running ? ' queued for the next phrase.' : ' selected.'}`;
    }
    this.emit();
  }
  key(key: string) {
    if (!this.network.isAuthority()) return;
    if (this.manual) {
      this.setTonality(true, key, this.manual.scale);
      return;
    }
    if (this.running) {
      this.music?.harmony.requestKey(key);
      this.status = `${key} ${this.harmony.mode} queued for the next bar.`;
    } else {
      this.harmony = { ...this.harmony, key };
    }
    this.emit();
  }
  bpm(bpm: number) {
    if (!this.network.isAuthority()) return;
    this.music?.bpm(bpm);
    this.harmony = { ...this.harmony, bpm };
    this.emit();
  }
  regenerate() {
    if (!this.network.isAuthority()) return;
    this.music?.harmony.requestRegenerate();
    this.status = 'New progression queued for the next four-bar phrase.';
    this.emit();
  }
  calibrate(side: CalibrationSide) {
    this.selections.reset(this.objects(), performance.now());
    this.interpreter.calibration.begin(side);
    this.emit();
  }
  captureCalibration() {
    if (this.interpreter.calibration.capture(performance.now())) {
      this.interpreter.resetExpansionFilters();
      try {
        localStorage.setItem(
          CALIBRATION.storageKey,
          this.interpreter.calibration.serialize(),
        );
      } catch {
        /* Storage optional. */
      }
    }
    this.emit();
  }
  cancelCalibration() {
    this.interpreter.calibration.cancel();
    this.emit();
  }
  resetCalibration() {
    this.interpreter.calibration.reset();
    this.interpreter.resetExpansionFilters();
    try {
      localStorage.removeItem(CALIBRATION.storageKey);
    } catch {
      /* Storage optional. */
    }
    this.emit();
  }
  reanalyze() {
    if (!this.network.isAuthority()) return;
    this.scene.reanalyze();
    this.status = this.practice
      ? 'Scene analysis uses a live camera. The current world is kept in practice mode.'
      : 'Reinterpreting the scene. Hold the view steady for a few seconds.';
    this.emit();
  }
  lockScene(lock: boolean) {
    this.scene.manualLock = lock;
    this.emit();
  }
  connect(room: string) {
    if (this.network.lan.role) this.stop();
    this.music?.releaseWorld();
    this.remoteWorld = undefined;
    this.remotes.clear();
    this.network.connect(
      room,
      (m) => {
        this.networkStatus = 'Partner connected · local room';
        const id = `remote:${m.playerId}:${m.controls.handId ?? m.role}`;
        this.remotes.set(id, {
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
            handId: id,
            controlLabel: `Partner ${m.controls.handId ?? m.role}`,
          },
        });
      },
      undefined,
      (s) => {
        this.networkStatus = s;
        this.emit();
      },
      (snapshot) => {
        this.remoteWorld = snapshot;
        this.lastWorld = snapshot;
        this.music?.followWorld(snapshot);
        if (!this.music) {
          const h = new ChordProgressionEngine();
          this.harmony = h.follow(snapshot);
        }
        this.status = 'Following the shared musical world.';
        this.emit();
      },
      (authority) => {
        if (authority) {
          this.music?.releaseWorld();
          this.remoteWorld = undefined;
          this.scene.reset();
          this.status = 'This device now leads scene harmony.';
        } else this.status = 'Following scene harmony from the room leader.';
        this.emit();
      },
    );
  }
  disconnect() {
    if (this.network.lan.role) this.stop();
    this.network.disconnect();
    this.music?.releaseWorld();
    this.remoteWorld = undefined;
    this.scene.reset();
    this.remotes.clear();
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
    this.network.lan.send({ type: 'objects', objects: [] });
    this.network.lan.setMedia();
    this.guestObjects = [];
    this.camera.stop();
    this.handEngine?.dispose();
    this.objectEngine?.dispose();
    this.handEngine = undefined;
    this.objectEngine = undefined;
    this.video.srcObject = null;
    this.selections.reset(this.objects(), performance.now());
    this.identities.reset();
    this.tracker.reset();
    this.hands = [];
    this.remotes.clear();
    this.lastVideo = -1;
    this.lastScene = 0;
    this.sceneAnalysis.reset();
    this.scene.reset();
    this.interpreter.calibration.cancel();
    this.cameraStatus = 'Camera off';
    this.status = 'Ready when you are.';
    this.emit();
  }
  dispose() {
    this.stop();
    this.network.disconnect();
  }
}
