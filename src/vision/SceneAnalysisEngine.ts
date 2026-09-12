import type { Detection, SceneMoodState } from '../types';
import { SCENE } from '../config/sceneConfig';
import { RHYTHM } from '../config/rhythmConfig';
import { clamp } from '../gestures/smoothing';
import { featuresToMood, type SceneFeatures } from './sceneMood';
export function imageFeatures(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  previous?: Float32Array,
): SceneFeatures & { luminance: Float32Array } {
  const n = width * height,
    luminance = new Float32Array(n);
  let sum = 0,
    sum2 = 0,
    saturation = 0,
    edge = 0,
    motion = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255,
      g = data[i * 4 + 1] / 255,
      b = data[i * 4 + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = l;
    sum += l;
    sum2 += l * l;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    saturation += max ? (max - min) / max : 0;
  }
  const mean = sum / n,
    oldMean = (previous?.reduce((a, b) => a + b, 0) ?? 0) / n;
  for (let i = 0; i < n; i++) {
    if (i % width) edge += Math.abs(luminance[i] - luminance[i - 1]);
    if (i >= width) edge += Math.abs(luminance[i] - luminance[i - width]);
    if (previous?.length === n)
      motion += Math.abs(luminance[i] - mean - (previous[i] - oldMean));
  }
  return {
    brightness: mean,
    contrast: clamp(Math.sqrt(Math.max(0, sum2 / n - mean * mean)) * 3.5),
    saturation: saturation / n,
    edgeDensity: clamp((edge / n) * 4),
    motion: clamp((motion / n) * 5),
    occupancy: 0,
    categoryEnergy: 0,
    luminance,
  };
}
export class SceneAnalysisEngine {
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D | null;
  private previous?: Float32Array;
  private latest?: Float32Array;
  sample(
    video: HTMLVideoElement,
    objects: Detection[],
  ): SceneMoodState | undefined {
    if (video.readyState < 2) return;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = SCENE.width;
      this.canvas.height = SCENE.height;
      this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!this.context) return;
    this.context.drawImage(video, 0, 0, SCENE.width, SCENE.height);
    const f = imageFeatures(
      this.context.getImageData(0, 0, SCENE.width, SCENE.height).data,
      SCENE.width,
      SCENE.height,
      this.previous,
    );
    this.previous = f.luminance;
    this.latest = f.luminance;
    f.occupancy = clamp(
      objects.reduce((sum, o) => sum + o.bbox.width * o.bbox.height, 0),
    );
    f.categoryEnergy = objects.length
      ? objects.reduce(
          (sum, o) => sum + (RHYTHM.categoryActivity[o.label] ?? 0.35),
          0,
        ) / objects.length
      : 0;
    return featuresToMood(f);
  }
  edgeDensity(box: Detection['bbox'], mirror: boolean): number | undefined {
    if (!this.latest) return;
    const x = mirror ? 1 - box.x - box.width : box.x,
      w = SCENE.width,
      h = SCENE.height;
    const x0 = Math.floor(clamp(x) * w),
      x1 = Math.min(w - 1, Math.ceil(clamp(x + box.width) * w));
    const y0 = Math.floor(clamp(box.y) * h),
      y1 = Math.min(h - 1, Math.ceil(clamp(box.y + box.height) * h));
    let sum = 0,
      count = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        sum +=
          Math.abs(this.latest[i] - this.latest[i + 1]) +
          Math.abs(this.latest[i] - this.latest[i + w]);
        count++;
      }
    return count ? clamp((sum / count) * 4) : 0;
  }
  reset() {
    this.previous = undefined;
    this.latest = undefined;
  }
}
