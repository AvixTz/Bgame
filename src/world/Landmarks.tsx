import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import { LatheGeometry, Vector2, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { PORTALS, portalPos, type PortalDef } from './portals';
import { groundHeight } from './terrain';
import { useApp } from '../core/store';
import { setObstacles } from './obstacles';

/** Every landmark sits behind its entry pad, facing the island center (local +z points to the plaza). */
const BODY_Z = -3.2;
const BODY_R: Record<string, number> = { mines: 2.8, library: 2.2, lab: 2.4, village: 3.4, arena: 2.9, story: 2.6, puzzles: 2.6, smarter: 2.4 };

const wood = { color: '#A46B3F', roughness: 0.85 } as const;
const stone = { color: '#C9C3B8', roughness: 0.9 } as const;

function MinesBody({ def }: { def: PortalDef }) {
  return (
    <group>
      <mesh position={[0, 1.4, -0.4]} scale={[3.1, 2.3, 2.4]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#9C8A76" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[2.3, 0.6, 0.4]} scale={[1.2, 0.9, 1]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#8A7865" roughness={0.95} flatShading /></mesh>
      <mesh position={[-2.4, 0.5, 0.2]} scale={[1, 0.8, 1]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#A89583" roughness={0.95} flatShading /></mesh>
      {/* crystals poking out */}
      {[[-1.2, 2.9, 0.6, 0.3], [1.1, 2.6, 0.9, -0.4], [0.2, 3.3, 0.2, 0.1]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, r]}><octahedronGeometry args={[0.35, 0]} /><meshStandardMaterial color={['#2E6BFF', '#FF4F8B', '#1FC690'][i]} emissive={['#2E6BFF', '#FF4F8B', '#1FC690'][i]} emissiveIntensity={0.6} roughness={0.2} /></mesh>
      ))}
      {/* entrance */}
      <mesh position={[0, 1.15, 1.72]}><planeGeometry args={[1.8, 2.3]} /><meshBasicMaterial color="#1B1209" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 1.05, 1.2, 1.85]} castShadow><boxGeometry args={[0.3, 2.5, 0.3]} /><meshStandardMaterial {...wood} /></mesh>)}
      <mesh position={[0, 2.5, 1.85]} castShadow><boxGeometry args={[2.6, 0.32, 0.36]} /><meshStandardMaterial {...wood} /></mesh>
      {[-1.7, 1.7].map((x) => (
        <group key={x} position={[x, 0, 2.3]}>
          <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.06, 0.06, 1.8, 8]} /><meshStandardMaterial color="#5B3A29" /></mesh>
          <mesh position={[0, 1.9, 0]}><boxGeometry args={[0.3, 0.36, 0.3]} /><meshStandardMaterial color="#FFE7A0" emissive={def.color} emissiveIntensity={1.4} /></mesh>
        </group>
      ))}
      {/* rails and a cart of gold */}
      {[-0.45, 0.45].map((x) => <mesh key={x} position={[x, 0.06, 2.4]}><boxGeometry args={[0.08, 0.06, 1.6]} /><meshStandardMaterial color="#6F7787" metalness={0.6} roughness={0.4} /></mesh>)}
      {[0, 1, 2].map((i) => <mesh key={i} position={[0, 0.03, 1.8 + i * 0.6]}><boxGeometry args={[1.2, 0.05, 0.18]} /><meshStandardMaterial {...wood} /></mesh>)}
      <group position={[2.6, 0.35, 2.2]} rotation={[0, -0.5, 0]}>
        <mesh castShadow><boxGeometry args={[1.1, 0.55, 0.8]} /><meshStandardMaterial color="#7A5236" roughness={0.8} /></mesh>
        {[[-0.25, 0.35, 0], [0.2, 0.38, 0.1], [0, 0.42, -0.15]].map((p, i) => <mesh key={i} position={p as [number, number, number]}><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#FFC83D" emissive="#FFB930" emissiveIntensity={0.5} metalness={0.5} roughness={0.3} /></mesh>)}
        {[[-0.4, -0.3, 0.42], [0.4, -0.3, 0.42], [-0.4, -0.3, -0.42], [0.4, -0.3, -0.42]].map((p, i) => <mesh key={i} position={p as [number, number, number]} rotation={[0, Math.PI / 2, Math.PI / 2]}><cylinderGeometry args={[0.13, 0.13, 0.08, 12]} /><meshStandardMaterial color="#2B2F3A" /></mesh>)}
      </group>
    </group>
  );
}

const BOOKS = [
  { c: '#8A5CF6', w: 3.0, h: 0.8, r: 0.1 },
  { c: '#FF4F8B', w: 2.7, h: 0.7, r: -0.18 },
  { c: '#2E6BFF', w: 2.9, h: 0.75, r: 0.25 },
  { c: '#FFB930', w: 2.4, h: 0.65, r: -0.05 },
  { c: '#1FC690', w: 2.2, h: 0.6, r: 0.3 },
];

function LibraryBody() {
  let y = 0;
  return (
    <group>
      {BOOKS.map((b, i) => {
        const cy = y + b.h / 2;
        y += b.h;
        return (
          <group key={i} position={[0, cy, 0]} rotation={[0, b.r, 0]}>
            <mesh castShadow receiveShadow><boxGeometry args={[b.w, b.h, b.w * 0.72]} /><meshStandardMaterial color={b.c} roughness={0.6} /></mesh>
            <mesh position={[0.08, 0, 0.02]}><boxGeometry args={[b.w * 0.96, b.h * 0.78, b.w * 0.72 + 0.02]} /><meshStandardMaterial color="#FFF8EC" roughness={0.9} /></mesh>
            <mesh position={[-b.w / 2 - 0.01, 0, 0]}><boxGeometry args={[0.04, b.h * 0.3, b.w * 0.5]} /><meshStandardMaterial color="#FFE7A0" emissive="#FFE7A0" emissiveIntensity={0.3} /></mesh>
          </group>
        );
      })}
      {/* open book on top */}
      <group position={[0, y + 0.18, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.62, 0.12, 0]} rotation={[0, 0, -s * 0.28]} castShadow>
            <boxGeometry args={[1.25, 0.1, 1.5]} /><meshStandardMaterial color="#FFF8EC" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* arched door */}
      <mesh position={[0, 0.72, 1.12]}><circleGeometry args={[0.55, 24, 0, Math.PI]} /><meshBasicMaterial color="#2A1846" /></mesh>
      <mesh position={[0, 0.36, 1.12]}><planeGeometry args={[1.1, 0.72]} /><meshBasicMaterial color="#2A1846" /></mesh>
      {/* floating letters */}
      {['א', 'ב', 'ג'].map((l, i) => (
        <FloatingLetter key={l} letter={l} x={(i - 1) * 1.3} y={y + 1.3 + (i % 2) * 0.4} phase={i * 1.7} />
      ))}
    </group>
  );
}

function FloatingLetter({ letter, x, y, phase }: { letter: string; x: number; y: number; phase: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.25; });
  return (
    <group ref={ref} position={[x, y, 0.4]}>
      <Html center distanceFactor={14} zIndexRange={[4, 0]} pointerEvents="none">
        <div className="float-letter">{letter}</div>
      </Html>
    </group>
  );
}

function LabBody({ def }: { def: PortalDef }) {
  const bubbles = useRef<(Mesh | null)[]>([]);
  const light = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bubbles.current.forEach((b, i) => {
      if (!b) return;
      const p = ((t * 0.5 + i * 0.23) % 1);
      b.position.set(Math.sin(i * 2.1 + t) * 0.25, 2.4 + p * 1.6, 0.5 + Math.cos(i) * 0.15);
      b.scale.setScalar(0.12 * (1 - p) + 0.03);
    });
    if (light.current) (light.current.material as MeshStandardMaterial).emissiveIntensity = Math.sin(t * 4) > 0 ? 2 : 0.2;
  });
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow><cylinderGeometry args={[2, 2.2, 1.8, 32]} /><meshStandardMaterial color="#F4F8FF" roughness={0.5} /></mesh>
      <mesh position={[0, 1.82, 0]}><torusGeometry args={[2, 0.12, 12, 48]} /><meshStandardMaterial color={def.color} roughness={0.4} /></mesh>
      <mesh position={[0, 1.8, 0]}><sphereGeometry args={[1.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#BFEFFF" transparent opacity={0.35} roughness={0.05} metalness={0.1} depthWrite={false} /></mesh>
      {/* giant flask under the dome */}
      <group position={[0, 1.8, 0.5]}>
        <mesh position={[0, 0.55, 0]}><sphereGeometry args={[0.65, 24, 16]} /><meshStandardMaterial color="#DDF7FF" transparent opacity={0.45} roughness={0.05} depthWrite={false} /></mesh>
        <mesh position={[0, 0.45, 0]}><sphereGeometry args={[0.52, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65]} /><meshStandardMaterial color="#39E6A0" emissive="#1FC690" emissiveIntensity={0.9} /></mesh>
        <mesh position={[0, 1.35, 0]}><cylinderGeometry args={[0.18, 0.2, 0.7, 16]} /><meshStandardMaterial color="#DDF7FF" transparent opacity={0.5} depthWrite={false} /></mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(el) => { bubbles.current[i] = el; }}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#B6FFE0" emissive="#1FC690" emissiveIntensity={0.6} /></mesh>
      ))}
      {/* door, windows, antenna */}
      <mesh position={[0, 0.65, 2.22]}><planeGeometry args={[0.9, 1.3]} /><meshStandardMaterial color={def.dark} /></mesh>
      {[-1.3, 1.3].map((x) => <mesh key={x} position={[x, 1.05, 1.72]} rotation={[0, x > 0 ? 0.62 : -0.62, 0]}><circleGeometry args={[0.28, 20]} /><meshStandardMaterial color="#BFEFFF" emissive="#8FE3FF" emissiveIntensity={0.4} /></mesh>)}
      <mesh position={[1.5, 3.2, -0.6]}><cylinderGeometry args={[0.04, 0.04, 1.6, 6]} /><meshStandardMaterial color="#6F7787" /></mesh>
      <mesh ref={light} position={[1.5, 4.05, -0.6]}><sphereGeometry args={[0.12, 12, 8]} /><meshStandardMaterial color="#FF4F8B" emissive="#FF4F8B" emissiveIntensity={2} /></mesh>
    </group>
  );
}

function House({ x, z, rot, wall, roof, s = 1 }: { x: number; z: number; rot: number; wall: string; roof: string; s?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} scale={s}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow><boxGeometry args={[1.6, 1.4, 1.5]} /><meshStandardMaterial color={wall} roughness={0.8} /></mesh>
      <mesh position={[0, 1.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.45, 1, 4]} /><meshStandardMaterial color={roof} roughness={0.7} flatShading /></mesh>
      <mesh position={[0, 0.45, 0.76]}><planeGeometry args={[0.45, 0.9]} /><meshStandardMaterial color="#8A5A34" /></mesh>
      {[-0.5, 0.5].map((wx) => <mesh key={wx} position={[wx, 0.95, 0.76]}><planeGeometry args={[0.32, 0.32]} /><meshStandardMaterial color="#FFF3B0" emissive="#FFE28A" emissiveIntensity={0.5} /></mesh>)}
      <mesh position={[0.45, 2.1, -0.2]}><boxGeometry args={[0.22, 0.6, 0.22]} /><meshStandardMaterial color="#C9C3B8" /></mesh>
    </group>
  );
}

function VillageBody() {
  return (
    <group>
      <House x={0} z={-0.6} rot={0} wall="#FFF1DC" roof="#FF7A59" s={1.25} />
      <House x={-2.3} z={0.4} rot={0.6} wall="#E6F2FF" roof="#2E6BFF" />
      <House x={2.3} z={0.4} rot={-0.6} wall="#FFE9F1" roof="#8A5CF6" />
      {/* well */}
      <group position={[1.1, 0, 2.1]}>
        <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.45, 0.5, 0.6, 16, 1, true]} /><meshStandardMaterial {...stone} side={2} /></mesh>
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.42, 16]} /><meshStandardMaterial color="#2E6BFF" /></mesh>
        {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, 0.85, 0]}><cylinderGeometry args={[0.04, 0.04, 0.9, 6]} /><meshStandardMaterial {...wood} /></mesh>)}
        <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.65, 0.4, 4]} /><meshStandardMaterial color="#FF7A59" flatShading /></mesh>
      </group>
      {/* fence */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = -1.1 + i * 0.275;
        return <mesh key={i} position={[Math.sin(a) * 3.6, 0.3, Math.cos(a) * 3.6 - 1.4]} castShadow><boxGeometry args={[0.12, 0.6, 0.12]} /><meshStandardMaterial color="#FFFFFF" roughness={0.7} /></mesh>;
      })}
    </group>
  );
}

/** A small academy: a house with a giant glowing light bulb on the roof and an open book at the door. */
function SmarterBody({ def }: { def: PortalDef }) {
  const bulb = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const m = bulb.current;
    if (m) (m.material as MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 2) * 0.35;
  });
  return (
    <group>
      <House x={0} z={-0.4} rot={0} wall="#FFF6DD" roof={def.dark} s={1.35} />
      <group position={[0, 3.35, -0.4]}>
        <mesh ref={bulb} position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.62, 24, 18]} /><meshStandardMaterial color="#FFF3B0" emissive={def.color} emissiveIntensity={1} roughness={0.2} /></mesh>
        <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.3, 0.26, 0.4, 16]} /><meshStandardMaterial color="#9AA3B5" metalness={0.6} roughness={0.35} /></mesh>
      </group>
      {/* open book at the door */}
      <group position={[0, 0.25, 1.9]} rotation={[-0.5, 0, 0]}>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.36, 0, 0]} rotation={[0, 0, sd * 0.12]} castShadow><boxGeometry args={[0.7, 0.06, 0.9]} /><meshStandardMaterial color="#FFFFFF" roughness={0.8} /></mesh>)}
        <mesh position={[0, -0.05, 0]}><boxGeometry args={[1.5, 0.05, 0.96]} /><meshStandardMaterial color={def.color} roughness={0.6} /></mesh>
      </group>
    </group>
  );
}

/** A tower of toy letter blocks and a giant magnifying glass that slowly sways over it. */
function PuzzlesBody({ def }: { def: PortalDef }) {
  const glass = useRef<Group>(null);
  useFrame(({ clock }) => { if (glass.current) glass.current.rotation.z = -0.5 + Math.sin(clock.elapsedTime * 0.8) * 0.12; });
  const blocks: [number, number, number, string, number][] = [
    [-1.1, 0.45, 0, '#FFB930', 0.2], [0, 0.45, 0.1, '#2E6BFF', -0.1], [1.1, 0.45, -0.1, '#1FC690', 0.15],
    [-0.55, 1.35, 0, def.color, -0.2], [0.55, 1.35, 0.05, '#8A5CF6', 0.1], [0, 2.25, 0, '#FF7A59', 0.3],
  ];
  return (
    <group>
      {blocks.map(([x, y, z, color, rot], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, rot, 0]}>
          <mesh castShadow receiveShadow><boxGeometry args={[0.9, 0.9, 0.9]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>
          {/* a raised square on the front, like the letter face of a toy block */}
          <mesh position={[0, 0, 0.46]}><boxGeometry args={[0.56, 0.56, 0.04]} /><meshStandardMaterial color="#FFFFFF" roughness={0.6} /></mesh>
        </group>
      ))}
      <group ref={glass} position={[1.7, 2.3, 0.8]}>
        <mesh><torusGeometry args={[0.62, 0.11, 12, 32]} /><meshStandardMaterial color={def.dark} roughness={0.4} metalness={0.3} /></mesh>
        <mesh><circleGeometry args={[0.55, 28]} /><meshStandardMaterial color="#CFEFFF" transparent opacity={0.45} roughness={0.05} side={2} /></mesh>
        <mesh position={[0, -1.05, 0]}><cylinderGeometry args={[0.1, 0.12, 0.9, 10]} /><meshStandardMaterial {...wood} /></mesh>
      </group>
    </group>
  );
}

/** A cozy night tent under a glowing crescent moon, with a few stars bobbing above it. */
function StoryBody({ def }: { def: PortalDef }) {
  const stars = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = stars.current;
    if (!g) return;
    g.children.forEach((c, i) => { c.position.y = 3.6 + i * 0.35 + Math.sin(clock.elapsedTime * 1.2 + i * 1.7) * 0.18; c.rotation.y += 0.01; });
  });
  return (
    <group>
      {/* tent */}
      <mesh position={[0, 1.3, -0.3]} castShadow receiveShadow><coneGeometry args={[2.1, 2.6, 8]} /><meshStandardMaterial color={def.dark} roughness={0.8} flatShading /></mesh>
      <mesh position={[0, 0.25, -0.3]} castShadow><cylinderGeometry args={[2.1, 2.1, 0.5, 8]} /><meshStandardMaterial color={def.color} roughness={0.8} flatShading /></mesh>
      {/* warm doorway */}
      <mesh position={[0, 0.75, 1.55]} rotation={[-0.28, 0, 0]}><circleGeometry args={[0.62, 20, 0, Math.PI]} /><meshStandardMaterial color="#FFD27A" emissive="#FFB84D" emissiveIntensity={1.1} /></mesh>
      <mesh position={[0, 0.45, 1.62]}><planeGeometry args={[1.24, 0.6]} /><meshStandardMaterial color="#FFD27A" emissive="#FFB84D" emissiveIntensity={1.1} /></mesh>
      {/* pole with crescent moon */}
      <mesh position={[1.9, 1.7, 0.9]}><cylinderGeometry args={[0.05, 0.05, 3.4, 8]} /><meshStandardMaterial {...wood} /></mesh>
      <mesh position={[1.9, 3.75, 0.9]} rotation={[0, 0, 0.9]}>
        <torusGeometry args={[0.55, 0.16, 12, 32, Math.PI * 1.25]} /><meshStandardMaterial color="#FFE38A" emissive="#FFD34D" emissiveIntensity={1.3} roughness={0.4} />
      </mesh>
      <group ref={stars}>
        {[[-1.4, 0.2], [0.3, -0.6], [-0.4, 0.9]].map(([x, z], i) => (
          <mesh key={i} position={[x, 3.6, z]} scale={0.22}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#FFF6C8" emissive="#FFE680" emissiveIntensity={1.4} /></mesh>
        ))}
      </group>
      {/* pillows by the door */}
      {[-1.2, 1.2].map((x) => <mesh key={x} position={[x, 0.2, 1.9]} scale={[0.5, 0.25, 0.4]} castShadow><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color={x < 0 ? '#FF9EC1' : '#9EC5FF'} roughness={0.9} /></mesh>)}
    </group>
  );
}

function pawnGeometry() {
  const pts = [[0, 0], [0.95, 0], [0.95, 0.2], [0.7, 0.35], [0.5, 0.5], [0.38, 1.3], [0.6, 1.45], [0.35, 1.6], [0.5, 1.95], [0.3, 2.3], [0, 2.35]];
  return new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), 32);
}

function ArenaBody({ def }: { def: PortalDef }) {
  const pawn = useMemo(pawnGeometry, []);
  const ring = useRef<Group>(null);
  useFrame((_, dt) => { if (ring.current) ring.current.rotation.y += dt * 0.25; });
  return (
    <group>
      {/* checkered platform */}
      {Array.from({ length: 16 }, (_, i) => {
        const cx = (i % 4) - 1.5, cz = Math.floor(i / 4) - 1.5;
        return <mesh key={i} position={[cx * 1.05, 0.15, cz * 1.05]} receiveShadow castShadow><boxGeometry args={[1.05, 0.3, 1.05]} /><meshStandardMaterial color={(i + Math.floor(i / 4)) % 2 ? '#FFFFFF' : def.dark} roughness={0.6} /></mesh>;
      })}
      <mesh geometry={pawn} position={[-0.8, 0.3, -0.4]} scale={1.1} castShadow><meshStandardMaterial color={def.color} roughness={0.35} metalness={0.1} /></mesh>
      {/* rook */}
      <group position={[1.1, 0.3, -0.2]}>
        <mesh position={[0, 0.9, 0]} castShadow><cylinderGeometry args={[0.55, 0.75, 1.8, 24]} /><meshStandardMaterial color="#FFB930" roughness={0.35} /></mesh>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2;
          return <mesh key={i} position={[Math.sin(a) * 0.42, 1.95, Math.cos(a) * 0.42]} castShadow><boxGeometry args={[0.28, 0.3, 0.28]} /><meshStandardMaterial color="#FFB930" roughness={0.35} /></mesh>;
        })}
      </group>
      {/* rotating ring of stars */}
      <group ref={ring} position={[0, 3.4, 0]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <mesh key={i} position={[Math.sin(a) * 1.6, Math.sin(a * 2) * 0.2, Math.cos(a) * 1.6]}><octahedronGeometry args={[0.18, 0]} /><meshStandardMaterial color="#FFE680" emissive="#FFB930" emissiveIntensity={1.2} /></mesh>;
        })}
      </group>
    </group>
  );
}

/** Entry pad in front of the landmark. Glows and pulses when the child stands on it. */
function Pad({ def }: { def: PortalDef }) {
  const near = useApp((s) => s.nearPortal === def.id);
  const ring = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z += dt * (near ? 1.6 : 0.4);
      const s = near ? 1.08 + Math.sin(t * 5) * 0.05 : 1;
      ring.current.scale.set(s, s, s);
      (ring.current.material as MeshStandardMaterial).emissiveIntensity = near ? 1.6 : 0.5;
    }
    if (beam.current) {
      const m = beam.current.material as MeshStandardMaterial;
      m.opacity += ((near ? 0.28 : 0) - m.opacity) * Math.min(1, dt * 6);
      beam.current.visible = m.opacity > 0.01;
    }
  });
  return (
    <group position={[0, 0.06, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.9, 40]} /><meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.45, 1.75, 6, 1]} /><meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={beam} position={[0, 2.2, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 4.4, 32, 1, true]} /><meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={1} transparent opacity={0} depthWrite={false} side={2} />
      </mesh>
      <Sparkles count={near ? 40 : 14} scale={[3.4, 2.6, 3.4]} position={[0, 1.3, 0]} size={near ? 6 : 3} speed={0.6} color={def.color} />
    </group>
  );
}

const SIGN_Y: Record<string, number> = { mines: 5.4, library: 5.9, lab: 5.0, village: 4.2, arena: 4.8, story: 5.6, puzzles: 5.4, smarter: 6.0 };

function Landmark({ def }: { def: PortalDef }) {
  const pos = portalPos(def);
  const Icon = def.icon;
  const y = groundHeight(pos.x, pos.z);
  return (
    <group position={[pos.x, y, pos.z]} rotation={[0, def.angle + Math.PI, 0]}>
      <Pad def={def} />
      <group position={[0, 0, BODY_Z]}>
        {def.id === 'mines' && <MinesBody def={def} />}
        {def.id === 'library' && <LibraryBody />}
        {def.id === 'lab' && <LabBody def={def} />}
        {def.id === 'village' && <VillageBody />}
        {def.id === 'arena' && <ArenaBody def={def} />}
        {def.id === 'story' && <StoryBody def={def} />}
        {def.id === 'puzzles' && <PuzzlesBody def={def} />}
        {def.id === 'smarter' && <SmarterBody def={def} />}
      </group>
      <Html position={[0, SIGN_Y[def.id], BODY_Z]} center distanceFactor={17} zIndexRange={[5, 0]} pointerEvents="none">
        <div className="sign" style={{ ['--sign' as string]: def.color }}><Icon className="icon" /> {def.name}</div>
      </Html>
    </group>
  );
}

export function Landmarks() {
  useLayoutEffect(() => {
    setObstacles('landmarks', PORTALS.map((p) => {
      const pos = portalPos(p);
      const k = (14 - BODY_Z) / 14;
      return [pos.x * k, pos.z * k, BODY_R[p.id]] as [number, number, number];
    }));
  }, []);
  return <>{PORTALS.map((p) => <Landmark key={p.id} def={p} />)}</>;
}
