import { forwardRef } from 'react';
import { Outlines } from '@react-three/drei';
import type { Group } from 'three';

const INK = '#111014';

function Hat({ kind }: { kind: string }) {
  switch (kind) {
    case 'cap':
      return (
        <group position={[0, 1.78, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.36, 0.38, 0.22, 20]} /><meshToonMaterial color="#FF3D7F" /><Outlines thickness={0.03} color={INK} /></mesh>
          <mesh position={[0, -0.08, 0.3]} castShadow><boxGeometry args={[0.5, 0.05, 0.3]} /><meshToonMaterial color="#FF3D7F" /></mesh>
        </group>
      );
    case 'crown':
      return (
        <group position={[0, 1.8, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.3, 0.3, 0.2, 5, 1, true]} /><meshToonMaterial color="#FFC02E" side={2} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.28, 0.17, Math.cos((i / 5) * Math.PI * 2) * 0.28]}>
              <coneGeometry args={[0.07, 0.16, 6]} /><meshToonMaterial color="#FFC02E" />
            </mesh>
          ))}
        </group>
      );
    case 'miner':
      return (
        <group position={[0, 1.72, 0]}>
          <mesh castShadow><sphereGeometry args={[0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshToonMaterial color="#FFC02E" /><Outlines thickness={0.03} color={INK} /></mesh>
          <mesh position={[0, 0.16, 0.36]}><cylinderGeometry args={[0.09, 0.09, 0.08, 12]} /><meshStandardMaterial color="#fff7b0" emissive="#fff3a0" emissiveIntensity={2} /></mesh>
        </group>
      );
    case 'wizard':
      return (
        <group position={[0, 1.95, 0]}>
          <mesh castShadow><coneGeometry args={[0.36, 0.8, 20]} /><meshToonMaterial color="#6A4CFF" /><Outlines thickness={0.03} color={INK} /></mesh>
          <mesh position={[0, -0.36, 0]}><torusGeometry args={[0.38, 0.06, 8, 24]} /><meshToonMaterial color="#6A4CFF" /></mesh>
        </group>
      );
    default:
      return null;
  }
}

/** Chunky toon avatar in the sticker-book style of the original Games site. */
export const Avatar = forwardRef<Group, { color: string; hat: string }>(function Avatar({ color, hat }, ref) {
  return (
    <group ref={ref}>
      <group name="body">
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.38, 0.55, 6, 16]} />
          <meshToonMaterial color={color} />
          <Outlines thickness={0.035} color={INK} />
        </mesh>
        <mesh position={[0, 1.45, 0]} castShadow>
          <sphereGeometry args={[0.42, 24, 16]} />
          <meshToonMaterial color="#FFE0BD" />
          <Outlines thickness={0.035} color={INK} />
        </mesh>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 1.5, 0.37]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
        <mesh position={[0, 1.34, 0.39]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.09, 0.02, 6, 12, Math.PI]} />
          <meshBasicMaterial color={INK} />
        </mesh>
        <Hat kind={hat} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
});
