import { useRef, useState } from 'react';
import { input } from '../world/controls';

/** On-screen joystick for touch devices. Writes to the shared input vector. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const R = 44;

  const move = (clientX: number, clientY: number) => {
    const el = base.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    input.x = dx / R;
    input.z = dy / R;
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    input.x = 0;
    input.z = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="ג'ויסטיק תנועה"
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
