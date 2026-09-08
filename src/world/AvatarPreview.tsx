import { memo, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { AvatarAppearance } from '../game/types'
import { Shepherd } from './Shepherd'
import type { WorldPlayer } from './Sheep'

const AvatarPreview = memo(function AvatarPreview({ avatar, className }: { avatar: AvatarAppearance; className?: string }) {
  const player = useMemo<WorldPlayer>(() => ({ position: { x: 0, z: 0 }, facing: 0, moving: false }), [])
  return <div className={className} role="img" aria-label="牧羊人造型预览，可拖动旋转" style={{ width: '100%', height: '100%' }}>
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [2.2, 1.8, 3.8], fov: 34, near: .1, far: 30 }} gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <hemisphereLight args={['#fff4dd', '#879a88', 1.8]} />
      <directionalLight position={[-3, 5, 4]} color="#fff3d7" intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-normalBias={.025} shadow-bias={-.0001} />
      <directionalLight position={[3, 2, -2]} color="#c4dddb" intensity={.7} />
      <Shepherd player={player} avatar={avatar} showRing={false} />
      <mesh receiveShadow position={[0, -.045, 0]}><cylinderGeometry args={[.83, .88, .09, 48]} /><meshStandardMaterial color="#d6dac3" roughness={1} /></mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.093, 0]}><circleGeometry args={[2.5, 48]} /><shadowMaterial transparent opacity={.15} /></mesh>
      <OrbitControls makeDefault target={[0, 1.03, 0]} enablePan={false} enableZoom={false} minPolarAngle={.65} maxPolarAngle={1.62} enableDamping dampingFactor={.08} rotateSpeed={.6} autoRotate autoRotateSpeed={.45} />
    </Canvas>
  </div>
})

export default AvatarPreview
