'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Focus,
  Hand,
  Headphones,
  Link2,
  Maximize2,
  Music2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings2,
  Sparkles,
  Unlink,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PerformanceController, type Snapshot } from './PerformanceController';
import { ChordProgressionEngine } from '../audio/ChordProgressionEngine';
import { CameraOverlay } from '../components/CameraOverlay';
import { AudioScope } from '../components/AudioScope';
import { DebugPanel } from '../components/DebugPanel';
import { Choice, Range, Toggle } from '../components/Controls';
import { INSTRUMENTS } from '../config/objectSoundMap';
import { KEYS, MUSIC } from '../config/musicConfig';
import type { GameMode, InstrumentId, RoleOverride } from '../types';
const initial: Snapshot = {
  running: false,
  loading: false,
  practice: false,
  camera: 'Camera off',
  status: 'Your surroundings. Your sound.',
  objects: [],
  hands: [],
  harmony: new ChordProgressionEngine().state(),
  interaction: 'IDLE',
  notice: '',
  volume: MUSIC.volume,
  reverb: MUSIC.reverb,
  fps: 0,
  network: 'Solo session',
};
export default function MusicDuo() {
  const video = useRef<HTMLVideoElement>(null),
    controller = useRef<PerformanceController | null>(null),
    stage = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(initial),
    [mode, setMode] = useState<GameMode>('DESKTOP_DUO'),
    [mirror, setMirror] = useState(true),
    [skeleton, setSkeleton] = useState(true),
    [override, setOverride] = useState<RoleOverride>('AUTO'),
    [keyGesture, setKeyGesture] = useState(false),
    [room, setRoom] = useState('studio-01'),
    [guide, setGuide] = useState(true);
  useEffect(() => {
    if (!video.current) return;
    const c = new PerformanceController(video.current, setS);
    controller.current = c;
    c.emit();
    return () => {
      c.dispose();
      controller.current = null;
    };
  }, []);
  const scopeValues = useCallback(
    () => controller.current?.music?.waveformValues(),
    [],
  );
  const selected = s.objects.find((o) => o.id === s.selectedId);
  const activeKey = KEYS.indexOf(s.harmony.key);
  const switchMode = (value: string) => {
    const m = value as GameMode;
    setMode(m);
    setMirror(m === 'DESKTOP_DUO');
    if (controller.current) {
      controller.current.mode = m;
      controller.current.mirror = m === 'DESKTOP_DUO';
    }
  };
  const start = (practice = false) => void controller.current?.start(practice);
  const keyStep = (delta: number) =>
    controller.current?.key(
      KEYS[(activeKey + delta + KEYS.length) % KEYS.length],
    );
  return (
    <div className="musicduo dark">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="MusicDuo home">
          <span className="brand-mark">
            <AudioLines size={22} />
          </span>
          MusicDuo<span className="beta">BETA</span>
        </Link>
        <div className="top-caption">
          A little movement. A new kind of music.
        </div>
        <div className="top-actions">
          <Dialog>
            <DialogTrigger className="text-button">
              <CircleHelp size={17} />
              <span>How to play</span>
            </DialogTrigger>
            <DialogContent className="duo-dialog">
              <DialogTitle>Make music with what’s around you.</DialogTitle>
              <DialogDescription>
                Headphones on. Camera ready. No musical experience needed.
              </DialogDescription>
              <div className="help-steps">
                <p>
                  <b>01 · Find your sound</b>Place a bottle, book, chair, or
                  plant in view. Hold still for a moment while a sound is
                  assigned.
                </p>
                <p>
                  <b>02 · Link an object</b>Pinch your left thumb and index
                  finger over its box. Hold briefly until you see LINKED.
                </p>
                <p>
                  <b>03 · Shape the music</b>Spread your fingers for longer
                  notes. Open fully for free pitch, then move up and down. Close
                  your hand to return to the chord.
                </p>
                <p>
                  <b>04 · Play together</b>Your right hand controls the whole
                  mix: open your palm for reverb; separate thumb and index for
                  volume. Open your pinch away from the linked object to detach.
                </p>
                <p>
                  In practice mode, click to link an object, move your pointer
                  vertically, and use the object controls. On mobile, one hand
                  controls objects and sliders control the mix.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger className="button secondary small">
              <Users size={16} />
              Play together
            </DialogTrigger>
            <DialogContent className="duo-dialog">
              <DialogTitle>A shared room for two</DialogTitle>
              <DialogDescription>
                The MVP connects tabs on this browser using a local room.
                Two-device networking is available through the documented
                WebSocket adapter.
              </DialogDescription>
              <label className="field">
                Room name
                <input
                  value={room}
                  maxLength={40}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="studio-01"
                />
              </label>
              <Choice
                label="Player role"
                value={override}
                options={[
                  { value: 'AUTO', label: 'Automatic · both hands' },
                  {
                    value: 'GLOBAL_CONTROLLER',
                    label: 'Player A · Global controller',
                  },
                  {
                    value: 'OBJECT_CONTROLLER',
                    label: 'Player B · Object controller',
                  },
                  { value: 'SWAP', label: 'Swap left and right' },
                ]}
                onChange={(v) => {
                  setOverride(v as RoleOverride);
                  if (controller.current)
                    controller.current.override = v as RoleOverride;
                }}
              />
              <button
                className="button primary"
                disabled={!room.trim()}
                onClick={() => controller.current?.connect(room.trim())}
              >
                <Link2 size={16} />
                Join local room
              </button>
              <button
                className="text-button"
                onClick={() => controller.current?.disconnect()}
              >
                Leave room
              </button>
              <p className="muted">
                {s.network}. Open this site in another tab and join the same
                room with the other role. Start audio in each tab; mute one tab
                to avoid doubling.
              </p>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="workspace">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">
              <span className="tiny-dot" />
              THE PLAYGROUND
            </div>
            <h1>
              Turn your space into sound<span>.</span>
            </h1>
          </div>
          <div className="mode-picker">
            <span className="eyebrow">PLAY MODE</span>
            <Choice
              label="Play mode"
              value={mode}
              disabled={s.running || s.loading}
              options={[
                { value: 'DESKTOP_DUO', label: 'Desktop duo' },
                { value: 'MOBILE_SHARED', label: 'Mobile shared' },
              ]}
              onChange={switchMode}
            />
          </div>
        </section>
        <div className="performance-grid">
          <div className="main-column">
            <section className="stage-panel">
              <div className="panel-top">
                <div className="panel-title">
                  <Camera size={16} />
                  <span>Live canvas</span>
                  <span className={`status-pill ${s.running ? 'on' : ''}`}>
                    <span />
                    {s.running ? (s.practice ? 'PRACTICE' : 'LIVE') : 'STANDBY'}
                  </span>
                </div>
                <div className="stage-actions">
                  <button
                    className={`icon-button ${skeleton ? 'active' : ''}`}
                    title="Toggle hand landmarks"
                    aria-label="Toggle hand landmarks"
                    aria-pressed={skeleton}
                    onClick={() => setSkeleton(!skeleton)}
                  >
                    <Hand size={16} />
                  </button>
                  <button
                    className="icon-button"
                    title="Fullscreen canvas"
                    aria-label="Fullscreen canvas"
                    onClick={() => {
                      if (document.fullscreenElement)
                        void document.exitFullscreen();
                      else
                        void stage.current?.requestFullscreen().catch(() => {});
                    }}
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>
              <div
                ref={stage}
                className={`camera-stage ${s.practice ? 'practice-stage' : ''}`}
                onPointerMove={(e) => {
                  const b = e.currentTarget.getBoundingClientRect();
                  controller.current?.pointer(
                    Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
                    Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
                  );
                }}
              >
                <video
                  ref={video}
                  muted
                  playsInline
                  autoPlay
                  className={mirror ? 'mirrored' : ''}
                  style={{ opacity: s.running && !s.practice ? 1 : 0 }}
                />
                <div className="stage-grid" />
                <div className="stage-corner corner-tl" />
                <div className="stage-corner corner-tr" />
                <div className="stage-corner corner-bl" />
                <div className="stage-corner corner-br" />
                <div className="stage-meta">
                  <span>
                    <span className={`tiny-dot ${s.running ? 'mint' : ''}`} />
                    {s.camera}
                  </span>
                  <span>
                    {mode === 'DESKTOP_DUO' ? 'FRONT CAMERA' : 'BACK CAMERA'}{' '}
                    <Focus size={13} />
                  </span>
                </div>
                {!s.running && !s.loading && (
                  <div className="start-screen">
                    <div className="instrument-emblem">
                      <AudioLines size={45} strokeWidth={1} />
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                    </div>
                    <div className="eyebrow">YOUR WORLD IS AN INSTRUMENT</div>
                    <h2>Make room for music.</h2>
                    <p>
                      Find a few everyday objects.
                      <br />
                      Let your hands do the playing.
                    </p>
                    <button
                      className="button primary start-button"
                      onClick={() => start()}
                    >
                      <Play size={16} fill="currentColor" />
                      Start Experience
                      <ArrowUpRight size={17} />
                    </button>
                    <button
                      className="practice-link"
                      onClick={() => start(true)}
                    >
                      Try without a camera <ArrowUpRight size={13} />
                    </button>
                    <div className="privacy-note">
                      <span className="tiny-dot" />
                      Camera stays on your device. Headphones recommended.
                    </div>
                  </div>
                )}
                {s.loading && (
                  <div className="loading-screen">
                    <span className="loading-ring" />
                    <h2>Warming up your studio</h2>
                    <p>{s.status}</p>
                    <button
                      className="text-button"
                      onClick={() => controller.current?.stop()}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {s.running && !s.loading && (
                  <>
                    <CameraOverlay
                      objects={s.objects}
                      hands={s.hands}
                      selectedId={s.selectedId}
                      skeleton={skeleton}
                      practice={s.practice}
                      objectHand={s.objectHand}
                      onSelect={(id) => controller.current?.select(id)}
                    />
                    {!s.objects.length && (
                      <div className="scan-prompt">
                        <Focus size={34} strokeWidth={1} />
                        <h2>
                          {s.camera === 'Camera unavailable'
                            ? 'Your camera needs a moment.'
                            : 'Bring an object into view.'}
                        </h2>
                        <p>{s.status}</p>
                        {s.camera === 'Camera unavailable' && (
                          <button
                            className="button primary"
                            onClick={() => {
                              controller.current?.stop();
                              start(true);
                            }}
                          >
                            Play in practice mode
                          </button>
                        )}
                      </div>
                    )}
                    {s.practice && (
                      <div className="practice-label">
                        <Sparkles size={14} />
                        Practice objects · click to link
                      </div>
                    )}
                    {s.notice && (
                      <div
                        className="selection-notice"
                        key={s.notice + s.selectedId}
                      >
                        <Link2 size={15} />
                        {s.notice}
                      </div>
                    )}
                  </>
                )}
                <div className="stage-bottom">
                  <span>
                    <span
                      className={`hand-dot ${s.hands.some((h) => h.handedness === 'left') ? 'detected' : ''}`}
                    />
                    Left hand <span className="dim">/ objects</span>
                  </span>
                  <span>
                    <span
                      className={`hand-dot ${s.hands.some((h) => h.handedness === 'right') ? 'detected orange' : ''}`}
                    />
                    Right hand <span className="dim">/ master</span>
                  </span>
                </div>
              </div>
              <div className="canvas-footer">
                <span>
                  <span className={`tiny-dot ${s.running ? 'mint' : ''}`} />
                  {s.running
                    ? s.practice
                      ? 'Practice mode'
                      : s.camera
                    : 'Ready to find your rhythm'}
                </span>
                <span className="mono">
                  {s.objects.length.toString().padStart(2, '0')} OBJECTS{' '}
                  <span className="separator">/</span> {s.fps} FPS
                </span>
              </div>
            </section>
            <section className="harmony-panel">
              <div className="section-heading">
                <h2>
                  <Music2 size={17} />
                  The harmony
                </h2>
                <button
                  className="text-button"
                  disabled={!s.running}
                  onClick={() => controller.current?.regenerate()}
                >
                  <RefreshCw size={14} />
                  New progression
                </button>
              </div>
              <div className="chord-row">
                {s.harmony.progression.map((name, i) => (
                  <div
                    className={`chord ${i === s.harmony.chordIndex ? 'current' : ''}`}
                    key={i}
                  >
                    <div className="chord-top">
                      <span>{s.harmony.degrees[i]}</span>
                      {i === s.harmony.chordIndex && (
                        <span className="chord-playing">
                          {s.running ? 'PLAYING' : 'FIRST BAR'}
                        </span>
                      )}
                    </div>
                    <strong>
                      {name}
                      <span>{name.endsWith('m') ? 'min' : 'maj'}</span>
                    </strong>
                    <div className="beat-track">
                      {[0, 1, 2, 3].map((b) => (
                        <i
                          key={b}
                          className={
                            s.running &&
                            i === s.harmony.chordIndex &&
                            b <= s.harmony.beat
                              ? 'beat-on'
                              : ''
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="harmony-footer">
                <span>
                  <span className="tiny-dot mint" />
                  {s.harmony.key} major <span className="separator">·</span>{' '}
                  4-bar progression
                </span>
                <span>Always in harmony. Until you let go.</span>
              </div>
            </section>
            {guide && (
              <section className="quick-guide">
                <div className="guide-heading">
                  <span className="eyebrow">A FEW SMALL MOVES</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss quick guide"
                    onClick={() => setGuide(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="guide-grid">
                  <div>
                    <span className="gesture-icon">
                      <Focus size={23} />
                    </span>
                    <p>
                      <b>Pinch to connect</b>
                      <span>Grab a sound. Make it yours.</span>
                    </p>
                  </div>
                  <div>
                    <span className="gesture-icon">
                      <Hand size={23} />
                    </span>
                    <p>
                      <b>Open to explore</b>
                      <span>Longer notes, more expression.</span>
                    </p>
                  </div>
                  <div>
                    <span className="gesture-icon">
                      <ArrowDown size={23} />
                    </span>
                    <p>
                      <b>Move to shape</b>
                      <span>Go higher. Drift lower.</span>
                    </p>
                  </div>
                </div>
              </section>
            )}
            <DebugPanel s={s} />
          </div>
          <aside className="control-column">
            <section className="control-panel">
              <div className="section-heading">
                <h2>
                  <SlidersIcon />
                  Master controls
                </h2>
                <span className="role-badge">
                  {mode === 'MOBILE_SHARED' ? 'TOUCH' : 'RIGHT HAND'}
                </span>
              </div>
              <div className="control-inner">
                <Range
                  label="Master dynamics"
                  value={s.volume}
                  onChange={(v) => controller.current?.controls(v, s.reverb)}
                />
                <div className="range-caption">
                  <VolumeX size={12} />
                  <span>Thumb + index spread</span>
                  <Volume2 size={13} />
                </div>
                <Range
                  label="Reverb"
                  value={s.reverb}
                  onChange={(v) => controller.current?.controls(s.volume, v)}
                />
                <div className="range-caption">
                  <Waves size={13} />
                  <span>Hand openness</span>
                  <Waves size={16} />
                </div>
                <div className="key-tempo">
                  <div>
                    <span className="field-label">KEY</span>
                    <div className="key-control">
                      <button
                        aria-label="Previous key"
                        onClick={() => keyStep(-1)}
                        disabled={!s.running}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <b>
                        {s.harmony.key}
                        <span>major</span>
                      </b>
                      <button
                        aria-label="Next key"
                        onClick={() => keyStep(1)}
                        disabled={!s.running}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="field-label">TEMPO</span>
                    <div className="tempo-control">
                      <input
                        aria-label="Tempo BPM"
                        type="number"
                        min={MUSIC.minBpm}
                        max={MUSIC.maxBpm}
                        value={s.harmony.bpm}
                        disabled={!s.running}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v >= MUSIC.minBpm && v <= MUSIC.maxBpm)
                            controller.current?.bpm(v);
                        }}
                      />
                      <span>BPM</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className="control-panel object-panel">
              <div className="section-heading">
                <h2>
                  <Focus size={17} />
                  Sound objects
                </h2>
                <span className="count">{s.objects.length}</span>
              </div>
              {!s.objects.length ? (
                <div className="empty-objects">
                  <span className="empty-orbit">
                    <Focus size={26} strokeWidth={1} />
                  </span>
                  <b>A room full of possibilities</b>
                  <p>
                    Your recognized objects will appear here, each with a sound
                    of its own.
                  </p>
                  <div className="object-examples">
                    <span>Bottle</span>
                    <span>Book</span>
                    <span>Plant</span>
                  </div>
                </div>
              ) : (
                <div className="object-list">
                  {s.objects.map((o) => (
                    <div
                      className={`sound-object ${selected?.id === o.id ? 'selected' : ''}`}
                      key={o.id}
                      style={
                        {
                          '--object-color': INSTRUMENTS[o.instrumentId].color,
                        } as React.CSSProperties
                      }
                    >
                      <button
                        className="sound-object-main"
                        onClick={() => controller.current?.select(o.id)}
                      >
                        <span className="voice-icon">
                          <AudioLines size={19} />
                        </span>
                        <span>
                          <b>{o.label}</b>
                          <small>{INSTRUMENTS[o.instrumentId].name}</small>
                        </span>
                        {selected?.id === o.id && <Link2 size={14} />}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${o.muted ? 'Unmute' : 'Mute'} ${o.label}`}
                        onClick={() =>
                          controller.current?.patch(o.id, { muted: !o.muted })
                        }
                      >
                        {o.muted ? (
                          <VolumeX size={15} />
                        ) : (
                          <Volume2 size={15} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {selected && (
                <div className="selected-controls">
                  <div className="selection-header">
                    <span>
                      <Link2 size={13} />
                      LINKED TO {selected.label.toUpperCase()}
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Detach object"
                      onClick={() => controller.current?.detach()}
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                  <Choice
                    label="Object instrument"
                    value={selected.instrumentId}
                    options={Object.entries(INSTRUMENTS).map(([value, v]) => ({
                      value,
                      label: v.name,
                    }))}
                    onChange={(v) =>
                      controller.current?.patch(selected.id, {
                        instrumentId: v as InstrumentId,
                        soundType: v === 'pattern' ? 'loop' : 'synth',
                      })
                    }
                  />
                  <Range
                    label="Object dynamics"
                    value={selected.volume}
                    onChange={(v) =>
                      controller.current?.patch(selected.id, { volume: v })
                    }
                  />
                  <Range
                    label="Note length"
                    value={(selected.sustain - 0.08) / 1.6}
                    onChange={(v) =>
                      controller.current?.patch(selected.id, {
                        sustain: 0.08 + v * 1.6,
                      })
                    }
                  />
                  <Toggle
                    label="Free pitch · sustained"
                    checked={selected.mode === 'FREE_LONG_NOTE'}
                    onChange={(v) =>
                      controller.current?.patch(selected.id, {
                        mode: v ? 'FREE_LONG_NOTE' : 'CHORD_FOLLOWING',
                      })
                    }
                  />
                  <span
                    className={`pitch-badge ${selected.mode === 'FREE_LONG_NOTE' ? 'free' : ''}`}
                  >
                    {selected.mode === 'FREE_LONG_NOTE'
                      ? 'FREE PITCH ↕ Move vertically'
                      : 'CHORD · Following the harmony'}
                  </span>
                </div>
              )}
            </section>
            <section className="control-panel session-panel">
              <div className="section-heading">
                <h2>
                  <Settings2 size={16} />
                  Your setup
                </h2>
                <span className="local-label">
                  <span className="tiny-dot mint" />
                  LOCAL
                </span>
              </div>
              <div className="control-inner">
                <Toggle
                  label="Mirror camera"
                  checked={mirror}
                  disabled={s.running || s.loading}
                  onChange={(v) => {
                    setMirror(v);
                    if (controller.current) controller.current.mirror = v;
                  }}
                />
                <Toggle
                  label="Hand landmarks"
                  checked={skeleton}
                  onChange={setSkeleton}
                />
                <Toggle
                  label="Gesture key changes"
                  checked={keyGesture}
                  onChange={(v) => {
                    setKeyGesture(v);
                    if (controller.current)
                      controller.current.global.keyGestureEnabled = v;
                  }}
                />
                <p className="setting-hint">
                  Experimental · rotate your right hand and hold.
                </p>
                <Choice
                  label="Hand roles"
                  value={override}
                  options={[
                    {
                      value: 'AUTO',
                      label: 'Auto · right global / left object',
                    },
                    { value: 'SWAP', label: 'Swap left and right' },
                    {
                      value: 'GLOBAL_CONTROLLER',
                      label: 'Player A · global controls',
                    },
                    {
                      value: 'OBJECT_CONTROLLER',
                      label: 'Player B · object controls',
                    },
                  ]}
                  onChange={(v) => {
                    setOverride(v as RoleOverride);
                    if (controller.current)
                      controller.current.override = v as RoleOverride;
                  }}
                />
              </div>
            </section>
          </aside>
        </div>
        <footer className="workspace-footer">
          <span>
            <Headphones size={14} />
            Better with headphones. Best with a friend.
          </span>
          <span>
            Vision → objects → harmony → you <ArrowUpRight size={13} />
          </span>
        </footer>
      </main>
      <div className="transport">
        <div className="transport-left">
          <button
            className={`transport-play ${s.running ? 'playing' : ''}`}
            aria-label={s.running ? 'Stop experience' : 'Start Experience'}
            disabled={s.loading}
            onClick={() => (s.running ? controller.current?.stop() : start())}
          >
            {s.running ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <div>
            <b>
              {s.loading
                ? 'Getting ready…'
                : s.running
                  ? 'You’re in the flow'
                  : 'Let’s make something.'}
            </b>
            <output>
              {s.loading
                ? 'Preparing audio and vision'
                : s.running
                  ? s.status
                  : 'Press play. Your space is the starting point.'}
            </output>
          </div>
        </div>
        <div className="transport-wave">
          <AudioScope values={scopeValues} active={s.running} />
        </div>
        <div className="transport-right">
          <span className={`tiny-dot ${s.running ? 'mint' : ''}`} />
          <span>{s.running ? 'AUDIO ON' : 'AUDIO OFF'}</span>
          <span className="transport-divider" />
          <Radio size={14} />
          <span>{s.network}</span>
        </div>
      </div>
    </div>
  );
}
function SlidersIcon() {
  return <Settings2 size={17} />;
}
