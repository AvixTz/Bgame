import { useEffect, useRef, useState } from 'react';
import { input, releaseJoystick, setJoystick } from '../world/controls';

const R = 48;

/**
 * Floating on-screen joystick: the stick centers where the thumb lands inside the touch zone, and it
 * stays mounted for the whole world session so a drag can never be orphaned.
 */
export function Joystick() {
  const zone = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => () => releaseJoystick(), []);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = zone.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const update = (o: { x: number; y: number }, clientX: number, clientY: number, pointerId: number) => {
    const p = toLocal(clientX, clientY);
    let dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    setJoystick(dx / R, dy / R, pointerId);
  };

  const end = () => {
    releaseJoystick();
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div
      ref={zone}
      className="joy-zone"
      data-testid="joystick"
      onPointerDown={(e) => {
        if (input.joy.active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const o = toLocal(e.clientX, e.clientY);
        setOrigin(o);
        update(o, e.clientX, e.clientY, e.pointerId);
      }}
      onPointerMove={(e) => { if (origin && e.pointerId === input.joy.pointerId) update(origin, e.clientX, e.clientY, e.pointerId); }}
      onPointerUp={(e) => { if (e.pointerId === input.joy.pointerId) end(); }}
      onPointerCancel={end}
      onLostPointerCapture={end}
      aria-label="ג'ויסטיק תנועה: גררו כדי ללכת"
    >
      <div
        className={`joystick ${origin ? 'on' : ''}`}
        style={origin ? { left: origin.x - 60, top: origin.y - 60 } : undefined}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  );
}
