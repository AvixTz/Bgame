import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Sky } from '@react-three/drei';
import { TreeDeciduous } from 'lucide-react';
import { Vector3, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { Avatar } from './Avatar';
import { moveVector } from './controls';
import { useApp, type WorldId } from '../core/store';
import { PORTALS, portalPos } from './portals';
import { ISLAND_R, groundHeight } from './terrain';
import { obstacles, setObstacles } from './obstacles';
import { Butterflies, Clouds, Island, Paths, Sea, Vegetation } from './Nature';
import { Landmarks } from './Landmarks';
import { makeRng } from '../core/rng';
import { COLLECTIBLES } from '../economy/economy';

/** The Thinking Tree grows and blossoms with every mastered topic - progress that can never be lost. */
function ThinkingTree({ mastered, collectibles }: { mastered: number; collectibles: string[] }) {
  const grow = 1 + Math.min(mastered, 20) * 0.04;
  const blossoms = useMemo(() => {
    const rng = makeRng(7);
    return Array.from({ length: 20 }, () => {
      const a = rng() * Math.PI * 2, y = 3.3 + rng() * 2.2, r = 1.5 + rng() * 0.8;
      return [Math.sin(a) * r, y, Math.cos(a) * r] as [number, number, number];
    });
  }, []);
  const colors = ['#FF4F8B', '#FFB930', '#FFFFFF', '#FF7A59', '#8A5CF6'];
  const crown = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.z = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });
  useLayoutEffect(() => { setObstacles('tree', [[0, 0, 1.4 * grow]]); }, [grow]);
  return (
    <group scale={grow}>
      <mesh position={[0, 1.5, 0]} castShadow><cylinderGeometry args={[0.42, 0.75, 3, 10]} /><meshStandardMaterial color="#9A6B45" roughness={0.9} /></mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.7, 0.18, Math.cos(a) * 0.7]} rotation={[0, a, 0.9]} castShadow><cylinderGeometry args={[0.1, 0.22, 1, 6]} /><meshStandardMaterial color="#8A5C39" roughness={0.9} /></mesh>
      ))}
      <group ref={crown} position={[0, 0, 0]}>
        {[[0, 4.2, 0, 2.2], [1.4, 3.6, 0.6, 1.3], [-1.3, 3.7, -0.4, 1.4], [0.3, 3.5, -1.3, 1.2], [-0.4, 5.3, 0.3, 1.3]].map(([x, y, z, s], i) => (
          <mesh key={i} position={[x, y, z]} scale={s} castShadow>
            <icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color={['#3FBF63', '#55CC6E', '#34B058', '#62D477', '#4BC66A'][i]} roughness={0.75} flatShading />
          </mesh>
        ))}
        {blossoms.slice(0, mastered).map((p, i) => (
          <mesh key={i} position={p}><icosahedronGeometry args={[0.26, 1]} /><meshStandardMaterial color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.45} /></mesh>
        ))}
      </group>
      <Html position={[0, 7.4, 0]} center distanceFactor={14} zIndexRange={[5, 0]} pointerEvents="none">
        <div className="sign sign-tree"><TreeDeciduous className="icon" /> עץ החשיבה</div>
      </Html>
      {collectibles.map((id, i) => {
        const c = COLLECTIBLES.find((x) => x.id === id);
        if (!c) return null;
        const a = (i / Math.max(collectibles.length, 1)) * Math.PI * 2;
        return (
          <Html key={id} position={[Math.sin(a) * 2.8, 0.7, Math.cos(a) * 2.8]} center distanceFactor={12} zIndexRange={[4, 0]} pointerEvents="none">
            <div className="collectible" title={c.name}>{c.emoji}</div>
          </Html>
        );
      })}
    </group>
  );
}

/** Small dust puffs behind the avatar's feet while walking. */
const DUST = 10;
function useDust() {
  const refs = useRef<(Mesh | null)[]>([]);
  const life = useRef(Array.from({ length: DUST }, () => 0));
  const next = useRef(0);
  const timer = useRef(0);
  const spawn = (x: number, y: number, z: number) => {
    const i = next.current++ % DUST;
    const m = refs.current[i];
    if (!m) return;
    m.position.set(x + (Math.random() - 0.5) * 0.3, y + 0.1, z + (Math.random() - 0.5) * 0.3);
    life.current[i] = 1;
  };
  const update = (dt: number, moving: boolean, x: number, y: number, z: number, speed: number) => {
    timer.current += dt;
    if (moving && speed > 2 && timer.current > 0.12) { timer.current = 0; spawn(x, y, z); }
    refs.current.forEach((m, i) => {
      if (!m) return;
      const l = (life.current[i] = Math.max(0, life.current[i] - dt * 1.8));
      m.visible = l > 0;
      m.scale.setScalar(0.12 + (1 - l) * 0.25);
      m.position.y += dt * 0.35;
      (m.material as MeshStandardMaterial).opacity = l * 0.55;
    });
  };
  const nodes = Array.from({ length: DUST }, (_, i) => (
    <mesh key={i} ref={(el) => { refs.current[i] = el; }} visible={false}>
      <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#F3E7CC" transparent opacity={0} depthWrite={false} />
    </mesh>
  ));
  return { update, nodes };
}

const tmp = new Vector3();
const camTarget = new Vector3();
const lookTarget = new Vector3();
const lookSmooth = new Vector3(0, 1.2, 6);
const CAM_OFFSET = new Vector3(0, 7.8, 10.2);
/** Portrait phones: higher and steeper, so trees in front of the camera do not hide the avatar. */
const CAM_OFFSET_PORTRAIT = new Vector3(0, 14, 10.5);
const SPEED = 6;

function Player({ color, hat, start }: { color: string; hat: string; start: Vector3 }) {
  const ref = useRef<Group>(null);
  const vel = useRef(new Vector3());
  const setNearPortal = useApp((s) => s.setNearPortal);
  const positioned = useRef(false);
  const walkPhase = useRef(0);
  const blink = useRef(2);
  const dust = useDust();

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    if (!positioned.current) { g.position.copy(start); positioned.current = true; }
    const tp = (window as unknown as { __teleport?: [number, number] }).__teleport;
    if (tp) { g.position.set(tp[0], 0, tp[1]); (window as unknown as { __teleport?: unknown }).__teleport = undefined; }
    dt = Math.min(dt, 0.05);
    const [x, z] = moveVector();
    const moving = x !== 0 || z !== 0;
    // Accelerate smoothly, but stop quickly when input ends so the avatar never drifts on its own.
    if (moving) vel.current.lerp(tmp.set(x * SPEED, 0, z * SPEED), 1 - Math.exp(-dt * 12));
    // Released: brake hard on every frame, independent of frame rate, so a slow device never slides.
    else vel.current.multiplyScalar(Math.min(Math.exp(-dt * 25), 0.35));
    if (!moving && vel.current.lengthSq() < 0.01) vel.current.set(0, 0, 0);
    const next = g.position.clone().addScaledVector(vel.current, dt);

    const r = Math.hypot(next.x, next.z);
    if (r > ISLAND_R - 1) { next.x *= (ISLAND_R - 1) / r; next.z *= (ISLAND_R - 1) / r; }
    for (const [ox, oz, or] of obstacles) {
      const dx = next.x - ox, dz = next.z - oz;
      const d = Math.hypot(dx, dz);
      const min = or + 0.45;
      if (d < min && d > 0.0001) { next.x = ox + (dx / d) * min; next.z = oz + (dz / d) * min; }
    }
    // Follow the hills smoothly.
    const gy = groundHeight(next.x, next.z);
    next.y = g.position.y + (gy - g.position.y) * Math.min(1, dt * 14);
    g.position.copy(next);

    const speed = vel.current.length();
    if (speed > 0.3) {
      const targetYaw = Math.atan2(vel.current.x, vel.current.z);
      const dy = Math.atan2(Math.sin(targetYaw - g.rotation.y), Math.cos(targetYaw - g.rotation.y));
      g.rotation.y += dy * Math.min(1, dt * 12);
    }

    // Walk cycle: limbs swing with speed, the body bobs, eyes blink now and then.
    const k = Math.min(1, speed / SPEED);
    walkPhase.current += dt * (4 + speed * 1.6);
    const sw = Math.sin(walkPhase.current) * 0.75 * k;
    const legL = g.getObjectByName('legL'), legR = g.getObjectByName('legR');
    const armL = g.getObjectByName('armL'), armR = g.getObjectByName('armR');
    const body = g.getObjectByName('body'), eyes = g.getObjectByName('eyes');
    if (legL) legL.rotation.x = sw;
    if (legR) legR.rotation.x = -sw;
    if (armL) { armL.rotation.x = -sw * 0.9; armL.rotation.z = 0.12 + (1 - k) * Math.sin(state.clock.elapsedTime * 1.6) * 0.05; }
    if (armR) { armR.rotation.x = sw * 0.9; armR.rotation.z = -0.12; }
    if (body) {
      body.position.y = Math.abs(Math.cos(walkPhase.current)) * 0.09 * k + (1 - k) * Math.sin(state.clock.elapsedTime * 2) * 0.02;
      body.rotation.z = Math.sin(walkPhase.current) * 0.04 * k;
    }
    blink.current -= dt;
    if (eyes) eyes.scale.y = blink.current < 0.12 ? 0.15 : 1;
    if (blink.current < 0) blink.current = 2 + Math.random() * 3;
    dust.update(dt, moving, g.position.x, g.position.y, g.position.z, speed);

    // Camera: follow with a little look-ahead; portrait phones see a narrow slice, so pull back.
    const aspect = state.size.width / Math.max(1, state.size.height);
    camTarget.copy(g.position).add(aspect < 0.8 ? CAM_OFFSET_PORTRAIT : CAM_OFFSET);
    state.camera.position.lerp(camTarget, 1 - Math.exp(-dt * 4));
    lookTarget.set(g.position.x + vel.current.x * 0.18, g.position.y + 1.2, g.position.z + vel.current.z * 0.18);
    lookSmooth.lerp(lookTarget, 1 - Math.exp(-dt * 6));
    state.camera.lookAt(lookSmooth);

    let near: WorldId | null = null;
    for (const p of PORTALS) {
      const pp = portalPos(p);
      if (Math.hypot(g.position.x - pp.x, g.position.z - pp.z) < 3.6) near = p.id;
    }
    setNearPortal(near);
    playerPos.copy(g.position);
  });

  return (
    <>
      <Avatar ref={ref} color={color} hat={hat} />
      {dust.nodes}
    </>
  );
}

/** Last known player position, so returning from a world puts the child back at the portal. */
export const playerPos = new Vector3(0, 0, 6);
// Read-only hook for automated playtests (movement/drift checks).
(window as unknown as { __bgamePos?: Vector3 }).__bgamePos = playerPos;

export function WorldCanvas({ color, hat, mastered, collectibles, active }: { color: string; hat: string; mastered: number; collectibles: string[]; active: boolean }) {
  const start = useMemo(() => playerPos.clone(), []);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 9, 17], fov: 48, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.05; }}
    >
      <Sky sunPosition={[60, 38, 25]} turbidity={2.2} rayleigh={0.9} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <fog attach="fog" args={['#CFE9FF', 60, 160]} />
      <hemisphereLight args={['#DDEEFF', '#6CCB5F', 0.85]} />
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[18, 26, 12]} intensity={2.3} color="#FFF3DC" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-camera-far={80}
      />
      <directionalLight position={[-16, 10, -20]} intensity={0.5} color="#B8D6FF" />
      <Sea />
      <Island />
      <Paths />
      <Vegetation />
      <Clouds />
      <Butterflies />
      <ThinkingTree mastered={mastered} collectibles={collectibles} />
      <Landmarks />
      <Player color={color} hat={hat} start={start} />
    </Canvas>
  );
}
