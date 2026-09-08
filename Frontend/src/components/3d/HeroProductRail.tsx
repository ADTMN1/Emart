import * as React from 'react'
import { Canvas, ThreeEvent, useFrame, useLoader } from '@react-three/fiber'
import { Float } from '@react-three/drei/core/Float'
import * as THREE from 'three'

type Side = 'left' | 'right'

interface Product {
  name: string
  image: string
  accent: string
}

const railProducts: Record<Side, Product[]> = {
  left: [
    { name: 'Sneakers', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=360&h=440&fit=crop', accent: '#f59e0b' },
    { name: 'Headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=360&h=440&fit=crop', accent: '#6366f1' },
    { name: 'Camera', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=360&h=440&fit=crop', accent: '#38bdf8' },
    { name: 'Watch', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=360&h=440&fit=crop', accent: '#f43f5e' },
  ],
  right: [
    { name: 'Gaming', image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=360&h=440&fit=crop', accent: '#a855f7' },
    { name: 'Collectible', image: 'https://images.unsplash.com/photo-1608889335941-32ac5f2041b9?w=360&h=440&fit=crop', accent: '#f97316' },
    { name: 'Electronics', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=360&h=440&fit=crop', accent: '#22c55e' },
    { name: 'Accessories', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=360&h=440&fit=crop', accent: '#eab308' },
  ],
}

function ProductCard({ product, position, tilt }: { product: Product; position: [number, number, number]; tilt: number }) {
  const texture = useLoader(THREE.TextureLoader, product.image)
  const [hovered, setHovered] = React.useState(false)

  React.useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
  }, [texture])

  return (
    <Float speed={hovered ? 2 : 1.1} floatIntensity={hovered ? 0.22 : 0.12} rotationIntensity={0.12}>
      <group position={position} rotation={[0, tilt, tilt * 0.12]}>
        <mesh position={[0, 0, -0.07]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.62, 0.13]} />
          <meshStandardMaterial color="#F5F8FC" roughness={0.28} metalness={0.16} />
        </mesh>
        <mesh
          position={[0, 0.08, 0.006]}
          onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
        >
          <planeGeometry args={[1.08, 1.28]} />
          <meshStandardMaterial map={texture} roughness={0.42} metalness={0.04} />
        </mesh>
        <mesh position={[0, -0.69, 0.01]}>
          <planeGeometry args={[1.08, 0.18]} />
          <meshBasicMaterial color={product.accent} transparent opacity={0.9} />
        </mesh>
      </group>
    </Float>
  )
}

function GlowParticles() {
  const points = React.useMemo(() => {
    const positions = new Float32Array(42 * 3)
    for (let index = 0; index < 42; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 5.5
      positions[index * 3 + 1] = (Math.random() - 0.5) * 6.2
      positions[index * 3 + 2] = -1.8 - Math.random() * 1.6
    }
    return positions
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#bfdbfe" size={0.035} transparent opacity={0.45} sizeAttenuation />
    </points>
  )
}

function RailScene({ side }: { side: Side }) {
  const group = React.useRef<THREE.Group>(null)
  const targetRotation = React.useRef(side === 'left' ? 0.16 : -0.16)
  const pointerStart = React.useRef<number | null>(null)

  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotation.current, 4, delta)
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.45) * 0.05
  })

  const startDrag = (event: ThreeEvent<PointerEvent>) => {
    pointerStart.current = event.clientX
    event.stopPropagation()
  }
  const drag = (event: ThreeEvent<PointerEvent>) => {
    if (pointerStart.current === null) return
    targetRotation.current += (event.clientX - pointerStart.current) * 0.008
    pointerStart.current = event.clientX
  }
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    pointerStart.current = null
  }

  const positions: [number, number, number][] = [
    [-0.4, 1.62, -0.5],
    [0.46, 0.58, 0.2],
    [-0.52, -0.58, -0.15],
    [0.38, -1.67, -0.65],
  ]

  return (
    <group ref={group} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <GlowParticles />
      <mesh position={[0, 0, -2.3]}>
        <circleGeometry args={[2.7, 48]} />
        <meshBasicMaterial color={side === 'left' ? '#1d4ed8' : '#7c3aed'} transparent opacity={0.12} />
      </mesh>
      {railProducts[side].map((product, index) => (
        <ProductCard key={product.name} product={product} position={positions[index]} tilt={(index % 2 === 0 ? -1 : 1) * 0.22} />
      ))}
      <ambientLight intensity={1.15} />
      <directionalLight position={[-3, 4, 5]} intensity={2.1} castShadow />
      <pointLight position={[0, 0, 3]} color={side === 'left' ? '#60a5fa' : '#c084fc'} intensity={4} distance={6} />
    </group>
  )
}

export function HeroProductRail({ side }: { side: Side }) {
  return (
    <div className="h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label={`${side} product carousel`}>
      <Canvas
        camera={{ position: [0, 0, 6.3], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        shadows
      >
        <React.Suspense fallback={null}>
          <RailScene side={side} />
        </React.Suspense>
      </Canvas>
    </div>
  )
}
