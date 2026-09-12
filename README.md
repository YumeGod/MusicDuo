# MusicDuo

A browser musical instrument: recognized objects become voices, shared harmony gives them a musical home, and your hands shape the performance.

## Quick Start

### 1. Install and run

You need **Node.js 22.13 or newer**, npm, and a modern browser with Web Audio and camera support. Headphones are recommended. The basic experience needs no backend, API key, or environment variables. An internet connection is needed to download the vision models on first use.

```sh
git clone https://github.com/YumeGod/MusicDuo.git
cd MusicDuo
npm ci
npm run dev
```

Open the local URL printed in the terminal (normally `http://localhost:3000`).

### 2. Make your first sound

1. Click **Start Experience** and allow camera access. Wait for the hand and object models to load.
2. Place a bottle, book, or plant in view. Keep it still until its sound label appears.
3. Move your **either palm** over the object, make a fist, and hold briefly to link it. Look for **LINKED** and the hand-to-object tether.
4. Spread your thumb and index finger to adjust that object's volume. Open your hand for longer notes; open fully to play a sustained melody within the current scale.
5. Move your linked hand up or down to change pitch. Open your pinch away from the object for a moment to detach.
6. Use your **right** hand to shape the whole mix: thumb/index spread controls volume, and hand openness controls reverb.

The scene establishes the key and scale gradually. Keep the camera steady for a few seconds; accepted changes take effect at a musical phrase boundary.

**No camera?** Choose **Try without a camera**, click a practice object, and use its controls. Enable **Scale melody · sustained** and move your pointer vertically to play pitch.

**Can't reach full openness?** Open **Your setup → Calibrate hand openness**, capture a relaxed hand, then a comfortably open hand. Calibration is optional and saved on this device.

### 3. Choose a play mode

| Mode              | How to play                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop duo       | Front camera; left hand controls an object and right hand controls the mix. Use role overrides for two performers or swapped handedness.                       |
| Mobile shared     | Back camera; one hand controls objects and the on-screen sliders control global volume and reverb.                                                             |
| Local multiplayer | Open two tabs in the same browser, choose **Play together**, join the same room, and choose the appropriate hand roles. Use one audible tab to avoid doubling. |

Two-device multiplayer requires a WebSocket relay; it is not hosted or bundled. See [Multiplayer MVP](#multiplayer-mvp) for the existing adapter and synchronization protocol.

### Useful commands

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Start the development server.                              |
| `npm test`          | Run the automated tests.                                   |
| `npm run typecheck` | Check TypeScript.                                          |
| `npm run lint`      | Lint application code and tests.                           |
| `npm run build`     | Build the static app into `dist/client`.                   |
| `npm start`         | Preview the production build locally; run the build first. |

The app uses React, TypeScript, Tone.js, MediaPipe, and Vinext on Vite. Deploy `dist/client` to an HTTPS static host; the exported app does not need a server runtime. Camera access requires **HTTPS or localhost**. Opening an ordinary HTTP LAN address on a phone will not enable camera access.

### Troubleshooting

- **No sound:** click Start Experience, check browser/system volume, and make sure an object has appeared. In practice mode, the example objects supply the voices.
- **Camera unavailable:** allow camera permission, close other apps using the camera, and use HTTPS or localhost. Practice mode is available without a camera.
- **Models fail to load:** check your internet connection and access to Google Storage and jsDelivr, then stop and restart the experience.
- **Hands control the wrong role:** use **Your setup → Hand roles** to swap roles or choose global-only or object-only controls. Stop the experience before changing camera mode or mirroring.
- **Scene harmony changes slowly:** this is intentional. Use **Reanalyze scene** for a new stable reading, or **Lock scene** to keep the current world.

## Play

- Click **Start Experience**, permit the camera, and wait for vision models to load. No microphone is requested.
- Hold a bottle, book, plant, chair, or another recognizable object still for two observations. EfficientDet recognizes COCO classes; arbitrary custom objects need a replacement model.
- Either hand: hold a fist with your palm over a box for 180 ms to link. Spread thumb/index to control that object's volume. Open the whole hand for longer notes; open fully for a sustained scale melody. Move vertically through C2–C6: targets settle on the nearest note in the active scale/mode with short portamento. Close the hand to return to harmony.
- Detach by opening the pinch away from the object for 650 ms. Tracking loss detaches after 1.2 seconds. Click/tap a box or object row as an accessible alternative; use its detach button when needed.
- Unlinked right hand (automatic roles): thumb/index distance controls master dynamics; openness controls reverb. Optional rotation changes keys after a dwell, on the next bar.
- **Try without a camera** creates explicitly labeled practice objects. Click to link, move the pointer vertically, and use object sliders / Scale melody. Practice does not pretend to detect real objects.
- In **Mobile shared**, the back camera is requested, every hand controls objects, and the master panel provides touch controls. Stop before changing camera mode or mirroring.
- Use **Swap left and right** or global-only / object-only overrides if handedness is interpreted incorrectly. Skeletons are optional.

Model files and WASM are downloaded from Google Storage / jsDelivr on first use. Camera images remain in this browser. HTTPS or localhost is required for camera access. Model download/network errors are surfaced; practice works without vision downloads (after the app and audio bundle load).

## Scene, rhythm, and comfortable gestures

The live image is sampled locally at 64×48 pixels once per second. Brightness, contrast, saturation, edge density, exposure-compensated image difference, and persistent object occupancy/activity become a normalized `SceneMoodState`. This is a configurable **artistic visual heuristic**, not a semantic/emotion classifier. No new model, network analysis service, or dependency is required.

Mood is smoothed with an EMA. An initial interpretation needs four seconds of consistent evidence. Later changes require a meaningful mood distance, a 15-second context lock, and six seconds of consistent evidence. Missing/low-confidence samples reset the dwell; small exposure or occupancy fluctuations cannot switch the musical world. **Lock scene** holds the world manually. **Reanalyze scene** requests a fresh stable reading. Accepted tonal changes are queued for the next four-bar boundary. Scene mood stays in diagnostics; the performance display shows only key, mode, and chord.

Deterministic scene rules choose Ionian, Natural Minor, Harmonic Minor, Melodic Minor, Dorian, Phrygian, Lydian, Mixolydian, or Aeolian, along with tonic and progression character. Melodic Minor uses the ascending/jazz collection in both directions so the tonal world does not change with hand direction. Natural Minor and Aeolian intentionally share intervals but represent different artistic rule outcomes. All triads are stacked from the active scale, including diminished or augmented chords where appropriate. Regeneration cycles through coherent templates for the current character; no random major/minor decision is made. Tempo remains performer-controlled.

Object area, aspect ratio, crop edge density, bounding-box motion, and category determine quarter, eighth, or sixteenth activity. Per-object smoothing, confidence accumulation, hysteresis, and dwell prevent flicker. Identities update only after stable evidence; audio adopts changes at bar boundaries on the existing Tone Transport (now a sixteenth-note grid). Normal notes prioritize current chord tones. Sustained notes ignore the current chord but **remain in the current scale**, use a small target hysteresis, and glide only when the target changes; hand motion does not retrigger the note.

Open **Your setup → Calibrate hand openness** with the live camera running. Choose a hand, capture a naturally relaxed pose for one second, then capture a comfortable open pose for one second. Calibration is optional, separate for each handedness, validates the observed range, and stores only two bounds per hand in local storage. Reset or recalibrate anytime. The fallback range is 1.05–1.8 palm lengths, with endpoint margins and post-normalization smoothing so 0% and 100% are reachable. During calibration, gesture-to-audio control is temporarily held and any selected object is detached; camera tracking continues. Thumb/index dynamics, role overrides, selection thresholds and hand-loss behavior are unchanged.

## Architecture

`PerformanceController` orchestrates independent modules; the vision and gesture layers never import Tone.js.

| Module                               | Responsibility                                                       |
| ------------------------------------ | -------------------------------------------------------------------- |
| CameraManager                        | Camera acquisition, facing mode, stream teardown                     |
| ObjectRecognitionEngine              | MediaPipe EfficientDet inference, normalized boxes                   |
| ObjectTracker                        | Label/proximity matching, observation stability, expiry              |
| HandTrackingEngine                   | MediaPipe Hand Landmarker, up to four hands                          |
| GestureInterpreter / handGeometry    | Palm-relative geometry, confidence gating, EMA                       |
| GestureStateMachine                  | Explicit allowed transitions                                         |
| ObjectSelectionManager               | Hover, fist dwell, link, release, mode hysteresis                    |
| ChordProgressionEngine               | Scale-derived triads, scene worlds, phrase regeneration, queued keys |
| MusicEngine                          | Tone transport, shared routing, metering and lifecycle               |
| SoundObjectVoice / InstrumentManager | Persistent voices, per-object gain, glide                            |
| GlobalMusicController                | Master controls, experimental key-angle dwell                        |
| GameModeManager                      | Desktop / mobile camera and role behavior                            |
| MultiplayerSyncManager               | Local BroadcastChannel room and optional WebSocket transport         |
| UI / DebugPanel                      | Camera overlay, tether, settings, harmony, diagnostics               |

Audio routing: persistent object voices → per-object gain → music bus → dry master + reverb send → master gain → limiter → destination. All rhythmic notes and bar changes use Tone Transport. Vision runs independently at a maximum of 20 hand updates/second and approximately 2 object updates/second; UI/audio parameter updates run at approximately 12 Hz with audio ramps. Sustained notes attack once and ramp toward quantized scale targets, then release on exit.

The palette includes warm sine, triangle pluck, sub bass, FM bell, membrane drum, pink noise, and a repeating arpeggio. Scale melody uses the existing sustained oscillator companion voice for each timbre, including percussive voices. No external samples are required. Before scene interpretation (and in practice), the chord loop defaults to I–V–vi–IV in C Ionian, 92 BPM. New progressions take effect at the next four-bar boundary; key changes at the next bar.

## Configuration

- `src/config/objectSoundMap.ts`: object → instrument mapping, palette labels/colors, fallback.
- `src/config/gestureConfig.ts`: palm-normalized thresholds, smoothing, confidence, selection/release dwell, expiry, camera size, inference cadence.
- `src/config/sceneConfig.ts`: scene sampling/stability, artistic thresholds, tonic/mode palettes, progression characters.
- `src/config/rhythmConfig.ts`: visual activity weights, category priors, subdivision thresholds and stability.
- `src/gestures/ExpansionCalibration.ts`: calibration sample requirements, fallback bounds, storage key.
- `src/config/musicConfig.ts`: tempo limits/default, pitch range, glide, output/reverb gain, experimental key feature default.

Selection uses a smoothed four-finger closure score (0.72 to enter a fist, 0.45 to exit), followed by a 180 ms hold. A thumb/index pinch alone does not select. People remain recognized sound objects but are excluded from gesture targeting; click/tap their box or row to link explicitly. Both the selection cursor and vertical pitch use the palm center. Pinch distance remains palm-normalized for volume and open-away release (0.58 threshold). Mirroring is applied consistently to landmarks and object boxes. Each hand has its own tracked identity, smoothing, object lock, and tether (R1, R2, L1, L2). Two right hands can select different objects simultaneously. A linked right hand controls its object instead of the master. Tracking uses palm proximity and velocity; complete occlusion or ambiguous crossings can still lose identity.

## Multiplayer MVP

**Play together** joins a same-browser, same-origin local room via BroadcastChannel. Open another tab, enter the same room, choose global-only and object-only roles as needed, then start each experience. High-level controls are transmitted at at most 20 messages/second per hand. No images or landmark arrays are sent. Sliders transmit master controls when global-only controls are explicitly selected. Incoming messages are validated, stale/replayed controls are ignored, and remote object controls time out.

The local room is a control-sync mock, not sample-accurate two-device playback. Object IDs belong to each camera; remote object selection uses normalized cursor coordinates against the receiving scene. Clients now share tonic, scale/mode, progression degrees, BPM, and the accepted scene mood. A room leader is elected deterministically, preferring the explicit global role. Followers suppress their own scene/key/progression decisions. Quarter-beat world snapshots carry a transport epoch, sixteenth tick and scheduled wall time; followers recover bar/beat position, including late joins and leader restarts. Audio devices still have independent sample clocks, so phase alignment is approximate, not sample-accurate. Use one audible tab while testing.

To attach a small relay later:

```ts
manager.connect(
  sessionId,
  onMessage,
  'wss://your-relay.example',
  onStatus,
  onWorld,
  onAuthorityChange,
);
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

The existing relay must forward `kind: "presence"` and `kind: "world"` messages as well as controls. Presence includes role priority and is emitted every second; missing peers expire after five seconds. World messages include `snapshot: { epochId, world: { key, scale, quality, character, mood }, sequence, bpm, tick, effectiveAt }`. World payloads are validated and only the elected leader is accepted. Old control-message shape remains compatible; no pixels, crops, or hand landmark arrays are sent. Reconnecting/leaving a room clears authority and transport-follow state.

Production multiplayer should still add server-validated room membership, rate limits, authoritative shared object IDs, and clock-offset/audio-latency estimation across devices. A relay server is not bundled; the local-room mock and WebSocket adapter satisfy the MVP scope.

## Validation and limits

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Lint is scoped to application code and tests; the generated, unused UI catalog is retained as scaffold code.

Unit tests cover persistent tracking, same-class matching, noisy selection, free/release hysteresis, hand loss, bar/phrase boundaries, logarithmic pitch, key dwell, role override, smoothing, and message validation. Additional tests cover all scene-to-mode rules, all triads in all supported scales, scene lock/dwell, exposure-invariant motion, rhythm stability, quantized pitch and endpoints, calibration capture/persistence, deterministic authority, world payload validation and live BroadcastChannel late-join delivery. Real camera performance and audible gesture latency still require hands-on device testing; automated checks do not establish recognition quality or subjective audio quality.

Inference uses throttled main-thread MediaPipe CPU calls for compatibility. Low-end phones may drop frames; a worker-based inference adapter is the next performance improvement. No recording, camera upload, person identity tracking, or production room server is included.

API references: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [MediaPipe Object Detector](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector/web_js), [Tone Transport](https://github.com/Tonejs/Tone.js/wiki/Transport), [Tone instruments](https://github.com/Tonejs/Tone.js/wiki/Instruments).

### Two people, one camera

Keep Hand roles on Automatic. Each player places a palm over a different object and holds a fist to grab it. Right hands work too. Each LINKED label and tether identifies its controlling hand. Spread thumb/index for individual dynamics, expand for sustain, and move vertically for pitch. Open the pinch away from the object to detach. A held object cannot be stolen by another hand. Global-only role overrides intentionally disable grabbing; mobile and object-only roles allow every hand to control objects.
