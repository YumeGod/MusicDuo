import type { Detection, SoundObject } from '../types';
import { VISION } from '../config/gestureConfig';
import { instrumentFor } from '../config/objectSoundMap';
export class ObjectTracker {
  objects: SoundObject[] = [];
  private counter = 0;
  update(detections: Detection[], now: number) {
    const used = new Set<string>();
    for (const d of detections.filter(
      (d) => d.confidence >= VISION.objectConfidence,
    )) {
      const candidates = this.objects
        .filter((o) => o.label === d.label && !used.has(o.id))
        .map((o) => ({
          o,
          distance: Math.hypot(
            o.bbox.x + o.bbox.width / 2 - d.bbox.x - d.bbox.width / 2,
            o.bbox.y + o.bbox.height / 2 - d.bbox.y - d.bbox.height / 2,
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
      let object =
        candidates[0]?.distance < VISION.matchDistance
          ? candidates[0].o
          : undefined;
      if (!object && this.objects.length < VISION.maxObjects) {
        object = this.create(d, now);
        this.objects.push(object);
      }
      if (object) {
        used.add(object.id);
        object.bbox = d.bbox;
        object.confidence = d.confidence;
        object.lastSeen = now;
        object.observations++;
      }
    }
    this.objects = this.objects.filter(
      (o) => now - o.lastSeen < VISION.objectTimeoutMs,
    );
    return this.stable();
  }
  create(d: Detection, now: number): SoundObject {
    const instrumentId = instrumentFor(d.label);
    return {
      ...d,
      id: `object-${++this.counter}`,
      instrumentId,
      soundType: instrumentId === 'pattern' ? 'loop' : 'synth',
      volume: 0.65,
      sustain: 0.35,
      pitchOffset: 0,
      pitchY: 0.5,
      mode: 'CHORD_FOLLOWING',
      lastSeen: now,
      observations: 0,
      muted: false,
    };
  }
  stable() {
    return this.objects.filter(
      (o) => o.observations >= VISION.stableObservations,
    );
  }
  reset() {
    this.objects = [];
  }
}
