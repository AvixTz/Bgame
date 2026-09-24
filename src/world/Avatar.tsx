import { forwardRef, useMemo } from 'react';
import { Color, type Group } from 'three';

/**
 * Clay-style hero. Named pivots (`armL`, `armR`, `legL`, `legR`, `body`, `eyes`) are animated by the
 * player controller: limbs swing with speed, the body bobs, the eyes blink. Soft rounded forms and a
 * darker trim of the chosen color keep the silhouette readable from the follow camera.
 */
const SKIN = '#FFD7B5';
const INK = '#1E2A4A';

function Hat({ kind, trim }: { kind: string; trim: string }) {
  switch (kind) {
    case 'cap':
      return (
        <group position={[0, 1.83, 0]}>
          <mesh castShadow><sphereGeometry args={[0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#FF4F8B" roughness={0.6} /></mesh>
          <mesh position={[0, 0.02, 0.36]} rotation={[0.12, 0, 0]} castShadow><cylinderGeometry args={[0.28, 0.3, 0.05, 20, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color={trim} roughness={0.6} /></mesh>
          <mesh position={[0, 0.43, 0]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#fff" /></mesh>
        </group>
      );
    case 'crown':
      return (
        <group position={[0, 1.9, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.3, 0.3, 0.2, 24, 1, true]} /><meshStandardMaterial color="#FFB930" metalness={0.6} roughness={0.25} side={2} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <group key={i} position={[Math.sin(a) * 0.29, 0.16, Math.cos(a) * 0.29]}>
                <mesh><coneGeometry args={[0.07, 0.16, 8]} /><meshStandardMaterial color="#FFB930" metalness={0.6} roughness={0.25} /></mesh>
                <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color="#FF4F8B" emissive="#FF4F8B" emissiveIntensity={0.4} /></mesh>
              </group>
            );
          })}
        </group>
      );
    case 'miner':
      return (
        <group position={[0, 1.78, 0]}>
          <mesh castShadow><sphereGeometry args={[0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#FFB930" roughness={0.4} /></mesh>
          <mesh position={[0, 0.02, 0]}><torusGeometry args={[0.45, 0.04, 8, 32]} /><meshStandardMaterial color="#D98A00" /></mesh>
          <mesh position={[0, 0.2, 0.4]} rotation={[Math.PI / 2.4, 0, 0]}><cylinderGeometry args={[0.1, 0.12, 0.1, 16]} /><meshStandardMaterial color="#FFF6C8" emissive="#FFE680" emissiveIntensity={2.2} /></mesh>
        </group>
      );
    case 'wizard':
      return (
        <group position={[0, 1.86, 0]}>
          <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0.12]} castShadow><coneGeometry args={[0.36, 0.85, 24]} /><meshStandardMaterial color="#6B3FE0" roughness={0.7} /></mesh>
          <mesh><cylinderGeometry args={[0.55, 0.55, 0.05, 32]} /><meshStandardMaterial color="#6B3FE0" roughness={0.7} /></mesh>
          {[[0.12, 0.3, 0.3], [-0.1, 0.5, 0.25], [0.05, 0.14, 0.34]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}><octahedronGeometry args={[0.045]} /><meshStandardMaterial color="#FFE680" emissive="#FFE680" emissiveIntensity={1.4} /></mesh>
          ))}
        </group>
      );
    default:
      return (
        <group position={[0, 1.82, 0]}>
          {[-0.14, 0, 0.14].map((x, i) => (
            <mesh key={i} position={[x, 0.08 + (i === 1 ? 0.05 : 0), 0.05]} rotation={[0.3, 0, x * 2]}><capsuleGeometry args={[0.07, 0.12, 4, 8]} /><meshStandardMaterial color="#5B3A29" roughness={0.9} /></mesh>
          ))}
        </group>
      );
  }
}

export const Avatar = forwardRef<Group, { color: string; hat: string }>(function Avatar({ color, hat }, ref) {
  const trim = useMemo(() => '#' + new Color(color).multiplyScalar(0.7).getHexString(), [color]);
  const cloth = { color, roughness: 0.55 } as const;
  return (
    <group ref={ref}>
      <group name="body">
        {/* torso */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.36, 0.42, 8, 20]} />
          <meshStandardMaterial {...cloth} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <torusGeometry args={[0.37, 0.05, 10, 32]} />
          <meshStandardMaterial color={trim} roughness={0.6} />
        </mesh>
        {/* backpack */}
        <group position={[0, 1.02, -0.36]}>
          <mesh castShadow><boxGeometry args={[0.46, 0.5, 0.2]} /><meshStandardMaterial color="#FFB930" roughness={0.6} /></mesh>
          <mesh position={[0, -0.1, -0.11]}><boxGeometry args={[0.32, 0.18, 0.06]} /><meshStandardMaterial color="#D98A00" roughness={0.6} /></mesh>
        </group>
        {/* head */}
        <group position={[0, 1.6, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.44, 32, 24]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          <group name="eyes">
            {[-0.15, 0.15].map((x) => (
              <group key={x} position={[x, 0.04, 0.38]}>
                <mesh><sphereGeometry args={[0.085, 16, 12]} /><meshStandardMaterial color="#fff" roughness={0.3} /></mesh>
                <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.05, 12, 10]} /><meshStandardMaterial color={INK} roughness={0.2} /></mesh>
                <mesh position={[0.02, 0.025, 0.09]}><sphereGeometry args={[0.015, 6, 6]} /><meshBasicMaterial color="#fff" /></mesh>
              </group>
            ))}
          </group>
          {[-0.25, 0.25].map((x) => (
            <mesh key={x} position={[x, -0.1, 0.33]}><sphereGeometry args={[0.07, 12, 8]} /><meshStandardMaterial color="#FF9DB0" transparent opacity={0.6} /></mesh>
          ))}
          <mesh position={[0, -0.14, 0.4]} rotation={[0.2, 0, Math.PI]}>
            <torusGeometry args={[0.08, 0.02, 6, 16, Math.PI]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        </group>
        <Hat kind={hat} trim={trim} />
        {/* arms (pivot at shoulder) */}
        {([['armL', 0.43], ['armR', -0.43]] as const).map(([name, x]) => (
          <group key={name} name={name} position={[x, 1.2, 0]}>
            <mesh position={[0, -0.26, 0]} castShadow><capsuleGeometry args={[0.1, 0.34, 6, 12]} /><meshStandardMaterial {...cloth} /></mesh>
            <mesh position={[0, -0.52, 0]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color={SKIN} roughness={0.7} /></mesh>
          </group>
        ))}
      </group>
      {/* legs (pivot at hip) */}
      {([['legL', 0.17], ['legR', -0.17]] as const).map(([name, x]) => (
        <group key={name} name={name} position={[x, 0.55, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow><capsuleGeometry args={[0.12, 0.24, 6, 12]} /><meshStandardMaterial color="#35457A" roughness={0.7} /></mesh>
          <mesh position={[0, -0.44, 0.06]} castShadow><boxGeometry args={[0.2, 0.12, 0.3]} /><meshStandardMaterial color="#FFFFFF" roughness={0.5} /></mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
  );
});
