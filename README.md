# MusicDuo

A browser musical instrument: recognized objects become voices, shared harmony gives them a musical home, and your hands shape the performance.

## Run

```sh
npm install
npm run dev
```

Open the printed localhost URL. `npm run build` produces a static site in `dist/client`; the basic experience requires no server. The scaffold uses React 19, TypeScript, and Vinext on Vite 8 with static export. Browser audio and vision are loaded only after starting; no server runtime is required by the exported app.

## Play

- Click **Start Experience**, permit the camera, and wait for vision models to load. No microphone is requested.
- Hold a bottle, book, plant, chair, or another recognizable object still for two observations. EfficientDet recognizes COCO classes; arbitrary custom objects need a replacement model.
- Left hand: pinch over a box for 180 ms to link. Spread thumb/index to control that object's volume. Open the whole hand for longer notes; open fully for a sustained free-pitch note. Move vertically through C2–C6. Close the hand to return to harmony.
- Detach by opening the pinch away from the object for 650 ms. Tracking loss detaches after 1.2 seconds. Click/tap a box or object row as an accessible alternative; use its detach button when needed.
- Right hand: thumb/index distance controls master dynamics; openness controls reverb. Optional rotation changes keys after a dwell, on the next bar.
- **Try without a camera** creates explicitly labeled practice objects. Click to link, move the pointer vertically, and use object sliders / Free pitch. Practice does not pretend to detect real objects.
- In **Mobile shared**, the back camera is requested, every hand controls objects, and the master panel provides touch controls. Stop before changing camera mode or mirroring.
- Use **Swap left and right** or Player A / B overrides if handedness is interpreted incorrectly. Skeletons are optional.

Model files and WASM are downloaded from Google Storage / jsDelivr on first use. Camera images remain in this browser. HTTPS or localhost is required for camera access. Model download/network errors are surfaced; practice works without vision downloads (after the app and audio bundle load).

## Architecture

`PerformanceController` orchestrates independent modules; the vision and gesture layers never import Tone.js.

| Module                               | Responsibility                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| CameraManager                        | Camera acquisition, facing mode, stream teardown             |
| ObjectRecognitionEngine              | MediaPipe EfficientDet inference, normalized boxes           |
| ObjectTracker                        | Label/proximity matching, observation stability, expiry      |
| HandTrackingEngine                   | MediaPipe Hand Landmarker, up to four hands                  |
| GestureInterpreter / handGeometry    | Palm-relative geometry, confidence gating, EMA               |
| GestureStateMachine                  | Explicit allowed transitions                                 |
| ObjectSelectionManager               | Hover, pinch dwell, link, release, mode hysteresis           |
| ChordProgressionEngine               | Diatonic triads, phrase regeneration, queued keys            |
| MusicEngine                          | Tone transport, shared routing, metering and lifecycle       |
| SoundObjectVoice / InstrumentManager | Persistent voices, per-object gain, glide                    |
| GlobalMusicController                | Master controls, experimental key-angle dwell                |
| GameModeManager                      | Desktop / mobile camera and role behavior                    |
| MultiplayerSyncManager               | Local BroadcastChannel room and optional WebSocket transport |
| UI / DebugPanel                      | Camera overlay, tether, settings, harmony, diagnostics       |

Audio routing: persistent object voices → per-object gain → music bus → dry master + reverb send → master gain → limiter → destination. All rhythmic notes and bar changes use Tone Transport. Vision runs independently at a maximum of 20 hand updates/second and approximately 2 object updates/second; UI/audio parameter updates run at approximately 12 Hz with audio ramps. Free notes attack once on entering free mode and ramp frequency while moving, then release on exit.

The palette includes warm sine, triangle pluck, sub bass, FM bell, membrane drum, pink noise, and a repeating arpeggio. Free pitch uses a sustained oscillator companion voice for each timbre, including percussive voices. No external samples are required. The chord loop defaults to I–V–vi–IV in C major, 92 BPM. New progressions take effect at the next four-bar boundary; key changes at the next bar.

## Configuration

- `src/config/objectSoundMap.ts`: object → instrument mapping, palette labels/colors, fallback.
- `src/config/gestureConfig.ts`: palm-normalized thresholds, smoothing, confidence, selection/release dwell, expiry, camera size, inference cadence.
- `src/config/musicConfig.ts`: tempo limits/default, pitch range, glide, output/reverb gain, experimental key feature default.

Pinch thresholds are ratios to wrist–middle-MCP palm length (0.24 select, 0.58 release), not raw image distances. Vertical pitch uses palm-center Y, while the selection cursor is the thumb/index midpoint. Mirroring is applied consistently to landmarks and object boxes. Hand identity across crossing performers is heuristic: the first hand for each assigned role wins.

## Multiplayer MVP

**Play together** joins a same-browser, same-origin local room via BroadcastChannel. Open another tab, enter the same room, assign Player A global and Player B object, then start each experience. High-level controls are transmitted at at most 20 messages/second per role. No images or landmark arrays are sent. Sliders transmit master controls when Player A is explicitly selected. Incoming messages are validated, stale/replayed controls are ignored, and remote object controls time out.

The local room is a control-sync mock, not sample-accurate two-device playback. Object IDs belong to each camera; remote object selection uses normalized cursor coordinates against the receiving scene. Separate clients currently have independent harmony clocks. Use one audible tab while testing.

To attach a small relay later:

```ts
manager.connect(sessionId, onMessage, 'wss://your-relay.example', onStatus);
```

The WebSocket endpoint receives and relays this JSON to other authenticated members of `sessionId`:

```ts
interface NetworkControlMessage {
  version: 1;
  sessionId: string;
  playerId: string;
  role: 'GLOBAL_CONTROLLER' | 'OBJECT_CONTROLLER';
  timestamp: number; // epoch milliseconds
  controls: {
    x?: number;
    y?: number;
    cursorY?: number;
    pinchDistance?: number;
    handExpansion?: number;
    handAngle?: number;
    isSelecting?: boolean;
  };
}
```

Production multiplayer should add server-validated room membership, rate limits, heartbeat/presence, authoritative object IDs and harmony seed/key/BPM, future transport-start epoch, and clock-offset estimation. A relay server is not bundled; the local-room mock and WebSocket adapter satisfy the MVP scope.

## Validation and limits

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Lint is scoped to application code and tests; the generated, unused UI catalog is retained as scaffold code.

Unit tests cover persistent tracking, same-class matching, noisy selection, free/release hysteresis, hand loss, bar/phrase boundaries, logarithmic pitch, key dwell, role override, smoothing, and message validation. Real camera performance and audible gesture latency still require hands-on device testing; automated checks do not establish recognition quality or subjective audio quality.

Inference uses throttled main-thread MediaPipe CPU calls for compatibility. Low-end phones may drop frames; a worker-based inference adapter is the next performance improvement. No recording, camera upload, person identity tracking, or production room server is included.

API references: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [MediaPipe Object Detector](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector/web_js), [Tone Transport](https://github.com/Tonejs/Tone.js/wiki/Transport), [Tone instruments](https://github.com/Tonejs/Tone.js/wiki/Instruments).
