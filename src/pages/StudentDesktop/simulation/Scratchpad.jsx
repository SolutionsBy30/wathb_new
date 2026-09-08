import { useEffect, useRef, useState } from 'react';

/**
 * SIM-014 — §5.3 لوحة المسودة.
 *
 * A canvas the student can scribble on, cleared between sections and never
 * scored. Deliberately not persisted anywhere: it is scratch paper, and
 * storing it would make it evidence in a report it has no business being in.
 */
export default function Scratchpad({ open, onClose }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [colour, setColour] = useState('#F5F1E8');

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size the backing store to the element so strokes land under the cursor
    // rather than at a scaled offset.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
  }, [open]);

  if (!open) return null;

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] ?? e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => { drawingRef.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="sim-scratchpad">
      <div className="sim-scratchpad-bar">
        <span className="sim-label">لوحة المسودة</span>
        <button type="button" className="sim-chip" onClick={() => setColour('#F5F1E8')} aria-label="قلم فاتح">فاتح</button>
        <button type="button" className="sim-chip" onClick={() => setColour('#C6F24E')} aria-label="قلم مميز">مميز</button>
        <button type="button" className="sim-chip" onClick={clear}>مسح</button>
        <button type="button" className="sim-chip" onClick={onClose}>إغلاق</button>
      </div>
      <canvas
        ref={canvasRef}
        className="sim-scratchpad-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    </div>
  );
}
