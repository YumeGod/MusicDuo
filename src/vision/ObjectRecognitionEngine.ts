import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';
import type { Detection } from '../types';
import { VISION } from '../config/gestureConfig';
export class ObjectRecognitionEngine {
  private model?: ObjectDetector;
  async load() {
    const files = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
    );
    this.model = await ObjectDetector.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      scoreThreshold: VISION.objectConfidence,
      maxResults: VISION.maxObjects,
    });
  }
  detect(video: HTMLVideoElement, time: number, mirror: boolean): Detection[] {
    return (this.model?.detectForVideo(video, time).detections ?? []).flatMap(
      (d) => {
        const b = d.boundingBox,
          c = d.categories[0];
        if (!b || !c) return [];
        const width = b.width / video.videoWidth;
        return [
          {
            label: c.categoryName,
            confidence: c.score,
            bbox: {
              x: mirror
                ? 1 - b.originX / video.videoWidth - width
                : b.originX / video.videoWidth,
              y: b.originY / video.videoHeight,
              width,
              height: b.height / video.videoHeight,
            },
          },
        ];
      },
    );
  }
  dispose() {
    this.model?.close();
    this.model = undefined;
  }
}
