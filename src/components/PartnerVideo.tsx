import { useEffect, useRef, useState } from 'react';
import type { RemoteRole } from '../multiplayer/remoteProtocol';
export function PartnerVideo({
  stream,
  role,
  status,
}: {
  stream?: MediaStream;
  role: RemoteRole;
  status: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [listen, setListen] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream ?? null;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <section className="partner-view" aria-label="Remote partner">
      {/* Silent camera plus instrumental audio only; no speech to caption. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={role === 'host' || !listen}
      />
      <div className="partner-caption">
        <b>{role === 'host' ? 'Guest' : 'Host'}</b>
        <span>{status}</span>
      </div>
      {role === 'guest' && (
        <button
          className="button secondary small"
          onClick={() => {
            setListen(!listen);
            if (ref.current) {
              ref.current.muted = listen;
              void ref.current.play().catch(() => {});
            }
          }}
        >
          {listen ? 'Mute host audio' : 'Listen to host audio'}
        </button>
      )}
    </section>
  );
}
