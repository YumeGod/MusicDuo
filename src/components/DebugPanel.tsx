import type { Snapshot } from '../app/PerformanceController';
export function DebugPanel({ s }: { s: Snapshot }) {
  return (
    <details className="debug">
      <summary>
        Tracking diagnostics <span className="mono">{s.fps} FPS</span>
      </summary>
      <dl>
        {Object.entries({
          FPS: s.fps,
          'Detected objects': s.objects.length,
          'Left hand': s.hands.some((h) => h.handedness === 'left')
            ? 'Yes'
            : 'No',
          'Right hand': s.hands.some((h) => h.handedness === 'right')
            ? 'Yes'
            : 'No',
          Pinch: s.hands[0]?.pinchDistance.toFixed(2) ?? '—',
          Expansion: s.hands[0]?.handExpansion.toFixed(2) ?? '—',
          Angle: s.hands[0]?.handAngle.toFixed(1) ?? '—',
          'Selected object': s.selectedId ?? 'None',
          'Object mode':
            s.objects.find((o) => o.id === s.selectedId)?.mode ?? '—',
          Interaction: s.interaction,
          'Current chord': s.harmony.chordName,
          'Current key': s.harmony.key,
          'Scale / mode': s.harmony.mode,
          'Scene valence': s.sceneMood.valence.toFixed(2),
          'Scene energy': s.sceneMood.energy.toFixed(2),
          'Scene tension': s.sceneMood.tension.toFixed(2),
          'Scene brightness': s.sceneMood.brightness.toFixed(2),
          'Scene complexity': s.sceneMood.complexity.toFixed(2),
          'Scene confidence': s.sceneMood.confidence.toFixed(2),
          'Scene lock': s.sceneLocked ? 'Manual' : 'Automatic stability',
          'World authority': s.sceneAuthority ? 'This device' : 'Room leader',
          'Raw expansion': s.hands[0]?.rawExpansion?.toFixed(2) ?? '—',
          Calibration: s.calibration.calibrated.join(', ') || 'Default bounds',
          'Master volume': s.volume.toFixed(2),
          Reverb: s.reverb.toFixed(2),
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
