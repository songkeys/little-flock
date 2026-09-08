import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec2 } from '../game/types'
import { Batch, random, shapes } from './geometry'
import type { ActionEffect } from './Sheep'

const temp = new THREE.Object3D()

export function Fireflies({ night }: { night: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const points = useMemo(() => { const rand = random(996); return Array.from({ length: 78 }, (_, i) => ({ x: i < 30 ? rand() * 34 - 16 : i < 60 ? 21 + rand() * 23 : 30 + rand() * 24, z: i < 30 ? rand() * 40 - 7 : i < 60 ? rand() * 28 - 12 : -39 + rand() * 18, y: rand() * 2 + .4, phase: rand() * 6 })) }, [])
  useFrame(state => {
    if (!ref.current || night < .1) return
    const t = state.clock.elapsedTime
    points.forEach((p, i) => {
      temp.position.set(p.x + Math.sin(t * .3 + p.phase) * .7, p.y + Math.sin(t + p.phase) * .3, p.z + Math.cos(t * .2 + p.phase) * .7)
      temp.scale.setScalar((.02 + Math.sin(t * 2 + p.phase) * .012) * night)
      temp.updateMatrix(); ref.current!.setMatrixAt(i, temp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[shapes.sphere, undefined, points.length]} visible={night > .1} frustumCulled={false}><meshBasicMaterial color="#ffea92" toneMapped={false} /></instancedMesh>
}

export function Butterflies() {
  const wings = useRef<THREE.InstancedMesh>(null), bodies = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => {
    const rand = random(88)
    return Array.from({ length: 16 }, (_, i) => ({ x: i < 5 ? 3 + rand() * 6 : i < 12 ? -21 + rand() * 18 : 26 + rand() * 13, z: i < 5 ? -4 + rand() * 6 : i < 12 ? 20 + rand() * 13 : -4 + rand() * 14, phase: rand() * 6 }))
  }, [])
  useFrame(state => {
    if (!wings.current || !bodies.current) return
    const t = state.clock.elapsedTime
    data.forEach((p, i) => {
      const x = p.x + Math.sin(t * .32 + p.phase) * 1.1, z = p.z + Math.cos(t * .38 + p.phase) * .85, y = 1.35 + Math.sin(t * 1.6 + p.phase) * .3
      temp.position.set(x, y, z); temp.rotation.set(0, t * .4 + p.phase, .1); temp.scale.set(.025, .025, .12); temp.updateMatrix(); bodies.current!.setMatrixAt(i, temp.matrix)
      for (let side = 0; side < 2; side++) {
        const direction = side ? 1 : -1
        temp.position.set(x + direction * .08, y + Math.abs(Math.sin(t * 15 + p.phase)) * .06, z)
        temp.rotation.set(0, t * .4 + p.phase, direction * Math.sin(t * 15 + p.phase)); temp.scale.set(.125, .022, .15); temp.updateMatrix(); wings.current!.setMatrixAt(i * 2 + side, temp.matrix)
      }
    })
    wings.current.instanceMatrix.needsUpdate = true; bodies.current.instanceMatrix.needsUpdate = true
  })
  return <>
    <instancedMesh ref={wings} args={[shapes.leaf, undefined, data.length * 2]} frustumCulled={false}><meshStandardMaterial color="#f6d28a" roughness={.8} side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={bodies} args={[shapes.sphere, undefined, data.length]} frustumCulled={false}><meshStandardMaterial color="#aa8560" /></instancedMesh>
  </>
}

const heartGeometry = (() => {
  const b = new Batch()
  b.add('sphere', 'heart', [-.32, .23, 0], [.49, .47, .24])
  b.add('sphere', 'heart', [.32, .23, 0], [.49, .47, .24])
  b.add('cone', 'heart', [0, -.26, 0], [.72, .97, .23], [0, 0, Math.PI])
  return b.build()[0].geometry
})()

export function ActionParticles({ effect, position }: { effect?: ActionEffect | null; position?: Vec2 }) {
  const particles = useRef<THREE.InstancedMesh>(null), timer = useRef(5)
  const origin = useRef<THREE.Group>(null)
  const lastPosition = useRef<Vec2>({ x: 0, z: 0 })
  const data = useMemo(() => { const rand = random(171); return Array.from({ length: 14 }, () => ({ a: rand() * Math.PI * 2, speed: .4 + rand() * .75, height: .5 + rand(), rotation: rand() * 3 })) }, [])
  const color = effect?.type === 'water' || effect?.type === 'waterFlock' ? '#a0d7e4' : effect?.type === 'shear' || effect?.type === 'build' ? '#fff0ca' : effect?.type === 'stargaze' ? '#d9c5ff' : effect?.type === 'harvest' || effect?.type === 'plant' || effect?.type === 'forage' ? '#c9d880' : '#e99d9c'
  const isHeart = effect?.type === 'pet' || effect?.type === 'breed' || effect?.type === 'birth'
  useEffect(() => { if (effect && position) { timer.current = 0; lastPosition.current = { ...position }; origin.current?.position.set(position.x, .2, position.z) } }, [effect?.id])
  useFrame((state, dt) => {
    if (!particles.current) return
    timer.current += dt
    particles.current.visible = timer.current < 2
    if (timer.current >= 2) return
    const t = timer.current
    particles.current.quaternion.copy(state.camera.quaternion)
    data.forEach((p, i) => {
      temp.position.set(Math.cos(p.a) * p.speed * t, .7 + p.height * t - t * t * .27, Math.sin(p.a) * p.speed * t)
      temp.rotation.set(0, 0, Math.sin(t * 2 + p.rotation) * .4)
      temp.scale.setScalar((isHeart ? .095 : .07) * Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t / 2)); temp.updateMatrix(); particles.current!.setMatrixAt(i, temp.matrix)
    })
    particles.current.instanceMatrix.needsUpdate = true
  })
  return <group ref={origin} position={[lastPosition.current.x, .2, lastPosition.current.z]}><instancedMesh ref={particles} args={[isHeart ? heartGeometry : shapes.sphere, undefined, data.length]} visible={false} frustumCulled={false}><meshBasicMaterial color={color} toneMapped={false} /></instancedMesh></group>
}

export function Rain({ enabled, position }: { enabled: boolean; position?: Vec2 }) {
  const drops = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(() => { const rand = random(31); return Array.from({ length: 300 }, () => ({ x: rand() * 50 - 25, z: rand() * 50 - 25, phase: rand() * 15 })) }, [])
  useFrame(state => {
    if (!enabled || !drops.current) return
    if (position) drops.current.position.set(position.x, 0, position.z)
    const t = state.clock.elapsedTime
    data.forEach((p, i) => {
      temp.position.set(p.x - ((t * 1.8 + p.phase) % 3), 15 - ((t * 8 + p.phase) % 15), p.z)
      temp.rotation.set(0, 0, -.18); temp.scale.set(.015, .27, .015); temp.updateMatrix(); drops.current!.setMatrixAt(i, temp.matrix)
    })
    drops.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={drops} args={[shapes.box, undefined, data.length]} visible={enabled} frustumCulled={false}><meshBasicMaterial color="#d0e2dc" transparent opacity={.43} depthWrite={false} /></instancedMesh>
}

export function ChimneySmoke() {
  const smoke = useRef<THREE.InstancedMesh>(null)
  useFrame(state => {
    if (!smoke.current) return
    for (let i = 0; i < 7; i++) {
      const progress = (state.clock.elapsedTime * .15 + i / 7) % 1
      temp.position.set(-10.52 + progress * 1.7, 5.65 + progress * 3.6, -10.7 + Math.sin(progress * 3) * .3)
      temp.rotation.set(0, progress * 3, 0); temp.scale.setScalar(.15 + progress * .57); temp.updateMatrix(); smoke.current.setMatrixAt(i, temp.matrix)
    }
    smoke.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={smoke} args={[shapes.sphere, undefined, 7]}><meshStandardMaterial color="#e4dfc9" transparent opacity={.16} depthWrite={false} /></instancedMesh>
}
