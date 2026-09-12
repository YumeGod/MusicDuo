import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
export class HandTrackingEngine {
  private model?: HandLandmarker;
  async load() {
    const files = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
    );
    this.model = await HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 4,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
  }
  detect(video: HTMLVideoElement, time: number) {
    return this.model?.detectForVideo(video, time);
  }
  dispose() {
    this.model?.close();
    this.model = undefined;
  }
}
