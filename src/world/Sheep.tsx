import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { AvatarAppearance, Breed, GrazingState, Sheep as SheepData, Vec2 } from '../game/types'
import regions from '../game/regions.json'
import { Batch, getWalkPath, groundHeight, hash, random, shapes, walkablePosition } from './geometry'

export interface WorldPlayer { position: Vec2; facing: number; moving?: boolean; color?: string; jumpAt?: number; avatar?: AvatarAppearance }
export interface ActionEffect { id: number; type: string; targetId?: string }
const matrix = new THREE.Object3D()
const woolGeometry = (() => {
  const b = new Batch(), rand = random(291)
  b.add('sphere', 'wool', [0, 1.04, -.06], [.65, .6, .85])
  for (let i = 0; i < 29; i++) {
    const a = i * 2.39996, y = 1 - (i / 28) * 2, radius = Math.sqrt(1 - y * y)
    const s = .235 + rand() * .075
    b.add('sphere', 'wool', [Math.cos(a) * radius * .61, 1.06 + y * .52, Math.sin(a) * radius * .76 - .05], [s, s * .96, s])
  }
  b.add('sphere', 'wool', [0, 1.08, -.89], [.19, .18, .22])
  return b.build()[0].geometry
})()

function headGeometry(faceColor: string, fleeceColor: string) {
  const b = new Batch()
  b.add('sphere', faceColor, [0, 0, 0], [.35, .39, .32])
  b.add('sphere', faceColor, [0, -.12, .15], [.29, .24, .29])
  for (const side of [-1, 1]) {
    b.add('sphere', faceColor, [side * .36, .12, -.055], [.25, .09, .15], [0, side * .15, side * -.3])
    b.add('sphere', '#d1a195', [side * .4, .14, -.035], [.13, .032, .087], [0, side * .15, side * -.3])
    b.add('sphere', '#fff8e1', [side * .158, .055, .275], [.087, .108, .04], [0, side * .19, 0])
    b.add('sphere', '#292f2d', [side * .156, .048, .309], [.043, .063, .024])
    b.add('sphere', '#fff8e1', [side * .145, .078, .329], [.015, .019, .013])
    b.add('sphere', '#332e29', [side * .072, -.18, .399], [.023, .016, .014])
  }
  for (let i = 0; i < 5; i++) b.add('sphere', fleeceColor, [(i - 2) * .125, .305 + Math.sin(i / 4 * Math.PI) * .045, .12], [.12, .125, .12])
  return b.buildColored()!
}

function accentGeometry(breed: Breed | undefined) {
  const b = new Batch(), id = breed?.id || 'cloud', accent = breed?.accent || '#b5d091'
  if (/mint|clover|leaf/.test(id)) {
    b.add('leaf', '#689551', [-.12, 1.86, .28], [.1, .045, .3], [.2, .2, -.35])
    b.add('leaf', '#8db46b', [.1, 1.89, .26], [.1, .05, .25], [.1, -.4, .4])
    b.add('sphere', '#b8d6b5', [0, .61, .55], [.095, .115, .08])
  } else if (/peach|sakura|blossom|rose/.test(id)) {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; b.add('sphere', /sakura/.test(id) ? '#e28eab' : '#f1b381', [.38 + Math.cos(a) * .12, 1.55 + Math.sin(a) * .12, .69], [.09, .09, .045]) }
    b.add('sphere', '#f6d478', [.38, 1.55, .73], [.065, .065, .04])
  } else if (/star|aurora|moon/.test(id)) {
    for (const side of [-1, 1]) {
      b.add('cone', '#e4c079', [side * .37, 1.73, .38], [.1, .42, .1], [.1, 0, side * -.28])
      if (/aurora/.test(id)) {
        b.add('cone', '#bce1c1', [side * .44, 1.92, .34], [.065, .38, .065], [0, 0, side * -.7])
        b.add('cone', '#d2c3ec', [side * .28, 1.92, .4], [.065, .35, .065], [0, 0, side * .4])
      }
    }
    for (const side of [-1, 1]) {
      b.add('sphere', '#f7d590', [side * .65, 1.19, -.25], [.055, .2, .15], [side * .3, 0, 0])
      b.add('sphere', '#f7d590', [side * .68, 1.18, -.25], [.055, .08, .26], [side * .3, 0, 0])
    }
  } else if (/mushroom/.test(id)) {
    b.add('cylinder', '#eed7a8', [0, 1.76, .38], [.08, .29, .08])
    b.add('sphere', '#c97753', [0, 1.92, .38], [.32, .15, .3])
    for (let i = 0; i < 5; i++) { const a = i * 2.4; b.add('sphere', '#f5e8c4', [Math.cos(a) * .17, 2.03, .38 + Math.sin(a) * .16], [.055, .025, .052]) }
  } else if (/honey|bee/.test(id)) {
    for (const side of [-1, 1]) b.add('leaf', '#fff0c9', [side * .64, 1.47, -.26], [.23, .09, .46], [0, side * .4, side * -.4])
    for (let i = 0; i < 3; i++) b.add('sphere', '#a87a3d', [0, 1.53, -.58 + i * .38], [.44, .07, .075])
  } else if (/rain|blue/.test(id)) {
    b.add('sphere', '#a7d9e2', [0, 1.55, .84], [.085, .13, .055])
  } else if (/biscuit|cookie/.test(id)) {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4
      b.add('sphere', '#af875b', [Math.cos(a) * .58, 1.25 + Math.sin(i) * .29, Math.sin(a) * .71], [.19, .17, .19])
    }
  } else if (/tea|caramel/.test(id)) {
    b.add('torus', '#ab8765', [0, .77, .47], [.32, .32, .22], [Math.PI / 2, 0, 0])
    b.add('sphere', '#e3be6b', [0, .66, .65], [.095, .11, .08])
  }
  return b.buildColored()
}

export const Sheep = memo(function Sheep({ data, breed, selected, onSelect, whistle, actionEffect, serverTimeOffset = 0, positions, grazing, grazingLeader, progressionStep = 15 }: {
  data: SheepData; breed?: Breed; selected: boolean; onSelect: (id: string) => void; whistle?: { position: Vec2; at: number } | null; actionEffect?: ActionEffect | null; serverTimeOffset?: number; positions?: Record<string, Vec2>; grazing?: GrazingState; grazingLeader?: WorldPlayer; progressionStep?: number
}) {
  const group = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), legs = useRef<THREE.InstancedMesh>(null), ring = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const seed = useMemo(() => hash(data.id), [data.id])
  const color = breed?.color || '#f2e8ce', face = breed?.faceColor || '#69574b'
  const headParts = useMemo(() => headGeometry(face, color), [face, color])
  const accents = useMemo(() => accentGeometry(breed), [breed?.id])
  useEffect(() => () => headParts.dispose(), [headParts])
  useEffect(() => () => accents?.dispose(), [accents])
  const affectionate = data.trait === '爱撒娇', foodie = data.trait === '小吃货', curious = data.trait === '好奇宝宝'
  const sleepy = data.trait === '慢性子', bouncy = data.trait === '蹦蹦跳跳', social = data.trait === '社交小羊'
  const movement = useRef({ x: data.position.x, z: data.position.z, angle: seed % 6.28, reaction: 0, route: [] as Vec2[], routeAt: 0 })
  useEffect(() => {
    if (actionEffect?.targetId === data.id) movement.current.reaction = 1
  }, [actionEffect?.id, data.id])
  useFrame((_, dt) => {
    if (!group.current || !head.current || !body.current || !legs.current) return
    const now = Date.now() + serverTimeOffset, t = now / 1000 + seed * .012
    const whistling = !!whistle && now >= whistle.at && now - whistle.at < 10000
    const following = !!grazing?.active && !!grazingLeader
    const inMeadow = following && Math.hypot(grazingLeader.position.x - regions.meadow.grazePoint.x, grazingLeader.position.z - regions.meadow.grazePoint.z) < regions.meadow.grazeRadius
    const moving = whistling || following || Math.sin(t * .32) > (sleepy ? .45 : curious || bouncy ? -.55 : foodie ? .1 : -.2)
    const gatherRadius = social ? 1.55 : 2.2
    const flockRadius = inMeadow ? 1.8 + seed % 4 * .55 : gatherRadius
    const anchorX = whistling ? whistle.position.x + Math.sin(seed) * gatherRadius : following ? grazingLeader.position.x + Math.sin(seed) * flockRadius : data.position.x
    const anchorZ = whistling ? whistle.position.z + Math.cos(seed) * gatherRadius : following ? grazingLeader.position.z + Math.cos(seed) * flockRadius : data.position.z
    const wander = curious ? 1.35 : sleepy || social ? .75 : 1
    let targetX = anchorX + Math.sin(t * .13) * (whistling ? .3 : 1.35 * wander)
    let targetZ = anchorZ + Math.cos(t * .17) * (whistling ? .3 : 1.15 * wander)
    const m = movement.current
    if (following || whistling || Math.hypot(targetX - m.x, targetZ - m.z) > 4) {
      if (now - m.routeAt > 900) { m.route = getWalkPath(m, { x: targetX, z: targetZ }, progressionStep); m.routeAt = now }
      while (m.route.length > 1 && Math.hypot(m.route[0].x - m.x, m.route[0].z - m.z) < .5) m.route.shift()
      if (m.route.length > 1) { targetX = m.route[0].x; targetZ = m.route[0].z }
    } else m.route.length = 0
    const dx = targetX - m.x, dz = targetZ - m.z
    const speed = Math.min(1 - Math.exp(-dt * (whistling || following ? 1.1 : sleepy ? .38 : curious || bouncy ? .8 : .65)), dt * (following ? 4.6 : 3.3) / Math.max(.01, Math.hypot(dx, dz)))
    if (moving) {
      const next = walkablePosition({ x: m.x + dx * speed, z: m.z + dz * speed }, m, progressionStep)
      m.x = next.x; m.z = next.z
    }
    // A tiny local separation force keeps a grown flock from clipping into one another.
    if (positions) for (const id in positions) {
      if (id === data.id) continue
      const other = positions[id], sx = m.x - other.x, sz = m.z - other.z, distance = Math.hypot(sx, sz)
      if (distance > .01 && distance < 1.18) {
        const push = (1.18 - distance) * Math.min(dt * 2, .15)
        m.x += sx / distance * push; m.z += sz / distance * push
      }
    }
    if (positions) { const entry = positions[data.id] || (positions[data.id] = { x: m.x, z: m.z }); entry.x = m.x; entry.z = m.z }
    const targetAngle = Math.atan2(dx, dz)
    const angleDifference = Math.atan2(Math.sin(targetAngle - m.angle), Math.cos(targetAngle - m.angle))
    if (moving && Math.hypot(dx, dz) > .12) m.angle += angleDifference * Math.min(1, dt * 2)
    m.reaction = Math.max(0, m.reaction - dt * .6)
    const adult = Math.min(1, Math.max(0, (now - data.bornAt) / Math.max(1, data.adultAt - data.bornAt)))
    const size = .56 + adult * .44
    const walking = moving && Math.hypot(dx, dz) > .45
    const gait = walking ? Math.sin(t * (sleepy ? 4.2 : bouncy ? 9.4 : 7)) : 0
    const reactionLeap = m.reaction > 0 ? Math.max(0, Math.sin(m.reaction * Math.PI * 3)) * m.reaction * (affectionate ? .28 : .2) : 0
    const leap = reactionLeap + (bouncy && moving ? Math.max(0, gait) * .075 : 0)
    group.current.position.set(m.x, groundHeight(m) + leap, m.z)
    group.current.rotation.y = m.angle
    group.current.scale.setScalar(size * .88)
    body.current.position.y = Math.abs(gait) * .025
    const woolSize = .81 + Math.min(100, data.wool) * .0019
    const resting = sleepy && !moving ? .035 * (1 + Math.sin(t * 1.2)) : 0
    body.current.scale.set(woolSize * (1 + leap * .18 + resting * .3), woolSize * (1 - leap * .12 - resting), woolSize)
    const eating = (actionEffect?.type === 'feed' && m.reaction > 0) || (inMeadow && !walking) || (!moving && Math.sin(t * .4) > (foodie ? -.5 : .5))
    head.current.rotation.x = eating ? .35 + Math.sin(t * 9) * .035 : moving ? Math.sin(t * 4) * .035 : -.08 + Math.sin(t * 1.4) * .09
    head.current.rotation.y = curious ? Math.sin(t * .8) * .14 : 0
    head.current.rotation.z = m.reaction > 0 ? Math.sin(m.reaction * 10) * .14 : Math.sin(t * 1.7) * (affectionate ? .085 : .025)
    for (let i = 0; i < 4; i++) {
      const front = i < 2 ? 1 : -1, side = i % 2 ? 1 : -1
      matrix.position.set(side * .39, .32 + Math.max(0, gait * side * front) * .1, front * .47 - .02)
      matrix.rotation.set(gait * .28 * side * front, 0, 0)
      matrix.scale.set(.105, .47, .11); matrix.updateMatrix(); legs.current.setMatrixAt(i, matrix.matrix)
    }
    legs.current.instanceMatrix.needsUpdate = true
    if (ring.current) ring.current.rotation.z = t * .15
  })
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(data.id) }
  return <group ref={group} position={[data.position.x, 0, data.position.z]} onClick={click} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}>
    {(selected || hovered) && <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}><ringGeometry args={[.96, 1.025, 40]} /><meshBasicMaterial color={selected ? '#ffe5a0' : '#f8f1d1'} transparent opacity={.88} /></mesh>}
    <instancedMesh ref={legs} args={[shapes.cylinder, undefined, 4]} castShadow><meshStandardMaterial color={face} roughness={.9} /></instancedMesh>
    <group ref={body}>
      <mesh geometry={woolGeometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.93} /></mesh>
    </group>
    <group ref={head} position={[0, 1.06, .78]}>
      <mesh geometry={headParts} castShadow><meshStandardMaterial vertexColors roughness={.8} /></mesh>
    </group>
    {accents && <mesh geometry={accents} castShadow><meshStandardMaterial vertexColors roughness={.7} emissive={/aurora|moon|star/.test(breed?.id || '') ? '#f7d590' : '#000000'} emissiveIntensity={.22} /></mesh>}
    {(selected || hovered) && <Html position={[0, 2.27, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><div className="world-label">{data.name}<span>{data.hunger < 30 ? '有点饿啦' : data.wool >= 100 ? '可以剪毛啦' : breed?.name || '云朵羊'}</span></div></Html>}
  </group>
})

export function SheepPortrait({ breed, scale = 1 }: { breed?: Breed; scale?: number }) {
  const parts = useMemo(() => headGeometry(breed?.faceColor || '#69574b', breed?.color || '#f2e8ce'), [breed?.id])
  useEffect(() => () => parts.dispose(), [parts])
  return <group scale={scale} rotation={[0, .3, 0]}><mesh geometry={woolGeometry}><meshStandardMaterial color={breed?.color || '#f2e8ce'} roughness={.9} /></mesh><mesh geometry={parts} position={[0, 1.06, .78]}><meshStandardMaterial vertexColors /></mesh></group>
}
