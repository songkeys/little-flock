import { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { AvatarAppearance, Breed, Crop, ForageNode, GrazingState, Player, Plot, Season, Sheep as SheepData, Vec2 } from '../game/types'
import { Environment, NightLights } from './Environment'
import { Sheep, type ActionEffect, type WorldPlayer } from './Sheep'
import { Shepherd } from './Shepherd'
import { GardenPlot } from './Garden'
import { ActionParticles, Butterflies, ChimneySmoke, Fireflies, Rain } from './Atmosphere'
import { getLockedRegion, shapes, walkablePosition, type V3 } from './geometry'
import { Regions } from './Regions'

export { walkablePosition, getWalkPath, getLockedRegion } from './geometry'
export type { WorldPlayer, ActionEffect } from './Sheep'
export type InteractionTarget = { type: 'sheep' | 'plot' | 'shop' | 'home' | 'board' | 'region' | 'forage' | 'water' | 'graze' | 'build' | 'viewpoint'; id?: string }
export interface WorldProps {
  sheep: SheepData[]
  plots: Plot[]
  breeds?: Breed[]
  crops?: Crop[]
  player: WorldPlayer
  avatar?: AvatarAppearance
  playerId?: string
  remotePlayers?: Player[]
  progressionStep?: number
  buildings?: { shelter: boolean; garden: boolean }
  grazing?: GrazingState
  forageNodes?: ForageNode[]
  dayProgress?: number
  weather?: 'sunny' | 'rain'
  selected?: InteractionTarget | null
  quality?: 'high' | 'low'
  target?: Vec2 | null
  actionEffect?: ActionEffect | null
  whistle?: { position: Vec2; at: number } | null
  serverTimeOffset?: number
  sheepPositions?: Record<string, Vec2>
  upgrades?: { pasture: number; watering: number }
  season?: Season
  cameraForward?: Vec2
  onMove: (position: Vec2) => void
  onInteract: (target: InteractionTarget) => void
}

function CameraRig({ player, cameraForward }: { player: WorldPlayer; cameraForward?: Vec2 }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const firstFrame = useRef(true)
  const lastFocus = useRef(new THREE.Vector3(1, 0, 1.5))
  const forward = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    if (!controls.current) return
    if (firstFrame.current) { controls.current.target.copy(lastFocus.current); firstFrame.current = false }
    // Keep a generous view of the whole farm, following gently as the player explores.
    const exploring = THREE.MathUtils.smoothstep(Math.max(Math.abs(player.position.x), Math.abs(player.position.z - 3)), 11, 24)
    const desiredX = THREE.MathUtils.lerp(1 + player.position.x * .42, player.position.x, exploring)
    const desiredZ = THREE.MathUtils.lerp(1.5 + (player.position.z - 6) * .42, player.position.z, exploring)
    const dx = (desiredX - lastFocus.current.x) * Math.min(1, dt * 1.3)
    const dz = (desiredZ - lastFocus.current.z) * Math.min(1, dt * 1.3)
    controls.current.target.x += dx; controls.current.target.z += dz
    state.camera.position.x += dx; state.camera.position.z += dz
    lastFocus.current.x += dx; lastFocus.current.z += dz
    controls.current.update()
    if (cameraForward) {
      state.camera.getWorldDirection(forward)
      const length = Math.hypot(forward.x, forward.z)
      cameraForward.x = forward.x / length; cameraForward.z = forward.z / length
    }
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.07} minDistance={17} maxDistance={65} minPolarAngle={.45} maxPolarAngle={1.13} enablePan={false} rotateSpeed={.58} zoomSpeed={.65} mouseButtons={{ LEFT: undefined, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }} />
}

function Lighting({ dayProgress, rain, quality, player, shelterBuilt, gardenBuilt }: { dayProgress: number; rain: boolean; quality: 'high' | 'low'; player: WorldPlayer; shelterBuilt: boolean; gardenBuilt: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null), sunTarget = useMemo(() => new THREE.Object3D(), [])
  const daylight = Math.sin((dayProgress - .25) * Math.PI * 2)
  const day = THREE.MathUtils.smoothstep(daylight, -.12, .35)
  const night = 1 - day
  const background = useMemo(() => new THREE.Color('#9cbfc5').lerp(new THREE.Color('#c9e3dd'), day).lerp(new THREE.Color('#283b58'), night), [day, night])
  const { scene } = useThree()
  useEffect(() => {
    scene.background = background
    scene.fog = new THREE.Fog(background, 54, 125)
    return () => { scene.fog = null }
  }, [background, scene])
  useFrame(() => {
    if (!sun.current) return
    sunTarget.position.set(player.position.x, 0, player.position.z)
    sun.current.position.set(player.position.x - 19, 31, player.position.z + 14)
  })
  return <>
    <hemisphereLight args={['#e5f1eb', '#7a886d', .7 + day * .4]} />
    <ambientLight intensity={.13 + night * .22} color={night > .5 ? '#9baede' : '#ffffff'} />
    <primitive object={sunTarget} />
    <directionalLight ref={sun} target={sunTarget} position={[-19, 31, 14]} color={night > .5 ? '#b7c9f0' : daylight < .2 ? '#ffe0b4' : '#fff7eb'} intensity={(rain ? 1.25 : 2) * day + .3} castShadow shadow-mapSize={quality === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-29} shadow-camera-right={29} shadow-camera-top={29} shadow-camera-bottom={-29} shadow-camera-far={95} shadow-camera-near={1} shadow-normalBias={.055} shadow-bias={-.00012} shadow-radius={3} />
    <directionalLight position={[15, 12, -22]} intensity={.28 + day * .25} color="#cad9b5" />
    <NightLights night={night} shelterBuilt={shelterBuilt} gardenBuilt={gardenBuilt} /><Fireflies night={night} />
    {night > .45 && !rain && <Stars radius={100} depth={35} count={720} factor={2} saturation={.2} fade speed={.15} />}
  </>
}

function Landmark({ type, position, size, label, subtitle, onInteract }: { type: 'shop' | 'home' | 'board'; position: V3; size: V3; label: string; subtitle: string; onInteract: WorldProps['onInteract'] }) {
  const [hovered, setHovered] = useState(false)
  return <group position={position}>
    <mesh onClick={e => { e.stopPropagation(); onInteract({ type }) }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }} onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}>
      <boxGeometry args={size} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {hovered && <Html position={[0, size[1] / 2 + .55, 0]} center style={{ whiteSpace: 'nowrap', pointerEvents: 'none' }}><div className="world-label">{label}<span>{subtitle}</span></div></Html>}
  </group>
}

function Destination({ target, player }: { target?: Vec2 | null; player: WorldPlayer }) {
  const ring = useRef<THREE.Group>(null)
  useFrame(state => {
    if (!ring.current || !target) return
    ring.current.visible = Math.hypot(player.position.x - target.x, player.position.z - target.z) > .25
    ring.current.rotation.y = state.clock.elapsedTime * .5
    ring.current.scale.setScalar(.85 + Math.sin(state.clock.elapsedTime * 3) * .08)
  })
  return target ? <group ref={ring} position={[target.x, .07, target.z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.28, .33, 32]} /><meshBasicMaterial color="#fff1c6" transparent opacity={.9} /></mesh>
    <mesh geometry={shapes.sphere} scale={[.065, .025, .065]}><meshBasicMaterial color="#fff1c6" /></mesh>
  </group> : null
}

function Scene(props: WorldProps) {
  const { sheep, plots, breeds = [], crops = [], player, remotePlayers = [], dayProgress = .35, weather = 'sunny', selected, quality = 'high', onMove, onInteract, target, actionEffect, whistle, serverTimeOffset = 0, sheepPositions, progressionStep = 15, grazing } = props
  const shelterBuilt = props.buildings?.shelter ?? progressionStep > 0
  const gardenBuilt = props.buildings?.garden ?? progressionStep >= 6
  const grazingLeader = grazing?.active ? grazing.leaderId === props.playerId ? player : remotePlayers.find(remote => remote.id === grazing.leaderId) : undefined
  const breedMap = useMemo(() => new Map(breeds.map(b => [b.id, b])), [breeds])
  const cropMap = useMemo(() => new Map(crops.map(c => [c.id, c])), [crops])
  const internalPositions = useRef<Record<string, Vec2>>({})
  const positions = sheepPositions || internalPositions.current
  useEffect(() => { const ids = new Set(sheep.map(s => s.id)); for (const id in positions) if (!ids.has(id)) delete positions[id] }, [sheep, positions])
  const effectPosition = actionEffect?.targetId ? positions[actionEffect.targetId] || sheep.find(s => s.id === actionEffect.targetId)?.position || plots.find(p => p.id === actionEffect.targetId)?.position || player.position : player.position
  return <>
    <Lighting dayProgress={dayProgress} rain={weather === 'rain'} quality={quality} player={player} shelterBuilt={shelterBuilt} gardenBuilt={gardenBuilt} />
    <CameraRig player={player} cameraForward={props.cameraForward} />
    <Environment pastureLevel={props.upgrades?.pasture} wateringLevel={props.upgrades?.watering} season={props.season} shelterBuilt={shelterBuilt} gardenBuilt={gardenBuilt} />
    <Regions season={props.season} progressionStep={progressionStep} player={player} grazing={grazing} forageNodes={props.forageNodes} serverTimeOffset={serverTimeOffset} onInteract={onInteract} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .008, 0]} onClick={e => { if (e.delta > 8) return; e.stopPropagation(); const point = { x: e.point.x, z: e.point.z }; const locked = getLockedRegion(point, progressionStep); if (locked) onInteract({ type: 'region', id: locked }); else onMove(walkablePosition(point, undefined, progressionStep)) }}>
      <planeGeometry args={[180, 180]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {gardenBuilt && plots.map(plot => <GardenPlot key={plot.id} plot={plot} crop={cropMap.get(plot.cropId || '')} selected={selected?.type === 'plot' && selected.id === plot.id} onSelect={id => onInteract({ type: 'plot', id })} serverTimeOffset={serverTimeOffset} />)}
    {sheep.map(data => <Sheep key={data.id} data={data} breed={breedMap.get(data.breedId)} selected={selected?.type === 'sheep' && selected.id === data.id} onSelect={id => onInteract({ type: 'sheep', id })} actionEffect={actionEffect} whistle={whistle} serverTimeOffset={serverTimeOffset} positions={positions} grazing={grazing} grazingLeader={grazingLeader} progressionStep={progressionStep} />)}
    <Shepherd player={player} avatar={props.avatar} />
    {remotePlayers.map(remote => <Shepherd key={remote.id} player={remote} username={remote.username} remote serverTimeOffset={serverTimeOffset} />)}
    {shelterBuilt && <Landmark type="home" position={[-10, 2.75, -9]} size={[6.05, 5.5, 6.6]} label="暖暖的小屋" subtitle="把日子过成喜欢的样子" onInteract={onInteract} />}
    {gardenBuilt && <Landmark type="shop" position={[7, 1.65, 10]} size={[4.1, 3.3, 2.4]} label="松果杂货铺" subtitle="种子、牧草，还有新的期待" onInteract={onInteract} />}
    {gardenBuilt && <Landmark type="board" position={[2.9, 1.1, 5.8]} size={[2.15, 2.2, .48]} label="山谷订单板" subtitle="给远方捎去一点农场的美好" onInteract={onInteract} />}
    <Destination target={target} player={player} />
    <ActionParticles effect={actionEffect} position={effectPosition} />
    {props.season !== '冬日' && <Butterflies />}{shelterBuilt && <ChimneySmoke />}<Rain enabled={weather === 'rain'} position={player.position} />
    {new URLSearchParams(window.location.search).get('debug') === '1' && <SceneStats />}
    {quality === 'high' && <EffectComposer multisampling={0}>
      <N8AO aoRadius={.8} intensity={1.65} distanceFalloff={1} quality="performance" halfRes />
      {(dayProgress < .27 || dayProgress > .76) && <Bloom intensity={.25} luminanceThreshold={1.2} luminanceSmoothing={.5} mipmapBlur />}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>}
  </>
}

function SceneStats() {
  const { gl } = useThree()
  const sample = useRef({ seconds: 0, frames: 0 })
  const [stats, setStats] = useState({ fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 })
  useEffect(() => {
    const previous = gl.info.autoReset
    gl.info.autoReset = false; gl.info.reset()
    return () => { gl.info.autoReset = previous }
  }, [gl])
  useFrame((_, delta) => {
    sample.current.seconds += delta; sample.current.frames++
    if (sample.current.seconds >= 2) {
      setStats({ fps: Math.round(sample.current.frames / sample.current.seconds * 10) / 10, calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures })
      sample.current = { seconds: 0, frames: 0 }
    }
    gl.info.reset()
  }, -100)
  return <Html fullscreen style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}><output data-testid="scene-stats" style={{ position: 'absolute', right: 16, top: 100, padding: '8px 12px', borderRadius: 8, background: '#213d39e8', color: '#ecf2d5', font: '11px/1.6 monospace', whiteSpace: 'pre', pointerEvents: 'none' }}>{JSON.stringify(stats, null, 2)}</output></Html>
}

const World = memo(function World(props: WorldProps) {
  return <Canvas className="farm-canvas" shadows dpr={props.quality === 'low' ? 1 : [1, 1.15]} camera={{ position: [17, 19, 23], fov: 43, near: .1, far: 180 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
    <Suspense fallback={null}><Scene {...props} /></Suspense>
  </Canvas>
})

export default World
