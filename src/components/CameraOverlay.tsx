import type { HandControlState, SoundObject, HandObjectLink } from '../types';
import { RHYTHM_LABELS } from '../config/rhythmConfig';
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
  links,
  skeleton,
  onSelect,
  practice,
}: {
  objects: SoundObject[];
  hands: HandControlState[];
  links: HandObjectLink[];
  skeleton: boolean;
  onSelect: (id: string) => void;
  practice: boolean;
}) {
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
        {links.map((link) => {
          const selected = objects.find((o) => o.id === link.objectId),
            hand = link.hand;
          return selected && hand ? (
            <g className="tether" key={link.handId}>
              <line
                x1={hand.x * 1000}
                y1={hand.cursorY * 750}
                x2={(selected.bbox.x + selected.bbox.width / 2) * 1000}
                y2={(selected.bbox.y + selected.bbox.height / 2) * 750}
              />
              <circle cx={hand.x * 1000} cy={hand.cursorY * 750} r="9" />
              <text
                x={hand.x * 1000 + 14}
                y={hand.cursorY * 750 - 14}
                fill="white"
                stroke="none"
                fontSize="16"
              >
                {link.label}
              </text>
            </g>
          ) : null;
        })}
      </svg>
      {objects.map((o) => (
        <button
          key={o.id}
          onClick={() => onSelect(o.id)}
          className={`object-box ${o.selectedBy ? 'linked' : ''} ${practice ? 'practice-object' : ''}`}
          style={
            {
              zIndex: o.label.toLowerCase() === 'person' ? 0 : 1,
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
              {o.selectedBy
                ? `↗ LINKED ${links.find((l) => l.objectId === o.id)?.label ?? ''}`
                : ''}
            </span>
          </span>
          {practice && (
            <span className="object-tone">
              {INSTRUMENTS[o.instrumentId].name}
              <span className="mini-wave">∿ ∿ ∿</span>
            </span>
          )}
          <span className="object-instrument">
            {o.selectedBy && o.mode === 'FREE_LONG_NOTE'
              ? `MELODY · ${RHYTHM_LABELS[o.subdivision]}`
              : `${INSTRUMENTS[o.instrumentId].name} · ${RHYTHM_LABELS[o.subdivision]}`}
          </span>
        </button>
      ))}
    </div>
  );
}
