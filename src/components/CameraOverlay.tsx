import type { HandControlState, SoundObject } from '../types';
import { INSTRUMENTS } from '../config/objectSoundMap';
const CONNECTIONS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
export function CameraOverlay({
  objects,
  hands,
  selectedId,
  skeleton,
  onSelect,
  practice,
  objectHand,
}: {
  objects: SoundObject[];
  hands: HandControlState[];
  selectedId?: string;
  skeleton: boolean;
  onSelect: (id: string) => void;
  practice: boolean;
  objectHand?: HandControlState;
}) {
  const selected = objects.find((o) => o.id === selectedId),
    hand = objectHand ?? hands.find((h) => h.handedness === 'left') ?? hands[0];
  return (
    <div className="camera-overlay">
      <svg viewBox="0 0 1000 750" preserveAspectRatio="none" aria-hidden="true">
        {skeleton &&
          hands.map((h, i) => (
            <g
              key={i}
              stroke={h.handedness === 'left' ? '#8fe1c4' : '#ff9d75'}
              fill="none"
              strokeWidth="2"
            >
              {CONNECTIONS.map((c, j) => (
                <polyline
                  key={j}
                  points={c
                    .filter((n) => h.landmarks[n])
                    .map(
                      (n) =>
                        `${h.landmarks[n].x * 1000},${h.landmarks[n].y * 750}`,
                    )
                    .join(' ')}
                />
              ))}
              {h.landmarks.map((p, j) => (
                <circle
                  key={j}
                  cx={p.x * 1000}
                  cy={p.y * 750}
                  r="3"
                  fill="currentColor"
                />
              ))}
            </g>
          ))}
        {selected && hand && (
          <g className="tether">
            <line
              x1={hand.x * 1000}
              y1={hand.cursorY * 750}
              x2={(selected.bbox.x + selected.bbox.width / 2) * 1000}
              y2={(selected.bbox.y + selected.bbox.height / 2) * 750}
            />
            <circle cx={hand.x * 1000} cy={hand.cursorY * 750} r="9" />
          </g>
        )}
      </svg>
      {objects.map((o) => (
        <button
          key={o.id}
          onClick={() => onSelect(o.id)}
          className={`object-box ${o.id === selectedId ? 'linked' : ''} ${practice ? 'practice-object' : ''}`}
          style={
            {
              left: `${o.bbox.x * 100}%`,
              top: `${o.bbox.y * 100}%`,
              width: `${o.bbox.width * 100}%`,
              height: `${o.bbox.height * 100}%`,
              '--object-color': INSTRUMENTS[o.instrumentId].color,
            } as React.CSSProperties
          }
          aria-label={`Link ${o.label}`}
        >
          <span className="object-tag">
            {o.label}
            <span>
              {o.id === selectedId
                ? '↗ LINKED'
                : `${Math.round(o.confidence * 100)}%`}
            </span>
          </span>
          {practice && (
            <span className="object-tone">
              {INSTRUMENTS[o.instrumentId].name}
              <span className="mini-wave">∿ ∿ ∿</span>
            </span>
          )}
          <span className="object-instrument">
            {o.id === selectedId && o.mode === 'FREE_LONG_NOTE'
              ? 'FREE PITCH'
              : INSTRUMENTS[o.instrumentId].name}
          </span>
        </button>
      ))}
    </div>
  );
}
