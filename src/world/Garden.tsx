import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Crop, Plot } from '../game/types'
import { Batch, hash, random } from './geometry'

function createCrop(id: string, color: string, seed: number) {
  const b = new Batch(), rand = random(seed)
  const count = /pumpkin/.test(id) ? 3 : 9
  for (let plant = 0; plant < count; plant++) {
    const x = /pumpkin/.test(id) ? Math.cos(plant * 2.4) * .33 : (plant % 3 - 1) * .39
    const z = /pumpkin/.test(id) ? Math.sin(plant * 2.4) * .33 : (Math.floor(plant / 3) - 1) * .39
    const size = .83 + rand() * .3
    if (/pumpkin/.test(id)) {
      for (let lobe = 0; lobe < 7; lobe++) {
        const a = lobe * Math.PI * 2 / 7
        b.add('sphere', color, [x + Math.cos(a) * .14, .2, z + Math.sin(a) * .14], [.155, .22, .155])
      }
      b.add('cylinder', '#6f7940', [x, .43, z], [.04, .17, .04], [0, 0, -.2])
      b.add('leaf', '#789449', [x + .2, .12, z + .22], [.2, .045, .21], [0, plant, .1])
      b.beam('#769047', [x, .07, z], [x + .32, .07, z + .25], .04)
    } else if (/carrot/.test(id)) {
      b.add('sphere', '#e8a14d', [x, .08, z], [.1, .18, .1])
      for (let leaf = 0; leaf < 5; leaf++) {
        const a = leaf * 2.4
        b.add('leaf', leaf % 2 ? '#77a54c' : '#5b8b3f', [x + Math.cos(a) * .08, .29 * size, z + Math.sin(a) * .08], [.045, .25 * size, .065], [Math.cos(a) * .5, 0, Math.sin(a) * .5])
      }
    } else if (/wheat/.test(id)) {
      for (let stalk = 0; stalk < 3; stalk++) {
        const sx = x + Math.cos(stalk * 2.4) * .06, sz = z + Math.sin(stalk * 2.4) * .06
        b.add('cylinder', '#a1a258', [sx, .3 * size, sz], [.014, .6 * size, .014])
        for (let grain = 0; grain < 5; grain++) {
          const side = grain % 2 ? -1 : 1
          b.add('sphere', color, [sx + side * .036, (.46 + grain * .053) * size, sz], [.045, .073, .034], [0, 0, side * -.4])
        }
        b.add('leaf', '#a5ae60', [sx + .06, .26, sz], [.026, .22, .02], [0, 0, -.4])
      }
    } else if (/lavender/.test(id)) {
      for (let stalk = 0; stalk < 3; stalk++) {
        const sx = x + (stalk - 1) * .07, height = (.45 + rand() * .2) * size
        b.add('cylinder', '#688949', [sx, height / 2, z], [.015, height, .015])
        for (let flower = 0; flower < 4; flower++) b.add('sphere', flower % 2 ? '#c6a7d4' : color, [sx, height - flower * .08, z], [.044 + flower * .007, .07, .045 + flower * .007])
      }
      b.add('leaf', '#719254', [x, .19, z], [.11, .23, .06], [0, 0, .25])
    } else if (/daisy|moonflower/.test(id)) {
      const height = (.38 + rand() * .18) * size
      b.add('cylinder', '#749a4c', [x, height / 2, z], [.018, height, .018])
      for (let p = 0; p < 7; p++) {
        const a = p * Math.PI * 2 / 7
        b.add('sphere', color, [x + Math.cos(a) * .092, height, z + Math.sin(a) * .092], [.09, .035, .047], [0, -a, 0])
      }
      b.add('sphere', /moonflower/.test(id) ? '#b8daea' : '#e9be5d', [x, height + .025, z], [.06, .04, .06])
      for (const side of [-1, 1]) b.add('leaf', '#7ba258', [x + side * .07, height * .5, z], [.095, .035, .07], [0, side * .7, side * .35])
    } else {
      for (let sprig = 0; sprig < 3; sprig++) {
        const a = sprig * 2.4, sx = x + Math.cos(a) * .07, sz = z + Math.sin(a) * .07
        b.add('cylinder', '#6a9043', [sx, .11, sz], [.016, .22, .016])
        for (let leaf = 0; leaf < 3; leaf++) { const angle = leaf * 2.094; b.add('leaf', color, [sx + Math.cos(angle) * .061, .23 + sprig * .015, sz + Math.sin(angle) * .061], [.092, .028, .077], [.05, angle, 0]) }
      }
    }
  }
  return b.buildColored()!
}

const plotBase = (() => {
  const b = new Batch()
  b.add('box', '#8d6b44', [0, .085, 0], [1.48, .17, 1.48])
  for (const side of [-1, 1]) {
    b.add('box', '#ac8650', [side * .73, .14, 0], [.055, .18, 1.51])
    b.add('box', '#ac8650', [0, .14, side * .73], [1.51, .18, .055])
  }
  for (let ridge = 0; ridge < 5; ridge++) b.add('box', '#a57d4d', [ridge * .27 - .54, .17, 0], [.085, .045, 1.28])
  return b.buildColored()!
})()

export const GardenPlot = memo(function GardenPlot({ plot, crop, selected, onSelect, serverTimeOffset = 0 }: { plot: Plot; crop?: Crop; selected: boolean; onSelect: (id: string) => void; serverTimeOffset?: number }) {
  const [hovered, setHovered] = useState(false)
  const plants = useRef<THREE.Group>(null), soil = useRef<THREE.MeshStandardMaterial>(null), glow = useRef<THREE.Mesh>(null)
  const parts = useMemo(() => plot.cropId ? createCrop(plot.cropId, crop?.color || '#96b859', hash(plot.id)) : null, [plot.cropId, crop?.color, plot.id])
  useEffect(() => () => parts?.dispose(), [parts])
  const [isReady, setIsReady] = useState(false)
  useEffect(() => { setIsReady(false) }, [plot.plantedAt])
  useFrame(state => {
    if (!plot.cropId) return
    const now = Date.now() + serverTimeOffset
    const progress = plot.wateredAt > 0 && plot.readyAt > 0 ? Math.min(1, Math.max(0, (now - plot.wateredAt) / Math.max(1, plot.readyAt - plot.wateredAt))) : 0
    if (plants.current) {
      const scale = .2 + progress * .8
      plants.current.scale.set(.62 + progress * .38, scale, .62 + progress * .38)
      plants.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.2 + hash(plot.id)) * .015
    }
    if (glow.current) { glow.current.visible = progress >= 1; (glow.current.material as THREE.MeshBasicMaterial).opacity = .25 + Math.sin(state.clock.elapsedTime * 2) * .12 }
    if (progress >= 1 && !isReady) setIsReady(true)
  })
  const wet = plot.wateredAt >= plot.plantedAt && !!plot.wateredAt && !!plot.cropId
  return <group position={[plot.position.x, 0, plot.position.z]} onClick={e => { e.stopPropagation(); onSelect(plot.id) }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}>
    <mesh geometry={plotBase} receiveShadow castShadow><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .186, 0]} receiveShadow><planeGeometry args={[1.36, 1.36]} /><meshStandardMaterial ref={soil} color={wet ? '#75583d' : '#9c774a'} roughness={1} /></mesh>
    <group ref={plants} position={[0, .19, 0]}>{parts && <mesh geometry={parts} castShadow><meshStandardMaterial vertexColors roughness={.9} emissive={plot.cropId === 'moonflower' ? '#b7c9da' : '#000000'} emissiveIntensity={.25} /></mesh>}</group>
    <mesh ref={glow} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, .195, 0]}><ringGeometry args={[.75, .79, 4]} /><meshBasicMaterial color="#ffe19b" transparent opacity={.3} depthWrite={false} /></mesh>
    {(hovered || selected) && <>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, .21, 0]}><ringGeometry args={[1.035, 1.09, 4]} /><meshBasicMaterial color="#ffe6a9" transparent opacity={.9} /></mesh>
      <Html position={[0, 1.12, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><div className="world-label">{crop?.name || '松软的土地'}<span>{!plot.cropId ? '种下新的期待' : isReady || (wet && plot.readyAt > 0 && Date.now() + serverTimeOffset >= plot.readyAt) ? '成熟啦 · 可以收获' : wet ? '正在努力生长' : '需要一点水'}</span></div></Html>
    </>}
  </group>
})
