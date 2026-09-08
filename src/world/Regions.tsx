import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ForageNode, GrazingState, Season, Vec2 } from '../game/types'
import regions from '../game/regions.json'
import { Batch, random, regionPaths, ribbon, shapes } from './geometry'
import { flower, tree } from './Environment'
import { seasonArt } from './seasons'
import type { InteractionTarget } from './World'
import type { WorldPlayer } from './Sheep'

type RegionId = 'meadow' | 'forest' | 'highland'


function nearPath(x: number, z: number, paths: number[][][], width = 2) {
  return paths.some(path => path.some((a, i) => {
    if (!i) return false
    const b = path[i - 1], dx = a[0] - b[0], dz = a[1] - b[1]
    const t = THREE.MathUtils.clamp(((x - b[0]) * dx + (z - b[1]) * dz) / (dx * dx + dz * dz), 0, 1)
    return Math.hypot(x - b[0] - t * dx, z - b[1] - t * dz) < width
  }))
}

function mushroom(b: Batch, x: number, z: number, size: number, color = '#c88161') {
  b.add('cylinder', '#f0d9ae', [x, size * .27, z], [size * .1, size * .54, size * .1])
  b.add('sphere', color, [x, size * .61, z], [size * .42, size * .24, size * .39])
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4
    b.add('sphere', '#f9ecca', [x + Math.cos(angle) * size * .23, size * (.77 + i % 2 * .025), z + Math.sin(angle) * size * .21], [size * .065, size * .025, size * .065])
  }
}

function fern(b: Batch, x: number, z: number, scale = 1) {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, height = (.4 + i % 3 * .08) * scale
    b.beam('#5d8055', [x, .03, z], [x + Math.cos(a) * scale * .38, height, z + Math.sin(a) * scale * .38], .025 * scale)
    for (let j = 1; j < 4; j++) b.add('leaf', i % 2 ? '#769b67' : '#a0b77a', [x + Math.cos(a) * j * scale * .12, height * j / 4, z + Math.sin(a) * j * scale * .12], [scale * .09, .04 * scale, .19 * scale], [.15, -a + .5, .3])
  }
}

function sign(b: Batch, x: number, z: number, color: string) {
  b.add('box', '#937751', [x, 1, z], [.18, 2, .18])
  b.add('box', '#c6a875', [x, 1.68, z], [1.75, .75, .18], [0, 0, -.06])
  b.add('box', color, [x, 1.7, z + .1], [1.47, .5, .025], [0, 0, -.06])
  b.add('sphere', '#e8dbb0', [x + .55, 1.7, z + .13], [.07, .07, .03])
}

function landscape(id: RegionId, season: Season) {
  const b = new Batch(seasonArt[season].palette), rand = random(id === 'meadow' ? 361 : id === 'forest' ? 861 : 1621)
  const region = regions[id]
  // Every region has a continuous walking surface and its own plant palette.
  for (const points of regionPaths[id]) b.geometry(ribbon(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), id === 'highland' ? 1.4 : 1.65, .044), id === 'highland' ? '#c6bea8' : '#baae8b')
  sign(b, region.gate.x + (id === 'forest' ? 0 : 2.2), region.gate.z + (id === 'forest' ? -2 : 0), id === 'meadow' ? '#91a779' : id === 'forest' ? '#658b76' : '#8e8eae')
  if (id === 'meadow') {
    for (const [x, z, s] of [[-28, 22, 1.9], [-27, 33, 1.65], [-22, 36, 1.35], [-8, 36, 1.7], [4, 33, 1.4], [7, 24, 1.4]]) tree(b, x, z, s, Math.round(x * x + z))
    for (let patch = 0; patch < 32; patch++) {
      const a = patch * 2.4, rad = 8 + rand() * 8, x = -10 + Math.cos(a) * rad, z = 27 + Math.sin(a) * rad * .5
      if (nearPath(x, z, regionPaths.meadow) || Math.hypot(x + 20, z - 28) < 3.2) continue
      for (let i = 0; i < 4; i++) flower(b, x + (rand() - .5) * 1.2, .01, z + (rand() - .5), ['#fbf1d4', '#e5c2cf', '#e8d493'][patch % 3], 1 + rand() * .7)
    }
    // A shallow spring can be reached from the end of the pasture trail.
    for (let i = 0; i < 17; i++) {
      const a = i / 17 * Math.PI * 2, size = .36 + rand() * .28
      b.add('sphere', ['#a4ad99', '#c1bea3', '#96a88c'][i % 3], [-20 + Math.cos(a) * 2.35, .17, 28 + Math.sin(a) * 1.8], [size, size * .65, size * .85], [.1, a, 0])
    }
    for (let i = 0; i < 9; i++) {
      const x = -22.2 + rand() * .7, z = 27 + rand() * 2, h = .6 + rand() * .5
      b.add('cylinder', '#709052', [x, h / 2, z], [.025, h, .025])
      b.add('sphere', '#ab9870', [x, h, z], [.05, .15, .05])
    }
    sign(b, -7, 30, '#91a779')
  } else if (id === 'forest') {
    const trees = [[19, -9], [24, -11], [28, -9], [37, -13], [43, -11], [45, -5], [44, 2], [45, 13], [40, 17], [34, 17], [26, 17], [20, 13], [22, -2], [29, 7], [36, 1], [40, -3], [33, 12]]
    trees.forEach(([x, z], i) => tree(b, x, z, 1.4 + rand() * .85, 341 + i))
    for (let i = 0; i < 24; i++) {
      const x = 20 + rand() * 24, z = -12 + rand() * 29
      if (nearPath(x, z, regionPaths.forest, 1.6) || regions.forest.forageNodes.some(n => Math.hypot(x - n.position.x, z - n.position.z) < 1.8)) continue
      if (i % 3) fern(b, x, z, .65 + rand() * .6)
      else mushroom(b, x, z, .3 + rand() * .22, '#d9ae83')
    }
    // Mossy fallen logs make small clearings, away from the walking routes.
    for (const [x, z, angle] of [[26, -6, .6], [39, 13, -.3], [20, 9, .2]]) {
      b.add('cylinder', '#82694f', [x, .38, z], [.43, 3.2, .43], [Math.PI / 2, 0, angle])
      b.add('sphere', '#8da276', [x, .64, z], [1.2, .17, .43], [0, angle, 0])
      for (let i = 0; i < 3; i++) mushroom(b, x - .6 + i * .6, z + .7, .35, '#bd846a')
    }
    // The little woodland footbridge spans a quiet side stream.
    for (let i = 0; i < 10; i++) b.add('box', i % 3 ? '#ae9268' : '#c7ab7e', [27.2 + i * .29, .14, 3.2], [.27, .2, 2.25], [0, -.25, 0])
    for (const z of [2.05, 4.35]) for (const x of [27.15, 29.85]) b.add('box', '#8b7353', [x, .6, z], [.13, 1.2, .13])
    for (const z of [2.05, 4.35]) b.beam('#ba9d70', [27.15, .99, z], [29.85, .99, z], .11)
  } else {
    // Low alpine rocks and flowers keep the sky open around the viewing circle.
    for (let i = 0; i < 23; i++) {
      const a = i * 2.4, rad = 11 + rand() * 7, x = 42 + Math.cos(a) * rad, z = -30 + Math.sin(a) * rad * .65
      if (nearPath(x, z, regionPaths.highland, 2.8)) continue
      const size = .8 + rand() * 1.5
      b.add('sphere', ['#a8aca7', '#bec0b2', '#929ea0'][i % 3], [x, size * .32, z], [size * 1.3, size * .72, size], [.12, a, .15])
      if (i % 3 === 0) b.add('sphere', '#d8d6c2', [x, size * .76, z], [size * .75, .12, size * .63])
    }
    for (let i = 0; i < 65; i++) {
      const x = 24 + rand() * 33, z = -42 + rand() * 24
      if (nearPath(x, z, regionPaths.highland) || Math.hypot(x - 43, z + 30) < 3.5) continue
      flower(b, x, .01, z, ['#d5cbe1', '#f8edd0', '#b2c7d0'][i % 3], .8 + rand() * .45)
    }
    for (let i = 0; i < 13; i++) {
      const a = i / 13 * Math.PI * 2
      b.add('sphere', '#c1bba5', [43 + Math.cos(a) * 3.4, .06, -30 + Math.sin(a) * 3.4], [.33, .1, .28], [0, a, 0])
    }
    // A handmade telescope on a tripod: a clear destination at the end of the trail.
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2
      b.beam('#967c5b', [43 + Math.cos(a) * .72, .05, -30 + Math.sin(a) * .72], [43, 1.32, -30], .11)
    }
    b.add('cylinder', '#729d98', [43, 1.66, -30], [.19, 1.5, .19], [.94, 0, -.35])
    b.add('torus', '#d6ba7d', [42.78, 2.08, -29.4], [.2, .2, .2], [.98, 0, -.35])
    sign(b, 45.8, -27.2, '#8e8eae')
    for (const [x, z] of [[23, -28], [27, -38], [56, -24], [52, -42]]) {
      b.add('cylinder', '#8d8068', [x, 1.45, z], [.16, 2.9, .16])
      for (let tier = 0; tier < 3; tier++) b.add('cone', ['#759387', '#8ca79a', '#a1b8a4'][tier], [x, 1.6 + tier * .75, z], [1.15 - tier * .2, 1.8 - tier * .22, 1.15 - tier * .2])
    }
  }
  return b.buildColored()!
}

function RegionLandscape({ id, season }: { id: RegionId; season: Season }) {
  const geometry = useMemo(() => landscape(id, season), [id, season])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.94} /></mesh>
}

function PlaceMarker({ position, title, subtitle, target, player, onInteract, color = '#f5deb0', range = 12 }: {
  position: Vec2; title: string; subtitle: string; target: InteractionTarget; player: WorldPlayer; onInteract: (target: InteractionTarget) => void; color?: string; range?: number
}) {
  const [nearby, setNearby] = useState(false), [hovered, setHovered] = useState(false)
  const nearbyRef = useRef(false), ring = useRef<THREE.Mesh>(null)
  useFrame(state => {
    const near = Math.hypot(player.position.x - position.x, player.position.z - position.z) < range
    if (near !== nearbyRef.current) { nearbyRef.current = near; setNearby(near) }
    if (ring.current) { ring.current.rotation.z = state.clock.elapsedTime * .08; ring.current.visible = near || hovered }
  })
  return <group position={[position.x, 0, position.z]}>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, .072, 0]}><ringGeometry args={[.95, 1.04, 40]} /><meshBasicMaterial color={color} transparent opacity={.65} /></mesh>
    <mesh position={[0, 1, 0]} onClick={e => { e.stopPropagation(); onInteract(target) }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}><cylinderGeometry args={[1.1, 1.1, 2, 10]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    {(nearby || hovered) && <Html position={[0, 2.55, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><div className="world-label">{title}<span>{subtitle}</span></div></Html>}
  </group>
}

function RegionGate({ id, locked, player, onInteract }: { id: RegionId; locked: boolean; player: WorldPlayer; onInteract: (target: InteractionTarget) => void }) {
  const region = regions[id], mist = useRef<THREE.Group>(null)
  const label = locked ? id === 'meadow' ? '完成第一份订单后开放' : id === 'forest' ? '完成首次繁育后开放' : '收集物资，修好通往高地的小径' : id === 'meadow' ? '带羊群去花坡散步' : id === 'forest' ? '树林里藏着蘑菇与香草' : '沿着小径，去看一场星落'
  useFrame(state => { if (mist.current) mist.current.position.y = .7 + Math.sin(state.clock.elapsedTime * .4) * .1 })
  return <>
    <PlaceMarker position={region.gate} title={`${locked ? '◇ ' : ''}${region.name}`} subtitle={label} target={{ type: 'region', id }} player={player} onInteract={onInteract} range={id === 'highland' ? 12 : 10} />
    {locked && <group position={[region.gate.x, 0, region.gate.z]} rotation={[0, id === 'forest' ? Math.PI / 2 : 0, 0]}>
      <mesh position={[0, .8, 0]}><boxGeometry args={[3.5, .12, .13]} /><meshStandardMaterial color="#b5a583" roughness={1} /></mesh>
      {[-1.7, 1.7].map(x => <mesh key={x} position={[x, .6, 0]}><boxGeometry args={[.14, 1.2, .14]} /><meshStandardMaterial color="#9c896c" /></mesh>)}
      <group ref={mist}>{[-1, 0, 1].map(i => <mesh key={i} position={[i * 1.7, Math.abs(i) * .13, -.55]} geometry={shapes.sphere} scale={[2, .72, 1.3]}><meshBasicMaterial color="#cbd8ce" transparent opacity={.24} depthWrite={false} /></mesh>)}</group>
    </group>}
  </>
}

function Forage({ node, player, serverTimeOffset, onInteract }: { node: ForageNode; player: WorldPlayer; serverTimeOffset: number; onInteract: (target: InteractionTarget) => void }) {
  const [ready, setReady] = useState(Date.now() + serverTimeOffset >= node.readyAt)
  useEffect(() => {
    const delay = Math.max(0, node.readyAt - Date.now() - serverTimeOffset)
    setReady(delay === 0)
    if (!delay) return
    const timer = window.setTimeout(() => setReady(true), delay + 50)
    return () => window.clearTimeout(timer)
  }, [node.readyAt, serverTimeOffset])
  const geometry = useMemo(() => {
    const b = new Batch()
    if (node.itemId === 'mushroom') {
      mushroom(b, -.38, .13, .88); mushroom(b, .34, -.16, .62); mushroom(b, .11, .46, .42)
      b.add('leaf', '#90a16f', [0, .04, 0], [.92, .05, .8])
    } else { fern(b, 0, 0, 1.1); flower(b, .18, .06, -.08, '#d0c1dd', 1.1) }
    return b.buildColored()!
  }, [node.itemId])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <group>
    <mesh geometry={geometry} position={[node.position.x, 0, node.position.z]} scale={ready ? 1 : .25} castShadow receiveShadow onClick={e => { e.stopPropagation(); onInteract({ type: 'forage', id: node.id }) }}><meshStandardMaterial vertexColors roughness={.95} /></mesh>
    <PlaceMarker position={node.position} title={node.itemId === 'mushroom' ? '林间蘑菇' : '山谷香草'} subtitle={ready ? '走近一点，轻轻采下' : '正在慢慢长回来'} target={{ type: 'forage', id: node.id }} player={player} onInteract={onInteract} color={ready ? '#f0d5a0' : '#b8c2aa'} range={5} />
  </group>
}

export const Regions = memo(function Regions({ season = '春日', progressionStep, player, grazing, forageNodes = [], serverTimeOffset = 0, onInteract }: {
  season?: Season; progressionStep: number; player: WorldPlayer; grazing?: GrazingState; forageNodes?: ForageNode[]; serverTimeOffset?: number; onInteract: (target: InteractionTarget) => void
}) {
  const spring = useMemo(() => { const geometry = new THREE.CircleGeometry(1, 40); geometry.rotateX(-Math.PI / 2); return geometry }, [])
  const woodlandStream = useMemo(() => ribbon([[25.5, -1], [27.5, 1], [28.6, 3.2], [30, 6], [32.8, 8]].map(([x, z]) => new THREE.Vector3(x, 0, z)), .94, .037), [])
  useEffect(() => () => { spring.dispose(); woodlandStream.dispose() }, [spring, woodlandStream])
  return <>
    {(['meadow', 'forest', 'highland'] as const).map(id => <group key={id}><RegionLandscape id={id} season={season} /><RegionGate id={id} locked={progressionStep < regions[id].unlockStep} player={player} onInteract={onInteract} /></group>)}
    <mesh geometry={spring} position={[-20, .032, 28]} scale={[2.27, 1, 1.73]}><meshStandardMaterial color="#7fb7ac" roughness={.25} metalness={.08} /></mesh>
    <mesh geometry={woodlandStream}><meshStandardMaterial color="#729f93" roughness={.37} /></mesh>
    {progressionStep === 0 && <PlaceMarker position={{ x: -6, z: 3 }} title="安一个小小的家" subtitle="从一间羊舍开始" target={{ type: 'build', id: 'shelter' }} player={player} onInteract={onInteract} range={18} />}
    {progressionStep === 5 && <PlaceMarker position={{ x: 2, z: 1 }} title="开垦第一片菜园" subtitle="亲手种出羊羊喜欢的食物" target={{ type: 'build', id: 'garden' }} player={player} onInteract={onInteract} range={18} />}
    {progressionStep >= 10 && <>
      <PlaceMarker position={regions.meadow.grazePoint} title="铃兰草甸" subtitle={grazing?.active ? '留一会儿，让羊群慢慢吃饱' : '吹声口哨，开始今天的放牧'} target={{ type: 'graze' }} player={player} onInteract={onInteract} range={12} />
      <PlaceMarker position={regions.meadow.waterPoint} title="清清泉水" subtitle={grazing?.watered ? '羊羊们已经喝饱啦' : '带羊群来喝一口山泉'} target={{ type: 'water' }} player={player} onInteract={onInteract} range={8} />
      {grazing?.active && <PlaceMarker position={regions.home.returnPoint} title="带羊羊回家" subtitle="走进牧场，结束这次散步" target={{ type: 'home' }} player={player} onInteract={onInteract} range={9} />}
    </>}
    {progressionStep >= 13 && forageNodes.map(node => <Forage key={node.id} node={node} player={player} serverTimeOffset={serverTimeOffset} onInteract={onInteract} />)}
    {progressionStep >= 15 && <PlaceMarker position={regions.highland.viewPoint} title="星落观景台" subtitle="坐看山谷，等星光慢慢亮起" target={{ type: 'viewpoint' }} player={player} onInteract={onInteract} color="#d9cee9" range={12} />}
  </>
})
