import type { Detection, SoundObject } from '../types';
import { VISION } from '../config/gestureConfig';
import { ObjectRhythmStabilizer } from './ObjectRhythm';
import { clamp } from '../gestures/smoothing';
import { instrumentFor } from '../config/objectSoundMap';
export class ObjectTracker {
  objects: SoundObject[] = [];
  private counter = 0;
  private rhythms = new Map<string, ObjectRhythmStabilizer>();
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
        const elapsed = Math.max(0.1, (now - object.lastSeen) / 1000);
        const motion = clamp(
          (Math.hypot(d.bbox.x - object.bbox.x, d.bbox.y - object.bbox.y) /
            elapsed) *
            4,
        );
        object.appearance = {
          size: d.bbox.width * d.bbox.height,
          aspectRatio: d.bbox.width / Math.max(0.01, d.bbox.height),
          complexity: d.edgeDensity ?? 0.3,
          motion,
          confidence: d.confidence,
        };
        if (!this.rhythms.has(object.id))
          this.rhythms.set(object.id, new ObjectRhythmStabilizer());
        object.subdivision = this.rhythms
          .get(object.id)!
          .update(object.appearance, object.label, object.subdivision, now);
        object.bbox = d.bbox;
        object.confidence = d.confidence;
        object.lastSeen = now;
        object.observations++;
      }
    }
    this.objects = this.objects.filter(
      (o) => now - o.lastSeen < VISION.objectTimeoutMs,
    );
    for (const id of this.rhythms.keys())
      if (!this.objects.some((o) => o.id === id)) this.rhythms.delete(id);
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
      subdivision: '4n',
    };
  }
  stable() {
    return this.objects.filter(
      (o) => o.observations >= VISION.stableObservations,
    );
  }
  reset() {
    this.objects = [];
    this.rhythms.clear();
  }
}
