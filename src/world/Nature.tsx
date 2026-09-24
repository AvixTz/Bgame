import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute, Color, DoubleSide, InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial, type Group,
} from 'three';
import { ISLAND_R, groundHeight, hilliness } from './terrain';
import { PORTALS, portalPos } from './portals';
import { makeRng } from '../core/rng';
import { setObstacles } from './obstacles';

const WATER_Y = -0.35;

// ---------------- sea ----------------

const waterVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vXZ;
  varying float vWave;
  void main() {
    vec3 p = position;
    vec2 xz = vec2(p.x, -p.y);
    float w = sin(xz.x * 0.22 + uTime * 0.9) * 0.1 + cos(xz.y * 0.27 + uTime * 1.15) * 0.09;
    p.z += w;
    vWave = w;
    vXZ = xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform float uR;
  varying vec2 vXZ;
  varying float vWave;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float r = length(vXZ);
    vec3 shallow = vec3(0.36, 0.88, 0.86);
    vec3 deep = vec3(0.13, 0.5, 0.92);
    vec3 far = vec3(0.66, 0.84, 0.99);
    float t = smoothstep(uR + 1.0, uR + 15.0, r);
    vec3 c = mix(shallow, deep, t);
    float edge = uR + 2.1 + sin(uTime * 1.3 + atan(vXZ.y, vXZ.x) * 7.0) * 0.28;
    float foam = smoothstep(0.6, 0.0, abs(r - edge));
    float foam2 = smoothstep(0.35, 0.0, abs(r - edge - 1.2 - sin(uTime * 0.8) * 0.4)) * 0.5;
    c = mix(c, vec3(1.0), clamp(foam + foam2, 0.0, 1.0) * 0.85);
    float sp = step(0.992, hash(floor(vXZ * 1.6) + floor(uTime * 1.5)));
    c += sp * 0.35 * (1.0 - t * 0.4);
    c += vWave * 0.35;
    c = mix(c, far, smoothstep(45.0, 120.0, r));
    gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Sea() {
  const mat = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uR: { value: ISLAND_R } },
    vertexShader: waterVert,
    fragmentShader: waterFrag,
  }), []);
  useFrame((_, dt) => { mat.uniforms.uTime.value += dt; });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} material={mat}>
      <planeGeometry args={[280, 280, 140, 140]} />
    </mesh>
  );
}

// ---------------- island ground ----------------

const C_GRASS_L = new Color('#A6E86A');
const C_GRASS_D = new Color('#56B94A');
const C_PLAZA = new Color('#F1E4C6');
const C_SAND = new Color('#F6DFA2');
const C_WET = new Color('#D8BE7E');

export function Island() {
  const geo = useMemo(() => {
    const size = (ISLAND_R + 6) * 2;
    const g = new PlaneGeometry(size, size, 150, 150);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      const y = groundHeight(x, z);
      pos.setY(i, y);
      const n = 0.5 + 0.5 * Math.sin(x * 0.9 + Math.cos(z * 0.7) * 2) * Math.cos(z * 0.8 - x * 0.3);
      c.copy(C_GRASS_D).lerp(C_GRASS_L, n * 0.8 + Math.min(y, 1) * 0.25);
      if (r < 4.2) c.lerp(C_PLAZA, 1 - Math.max(0, (r - 3.6) / 0.6));
      const sand = Math.min(1, Math.max(0, (r - (ISLAND_R - 1.2)) / 1.2));
      c.lerp(C_SAND, sand);
      if (r > ISLAND_R + 1.4) c.lerp(C_WET, Math.min(1, (r - ISLAND_R - 1.4) / 1.5));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
      {/* plaza ring around the Thinking Tree */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[3.3, 3.75, 64]} />
        <meshStandardMaterial color="#D9C79E" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---------------- stone paths ----------------

export function Paths() {
  const ref = useRef<InstancedMesh>(null);
  const tiles = useMemo(() => {
    const rng = makeRng(11);
    const out: { x: number; z: number; s: number; r: number; shade: number }[] = [];
    for (const p of PORTALS) {
      const end = portalPos(p);
      const len = Math.hypot(end.x, end.z);
      for (let d = 4.2; d < len - 2.6; d += 1.05) {
        const t = d / len;
        const side = (rng() - 0.5) * 0.5;
        out.push({ x: end.x * t + (end.z / len) * side, z: end.z * t - (end.x / len) * side, s: 0.42 + rng() * 0.18, r: rng() * Math.PI, shade: rng() });
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const c = new Color();
    tiles.forEach((t, i) => {
      o.position.set(t.x, groundHeight(t.x, t.z) + 0.04, t.z);
      o.rotation.set(0, t.r, 0);
      o.scale.set(t.s * 1.3, 1, t.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set('#EFE3C8').lerp(new Color('#D8C8A4'), t.shade));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [tiles]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, tiles.length]} receiveShadow>
      <cylinderGeometry args={[1, 1, 0.1, 9]} />
      <meshStandardMaterial roughness={0.85} />
    </instancedMesh>
  );
}

// ---------------- vegetation ----------------

interface Spot { x: number; z: number; s: number; r: number; kind: 'round' | 'pine' | 'bush' | 'rock' | 'flower' | 'tuft'; hue: number }

function scatter(): Spot[] {
  const rng = makeRng(42);
  const out: Spot[] = [];
  const place = (kind: Spot['kind'], count: number, minHill: number, minR: number, maxR: number, clearance: number) => {
    let tries = 0;
    let n = 0;
    while (n < count && tries++ < count * 60) {
      const a = rng() * Math.PI * 2;
      const r = minR + rng() * (maxR - minR);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (hilliness(x, z) < minHill) continue;
      if (z > 3 && Math.abs(x) < 7 && (kind === 'round' || kind === 'pine')) continue; // keep the camera corridor clear
      if (out.some((o) => (o.kind === 'round' || o.kind === 'pine' || o.kind === 'rock') && Math.hypot(o.x - x, o.z - z) < clearance)) continue;
      out.push({ x, z, s: 0.8 + rng() * (kind === 'round' || kind === 'pine' ? 0.45 : 0.6), r: rng() * Math.PI * 2, kind, hue: rng() });
      n++;
    }
  };
  place('round', 16, 0.5, 8, ISLAND_R - 3, 3);
  place('pine', 14, 0.5, 8, ISLAND_R - 2.5, 2.6);
  place('rock', 12, 0.2, 6, ISLAND_R - 1, 1.6);
  place('bush', 28, 0.3, 5, ISLAND_R - 2, 0);
  place('flower', 140, 0.15, 4.5, ISLAND_R - 1.5, 0);
  place('tuft', 220, 0.1, 4.5, ISLAND_R - 1.2, 0);
  return out;
}

function useInstances(ref: React.RefObject<InstancedMesh | null>, spots: Spot[], fn: (s: Spot, o: Object3D, c: Color) => void) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const c = new Color();
    spots.forEach((s, i) => {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      fn(s, o, c);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, spots, fn]);
}

const LEAF = ['#4CC35A', '#65D16A', '#3DAA55', '#7BD86B'];
const FLOWERS = ['#FF4F8B', '#FFB930', '#FFFFFF', '#8A5CF6', '#FF7A59', '#2E6BFF'];

export function Vegetation() {
  const spots = useMemo(scatter, []);
  const byKind = (k: Spot['kind']) => spots.filter((s) => s.kind === k);
  const round = useMemo(() => byKind('round'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const pine = useMemo(() => byKind('pine'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const bush = useMemo(() => byKind('bush'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const rock = useMemo(() => byKind('rock'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const flower = useMemo(() => byKind('flower'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const tuft = useMemo(() => byKind('tuft'), [spots]); // eslint-disable-line react-hooks/exhaustive-deps
  const trunks = useMemo(() => [...round, ...pine], [round, pine]);

  useLayoutEffect(() => {
    setObstacles('vegetation', [
      ...round.map((s) => [s.x, s.z, 0.55 * s.s] as [number, number, number]),
      ...pine.map((s) => [s.x, s.z, 0.5 * s.s] as [number, number, number]),
      ...rock.map((s) => [s.x, s.z, 0.6 * s.s] as [number, number, number]),
    ]);
  }, [round, pine, rock]);

  const rTrunk = useRef<InstancedMesh>(null);
  const rCrown = useRef<InstancedMesh>(null);
  const rCrown2 = useRef<InstancedMesh>(null);
  const rPine = useRef<InstancedMesh>(null);
  const rPine2 = useRef<InstancedMesh>(null);
  const rBush = useRef<InstancedMesh>(null);
  const rRock = useRef<InstancedMesh>(null);
  const rFlower = useRef<InstancedMesh>(null);
  const rTuft = useRef<InstancedMesh>(null);

  useInstances(rTrunk, trunks, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 0.7 * s.s, s.z); o.scale.setScalar(s.s); c.set('#9A6B45'); });
  useInstances(rCrown, round, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 2.1 * s.s, s.z); o.rotation.y = s.r; o.scale.set(1.35 * s.s, 1.15 * s.s, 1.35 * s.s); c.set(LEAF[Math.floor(s.hue * LEAF.length)]); });
  useInstances(rCrown2, round, (s, o, c) => { o.position.set(s.x + 0.55 * s.s * Math.cos(s.r), groundHeight(s.x, s.z) + 1.7 * s.s, s.z + 0.55 * s.s * Math.sin(s.r)); o.scale.setScalar(0.85 * s.s); c.set(LEAF[(Math.floor(s.hue * LEAF.length) + 1) % LEAF.length]); });
  useInstances(rPine, pine, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 1.55 * s.s, s.z); o.rotation.y = s.r; o.scale.setScalar(s.s); c.set('#2F9E55').lerp(new Color('#46B866'), s.hue); });
  useInstances(rPine2, pine, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 2.45 * s.s, s.z); o.rotation.y = s.r + 0.5; o.scale.setScalar(0.72 * s.s); c.set('#39AA5D').lerp(new Color('#55C472'), s.hue); });
  useInstances(rBush, bush, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 0.3 * s.s, s.z); o.rotation.y = s.r; o.scale.set(0.75 * s.s, 0.55 * s.s, 0.7 * s.s); c.set(LEAF[Math.floor(s.hue * LEAF.length)]); });
  useInstances(rRock, rock, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 0.2 * s.s, s.z); o.rotation.set(s.r * 0.3, s.r, s.r * 0.2); o.scale.set(0.8 * s.s, 0.55 * s.s, 0.7 * s.s); c.set('#B7BFCF').lerp(new Color('#8F99AE'), s.hue); });
  useInstances(rFlower, flower, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 0.1, s.z); o.rotation.y = s.r; o.scale.set(0.09 + 0.03 * s.s, 0.04, 0.09 + 0.03 * s.s); c.set(FLOWERS[Math.floor(s.hue * FLOWERS.length)]); });
  useInstances(rTuft, tuft, (s, o, c) => { o.position.set(s.x, groundHeight(s.x, s.z) + 0.14, s.z); o.rotation.set((s.hue - 0.5) * 0.4, s.r, 0); o.scale.set(0.12, 0.3 * s.s, 0.12); c.set('#5CC04A').lerp(new Color('#8FDF62'), s.hue); });

  return (
    <group>
      <instancedMesh ref={rTrunk} args={[undefined, undefined, trunks.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 1.4, 7]} /><meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={rCrown} args={[undefined, undefined, round.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={rCrown2} args={[undefined, undefined, round.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={rPine} args={[undefined, undefined, pine.length]} castShadow>
        <coneGeometry args={[1.05, 1.9, 8]} /><meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={rPine2} args={[undefined, undefined, pine.length]} castShadow>
        <coneGeometry args={[1.05, 1.7, 8]} /><meshStandardMaterial roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={rBush} args={[undefined, undefined, bush.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={rRock} args={[undefined, undefined, rock.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={rFlower} args={[undefined, undefined, flower.length]}>
        <cylinderGeometry args={[1, 0.6, 1, 5]} /><meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={rTuft} args={[undefined, undefined, tuft.length]}>
        <coneGeometry args={[1, 1, 4]} /><meshStandardMaterial roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

// ---------------- sky life ----------------

export function Clouds() {
  const group = useRef<Group>(null);
  const clouds = useMemo(() => {
    const rng = makeRng(5);
    return Array.from({ length: 9 }, (_, i) => ({
      a: (i / 9) * Math.PI * 2 + rng() * 0.4,
      r: 34 + rng() * 22,
      y: 16 + rng() * 9,
      s: 1.6 + rng() * 1.4,
      puffs: Array.from({ length: 5 }, (_, k) => [(k - 2) * 1.3 + rng() * 0.4, rng() * 0.6, rng() * 0.8] as [number, number, number]),
    }));
  }, []);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * 0.01; });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[Math.sin(c.a) * c.r, c.y, Math.cos(c.a) * c.r]} rotation={[0, c.a, 0]} scale={c.s}>
          {c.puffs.map((p, k) => (
            <mesh key={k} position={p} scale={k === 2 ? 1.4 : 1}>
              <icosahedronGeometry args={[1.1, 2]} />
              <meshStandardMaterial color="#FFFFFF" roughness={1} emissive="#DDEBFF" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Butterflies() {
  const refs = useRef<(Group | null)[]>([]);
  const flies = useMemo(() => {
    const rng = makeRng(8);
    return Array.from({ length: 7 }, () => ({ cx: (rng() - 0.5) * 26, cz: (rng() - 0.5) * 26, r: 1.5 + rng() * 2.5, sp: 0.4 + rng() * 0.5, ph: rng() * 6, color: FLOWERS[Math.floor(rng() * FLOWERS.length)] }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flies.forEach((f, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = t * f.sp + f.ph;
      const x = f.cx + Math.sin(a) * f.r, z = f.cz + Math.cos(a * 1.3) * f.r;
      g.position.set(x, groundHeight(x, z) + 1.1 + Math.sin(t * 2 + f.ph) * 0.35, z);
      g.rotation.y = a + Math.PI / 2;
      const flap = Math.sin(t * 18 + f.ph) * 0.9;
      (g.children[0] as Group).rotation.z = flap;
      (g.children[1] as Group).rotation.z = -flap;
    });
  });
  return (
    <>
      {flies.map((f, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          {[1, -1].map((side) => (
            <group key={side}>
              <mesh position={[0.12 * side, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.13, 10]} />
                <meshStandardMaterial color={f.color} side={DoubleSide} emissive={f.color} emissiveIntensity={0.25} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

