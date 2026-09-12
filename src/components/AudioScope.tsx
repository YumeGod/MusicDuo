import { useEffect, useRef } from 'react';
export function AudioScope({
  values,
  active = false,
}: {
  values: () => Float32Array<ArrayBufferLike> | undefined;
  active?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let id = 0;
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const w = c.width,
        h = c.height;
      ctx.clearRect(0, 0, w, h);
      const data = values();
      ctx.strokeStyle = active ? '#e5a684' : '#66605d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 128; i++) {
        const x = (i / 127) * w,
          y = h / 2 + (data?.[i] ?? 0) * h * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [values, active]);
  return (
    <canvas
      className="audio-scope"
      ref={ref}
      width="700"
      height="70"
      aria-label="Live audio waveform"
    />
  );
}
