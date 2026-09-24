import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Outlines, Sky } from '@react-three/drei';
import { Vector3, type Group, type Mesh } from 'three';
import { Avatar } from './Avatar';
import { input, keyVector } from './controls';
import { useApp, type WorldId } from '../core/store';
import { PORTALS, portalPos, type PortalDef } from './portals';
import { makeRng } from '../core/rng';
import { COLLECTIBLES } from '../economy/economy';

const INK = '#111014';
const ISLAND_R = 21;


// Static obstacles: [x, z, radius]
const obstacles: [number, number, number][] = [];

function Island() {
  return (
    <group>
      <mesh position={[0, -60, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[400, 48]} />
        <meshToonMaterial color="#3DB8F5" />
      </mesh>
      <mesh position={[0, -0.9, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_R + 2.5, ISLAND_R + 4, 1.6, 48]} />
        <meshToonMaterial color="#FFE7A8" />
      </mesh>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R + 1.2, 0.5, 48]} />
        <meshToonMaterial color="#7ED957" />
        <Outlines thickness={0.08} color={INK} />
      </mesh>
      <mesh position={[0, -1.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ISLAND_R + 4, 120, 64]} />
        <meshToonMaterial color="#5CC8FF" transparent opacity={0.85} />
      </mesh>
      {/* paths from the center to each portal */}
      {PORTALS.map((p) => (
        <mesh key={p.id} position={[Math.sin(p.angle) * 7.5, 0.01, Math.cos(p.angle) * 7.5]} rotation={[-Math.PI / 2, 0, -p.angle]}>
          <planeGeometry args={[2.2, 11]} />
          <meshToonMaterial color="#F4D58D" />
        </mesh>
      ))}
    </group>
  );
}

function Trees() {
  const trees = useMemo(() => {
    const rng = makeRng(42);
    const out: { x: number; z: number; s: number; c: string }[] = [];
    while (out.length < 26) {
      const a = rng() * Math.PI * 2;
      const r = 8.5 + rng() * (ISLAND_R - 10);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const nearPortal = PORTALS.some((p) => {
        const pp = portalPos(p);
        return Math.hypot(pp.x - x, pp.z - z) < 4.5 || Math.abs(Math.atan2(Math.sin(a - p.angle), Math.cos(a - p.angle))) < 0.3;
      });
      if (nearPortal || (z > 2 && Math.abs(x) < 7)) continue;
      out.push({ x, z, s: 0.8 + rng() * 0.7, c: ['#2FA84F', '#45C065', '#1E8E3E'][Math.floor(rng() * 3)] });
    }
    obstacles.length = 0;
    out.forEach((t) => obstacles.push([t.x, t.z, 0.6 * t.s]));
    return out;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.18, 0.25, 1.2, 8]} /><meshToonMaterial color="#8B5A2B" /></mesh>
          <mesh position={[0, 1.8, 0]} castShadow><coneGeometry args={[1, 2, 8]} /><meshToonMaterial color={t.c} /><Outlines thickness={0.04} color={INK} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** The Thinking Tree grows with every mastered topic - progress that can never be lost. */
function ThinkingTree({ mastered, collectibles }: { mastered: number; collectibles: string[] }) {
  const grow = 1 + Math.min(mastered, 13) * 0.07;
  const flowers = useMemo(() => {
    const rng = makeRng(7);
    return Array.from({ length: 13 }, () => {
      const a = rng() * Math.PI * 2, y = 3 + rng() * 2.2, r = 1.2 + rng() * 0.9;
      return [Math.sin(a) * r, y, Math.cos(a) * r] as [number, number, number];
    });
  }, []);
  const colors = ['#FF3D7F', '#FFC02E', '#FFFFFF', '#FF8A00', '#8B5CF6'];
  return (
    <group scale={grow}>
      <mesh position={[0, 1.4, 0]} castShadow><cylinderGeometry args={[0.45, 0.7, 2.8, 10]} /><meshToonMaterial color="#9B6B3F" /><Outlines thickness={0.05} color={INK} /></mesh>
      <mesh position={[0, 3.9, 0]} castShadow><sphereGeometry args={[2.1, 20, 16]} /><meshToonMaterial color="#35C46B" /><Outlines thickness={0.06} color={INK} /></mesh>
      <mesh position={[1.2, 3.4, 0.6]} castShadow><sphereGeometry args={[1.2, 16, 12]} /><meshToonMaterial color="#45D07A" /></mesh>
      <mesh position={[-1.1, 3.5, -0.4]} castShadow><sphereGeometry args={[1.3, 16, 12]} /><meshToonMaterial color="#2DB35F" /></mesh>
      {flowers.slice(0, mastered).map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.22, 10, 8]} /><meshToonMaterial color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.25} /></mesh>
      ))}
      <Html position={[0, 6.6, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <div className="sign sign-tree">🌳 עץ החשיבה</div>
      </Html>
      {collectibles.map((id, i) => {
        const c = COLLECTIBLES.find((x) => x.id === id);
        if (!c) return null;
        const a = (i / Math.max(collectibles.length, 1)) * Math.PI * 2;
        return (
          <Html key={id} position={[Math.sin(a) * 3, 0.6, Math.cos(a) * 3]} center distanceFactor={12} zIndexRange={[4, 0]}>
            <div className="collectible" title={c.name}>{c.emoji}</div>
          </Html>
        );
      })}
    </group>
  );
}

function Portal({ def }: { def: PortalDef }) {
  const ring = useRef<Mesh>(null);
  const pos = portalPos(def);
  useFrame((_, dt) => { if (ring.current && def.open) ring.current.rotation.z += dt * 0.8; });
  return (
    <group position={pos} rotation={[0, def.angle + Math.PI, 0]}>
      {def.id === 'mines' ? (
        <group position={[0, 0, -1.2]}>
          <mesh position={[0, 1.1, -0.6]} castShadow><dodecahedronGeometry args={[2.8, 0]} /><meshToonMaterial color="#8C7B6B" /><Outlines thickness={0.06} color={INK} /></mesh>
          <mesh position={[0, 1.2, 1.25]}><boxGeometry args={[2, 2.4, 0.2]} /><meshBasicMaterial color="#1a1208" /></mesh>
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} position={[x, 1.25, 1.4]} castShadow><boxGeometry args={[0.28, 2.6, 0.28]} /><meshToonMaterial color="#9B6B3F" /><Outlines thickness={0.03} color={INK} /></mesh>
          ))}
          <mesh position={[0, 2.6, 1.4]} castShadow><boxGeometry args={[2.6, 0.3, 0.32]} /><meshToonMaterial color="#9B6B3F" /><Outlines thickness={0.03} color={INK} /></mesh>
          <pointLight position={[0, 1.2, 1.8]} color="#FFC02E" intensity={6} distance={6} />
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, 0.03, 2.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, 3]} /><meshBasicMaterial color="#555" /></mesh>
          ))}
        </group>
      ) : (
        <group>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 1.3, 0]} castShadow><boxGeometry args={[0.6, 2.6, 0.6]} /><meshToonMaterial color="#D9D2C5" /><Outlines thickness={0.04} color={INK} /></mesh>
          ))}
          <mesh position={[0, 2.8, 0]} castShadow><boxGeometry args={[3.4, 0.5, 0.7]} /><meshToonMaterial color="#D9D2C5" /><Outlines thickness={0.04} color={INK} /></mesh>
          <mesh ref={ring} position={[0, 1.35, 0]}>
            <circleGeometry args={[1.0, 32]} />
            <meshToonMaterial color={def.color} transparent opacity={0.35} />
          </mesh>
        </group>
      )}
      <Html position={[0, def.id === 'mines' ? 4.9 : 3.8, 0]} center distanceFactor={17} zIndexRange={[5, 0]}>
        <div className="sign" style={{ ['--sign' as string]: def.color }}>
          {def.emoji} {def.name}{!def.open && <span className="soon"> 🔒 בקרוב</span>}
        </div>
      </Html>
    </group>
  );
}

const tmp = new Vector3();
const camTarget = new Vector3();
const CAM_OFFSET = new Vector3(0, 8.5, 10.5);
const SPEED = 6;

function Player({ color, hat, start }: { color: string; hat: string; start: Vector3 }) {
  const ref = useRef<Group>(null);
  const vel = useRef(new Vector3());
  const setNearPortal = useApp((s) => s.setNearPortal);
  const positioned = useRef(false);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!positioned.current) { g.position.copy(start); positioned.current = true; }
    const tp = (window as unknown as { __teleport?: [number, number] }).__teleport;
    if (tp) { g.position.set(tp[0], 0, tp[1]); (window as unknown as { __teleport?: unknown }).__teleport = undefined; }
    dt = Math.min(dt, 0.05);
    const [kx, kz] = keyVector();
    let x = kx + input.x, z = kz + input.z;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    vel.current.lerp(tmp.set(x * SPEED, 0, z * SPEED), 1 - Math.exp(-dt * 12));
    const next = g.position.clone().addScaledVector(vel.current, dt);

    // Keep on the island and out of trees / tree of thinking / portals.
    const r = Math.hypot(next.x, next.z);
    if (r > ISLAND_R - 1) next.multiplyScalar((ISLAND_R - 1) / r);
    const solids: [number, number, number][] = [...obstacles, [0, 0, 1.6]];
    for (const p of PORTALS) {
      const pp = portalPos(p);
      solids.push([pp.x * 1.1, pp.z * 1.1, p.id === 'mines' ? 2.6 : 1.2]);
    }
    for (const [ox, oz, or] of solids) {
      const dx = next.x - ox, dz = next.z - oz;
      const d = Math.hypot(dx, dz);
      const min = or + 0.45;
      if (d < min && d > 0.0001) { next.x = ox + (dx / d) * min; next.z = oz + (dz / d) * min; }
    }
    g.position.copy(next);

    const speed = vel.current.length();
    if (speed > 0.3) {
      const targetYaw = Math.atan2(vel.current.x, vel.current.z);
      const dy = Math.atan2(Math.sin(targetYaw - g.rotation.y), Math.cos(targetYaw - g.rotation.y));
      g.rotation.y += dy * Math.min(1, dt * 12);
    }
    const body = g.getObjectByName('body');
    if (body) body.position.y = speed > 0.3 ? Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.12 : 0;

    // Portrait phones see a narrow slice of the world, so pull the camera back.
    const aspect = state.size.width / Math.max(1, state.size.height);
    camTarget.copy(g.position).addScaledVector(CAM_OFFSET, aspect < 0.8 ? 1.45 : 1);
    state.camera.position.lerp(camTarget, 1 - Math.exp(-dt * 4));
    state.camera.lookAt(g.position.x, g.position.y + 1.2, g.position.z);

    let near: WorldId | null = null;
    for (const p of PORTALS) {
      if (g.position.distanceTo(portalPos(p)) < 3.6) near = p.id;
    }
    setNearPortal(near);
    playerPos.copy(g.position);
  });

  return <Avatar ref={ref} color={color} hat={hat} />;
}

/** Last known player position, so returning from a world puts the child back at the portal. */
export const playerPos = new Vector3(0, 0, 6);

export function WorldCanvas({ color, hat, mastered, collectibles, active }: { color: string; hat: string; mastered: number; collectibles: string[]; active: boolean }) {
  const start = useMemo(() => playerPos.clone(), []);
  return (
    <Canvas frameloop={active ? 'always' : 'never'} shadows dpr={[1, 1.75]} camera={{ position: [0, 9, 17], fov: 50 }} gl={{ antialias: true }}>
      <Sky sunPosition={[40, 30, 20]} turbidity={3} rayleigh={0.6} />
      <hemisphereLight args={['#fff6e0', '#7ED957', 0.9]} />
      <directionalLight position={[15, 25, 10]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26} />
      <fog attach="fog" args={['#bfe8ff', 45, 110]} />
      <Island />
      <Trees />
      <ThinkingTree mastered={mastered} collectibles={collectibles} />
      {PORTALS.map((p) => <Portal key={p.id} def={p} />)}
      <Player color={color} hat={hat} start={start} />
    </Canvas>
  );
}
