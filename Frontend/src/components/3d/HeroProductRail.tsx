import * as React from 'react'
import { Canvas, ThreeEvent, useFrame, useLoader } from '@react-three/fiber'
import { Float } from '@react-three/drei/core/Float'
import * as THREE from 'three'

type Side = 'left' | 'right'

interface Product {
  name: string
  image?: string
  images?: string[]
  accent?: string
}

interface HeroProductRailProps {
  side: Side
  products?: Product[]
}

const accents = ['#f59e0b', '#6366f1', '#38bdf8', '#f43f5e', '#a855f7', '#f97316', '#22c55e', '#eab308']

function makePlaceholderDataUrl(label: string, accent: string) {
  const safeLabel = (label || 'Product').replace(/[<>&]/g, '').slice(0, 18)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accent}"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1000" rx="44" fill="url(#g)"/>
      <circle cx="400" cy="350" r="180" fill="rgba(255,255,255,0.18)"/>
      <text x="400" y="620" text-anchor="middle" font-size="72" font-family="Arial, sans-serif" font-weight="700" fill="white">${safeLabel}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function getSafeProductImage(product: Product) {
  const candidate = product.image || product.images?.find((image: string) => typeof image === 'string' && image.trim().length > 0)

  if (typeof candidate === 'string' && candidate.trim() && candidate !== 'undefined' && candidate !== 'null') {
    return candidate
  }

  return makePlaceholderDataUrl(product.name, product.accent || '#6366f1')
}

function ProductCard({ product, position, tilt }: { product: Product; position: [number, number, number]; tilt: number }) {
  const safeImage = React.useMemo(() => getSafeProductImage(product), [product])
  const texture = useLoader(THREE.TextureLoader, safeImage)
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
    const positions = new Float32Array(20 * 3)
    for (let index = 0; index < 20; index += 1) {
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

function RailScene({ side, products = [] }: { side: Side; products?: Product[] }) {
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

  const displayProducts = products.slice(0, 4)

  return (
    <group ref={group} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <GlowParticles />
      <mesh position={[0, 0, -2.3]}>
        <circleGeometry args={[2.7, 48]} />
        <meshBasicMaterial color={side === 'left' ? '#1d4ed8' : '#7c3aed'} transparent opacity={0.12} />
      </mesh>
      {displayProducts.map((product, index) => (
        <ProductCard key={product.name + index} product={product} position={positions[index % positions.length]} tilt={(index % 2 === 0 ? -1 : 1) * 0.22} />
      ))}
      <ambientLight intensity={1.15} />
      <directionalLight position={[-3, 4, 5]} intensity={2.1} castShadow />
      <pointLight position={[0, 0, 3]} color={side === 'left' ? '#60a5fa' : '#c084fc'} intensity={4} distance={6} />
    </group>
  )
}

export function HeroProductRail({ side, products }: HeroProductRailProps) {
  return (
    <div className="h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label={`${side} product carousel`}>
      <Canvas
        camera={{ position: [0, 0, 6.3], fov: 42 }}
        dpr={[1, 1.25]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        shadows
      >
        <React.Suspense fallback={null}>
          <RailScene side={side} products={products} />
        </React.Suspense>
      </Canvas>
    </div>
  )
}
