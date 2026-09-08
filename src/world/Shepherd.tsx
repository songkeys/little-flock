import { memo, useEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Batch, shapes, groundHeight } from './geometry'
import type { WorldPlayer } from './Sheep'
import type { AvatarAppearance } from '../game/types'
import { avatarHair, avatarOutfits, avatarSkins, defaultAvatar } from '../game/appearance'

function makeHair(b: Batch, avatar: AvatarAppearance) {
  const hair = avatarHair[avatar.hair], color = hair.color
  b.add('sphere', color, [0, 1.585, -.065], [.27, .205, .24])
  if (hair.style === 'curly' || hair.style === 'coils') {
    const curls = hair.style === 'coils' ? 14 : 10
    for (let i = 0; i < curls; i++) {
      const a = i * 2.4, r = .18 + i % 3 * .022
      b.add('sphere', color, [Math.cos(a) * r, 1.62 + Math.sin(i * 1.7) * .055, Math.sin(a) * r - .025], [.105, .1, .095])
    }
    for (const side of [-1, 1]) b.add('sphere', color, [side * .245, 1.5, -.015], [.067, .12, .1])
  } else {
    for (let i = 0; i < 5; i++) b.add('sphere', color, [(i - 2) * .085, 1.605 + Math.sin(i * .65) * .035, .172], [.074, .085, .06], [0, 0, -.2])
    if (hair.style === 'braids') for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) b.add('sphere', color, [side * (.253 + Math.sin(i * .8) * .028), 1.42 - i * .091, -.008 + i * .025], [.067 - i * .006, .081, .07 - i * .006])
      b.add('sphere', '#d7b780', [side * .28, 1.08, .08], [.055, .04, .047])
    }
    if (hair.style === 'bun') {
      b.add('sphere', color, [0, avatar.hat === 1 ? 1.81 : 1.68, avatar.hat === 1 ? -.13 : -.285], [.16, .14, .14])
      b.add('torus', '#bd976e', [0, avatar.hat === 1 ? 1.77 : 1.63, avatar.hat === 1 ? -.13 : -.285], [.14, .14, .14], [Math.PI / 2, 0, 0])
    }
    if (hair.style === 'bob') for (const side of [-1, 1]) b.add('leaf', color, [side * .227, 1.44, -.045], [.085, .23, .2], [0, 0, side * -.08])
  }
}

function makeHat(b: Batch, avatar: AvatarAppearance) {
  const outfit = avatarOutfits[avatar.outfit]
  if (avatar.hat === 0) {
    b.add('cylinder', '#d8b876', [0, 1.73, -.03], [.47, .06, .42], [0, 0, -.045])
    b.add('sphere', '#dfc58b', [0, 1.85, -.05], [.31, .22, .27])
    b.add('cylinder', outfit.color, [0, 1.779, -.05], [.3, .066, .27])
    b.add('leaf', '#8caa60', [.225, 1.855, .1], [.037, .19, .07], [.3, 0, -.5])
    b.add('sphere', '#f6dfa0', [.257, 1.89, .15], [.055, .055, .038])
  } else if (avatar.hat === 2) {
    b.add('sphere', outfit.color, [.043, 1.78, -.023], [.36, .15, .3], [0, 0, -.16])
    b.add('cylinder', outfit.accent, [0, 1.706, -.026], [.268, .045, .243])
    b.add('cylinder', outfit.color, [.053, 1.935, -.025], [.025, .072, .025], [0, 0, -.24])
    b.add('sphere', '#ead293', [.294, 1.765, .128], [.04, .041, .025])
  } else if (avatar.hat === 3) {
    b.add('torus', '#77905c', [0, 1.695, -.015], [.28, .28, .28], [Math.PI / 2, 0, 0])
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, x = Math.cos(a) * .27, z = Math.sin(a) * .255 - .015
      b.add('leaf', '#95ab6c', [x, 1.708, z], [.075, .028, .115], [0, -a, .15])
      for (let petal = 0; petal < 5; petal++) {
        const p = petal / 5 * Math.PI * 2
        b.add('sphere', i % 3 ? '#f3dbb1' : '#dca8bc', [x + Math.cos(p) * .044, 1.753, z + Math.sin(p) * .044], [.043, .028, .041])
      }
      b.add('sphere', '#e5b968', [x, 1.771, z], [.032, .019, .029])
    }
  }
}

function makeShepherd(avatar: AvatarAppearance) {
  const b = new Batch(), skin = avatarSkins[avatar.skin], outfit = avatarOutfits[avatar.outfit]
  const color = outfit.color, accent = outfit.accent
  b.add('cylinder', color, [0, .93, 0], [.235, .55, .21])
  b.add('sphere', color, [0, 1.16, 0], [.24, .14, .21])
  if (outfit.style === 'overalls') {
    b.add('box', accent, [0, .9, .21], [.31, .36, .045])
    for (const side of [-1, 1]) {
      b.add('box', accent, [side * .115, 1.125, .186], [.05, .19, .052], [0, 0, side * -.08])
      b.add('sphere', '#e6c37a', [side * .115, 1.065, .237], [.022, .022, .012])
    }
    b.add('box', color, [0, .88, .243], [.18, .11, .027])
  } else if (outfit.style === 'knit') {
    b.add('cylinder', accent, [0, 1.205, .004], [.13, .095, .125])
    for (const y of [.84, 1]) b.add('cylinder', accent, [0, y, 0], [.24, .04, .216])
    for (let i = 0; i < 5; i++) b.add('box', accent, [(i - 2) * .074, .922, .22], [.038, .038, .018], [0, 0, Math.PI / 4])
  } else {
    b.add('box', accent, [0, .91, .21], [.028, .38, .014])
    for (let i = 0; i < 3; i++) b.add('sphere', '#ebd5a0', [.054, 1.05 - i * .12, .213], [.018, .018, .011])
    for (const side of [-1, 1]) b.add('box', accent, [side * .135, .84, .19], [.115, .11, .045])
  }
  if (outfit.style === 'scarf') {
    b.add('torus', accent, [0, 1.23, .018], [.16, .14, .14], [Math.PI / 2, 0, 0])
    b.add('box', accent, [-.07, 1.052, .237], [.1, .28, .035], [.07, 0, -.17])
    for (let i = 0; i < 3; i++) b.add('box', accent, [-.098 + i * .032, .896, .245], [.019, .045, .023])
  }
  b.add('box', '#78623f', [0, .74, 0], [.45, .075, .4])
  b.add('box', '#dabb77', [0, .745, .218], [.095, .079, .03])
  b.add('sphere', '#9f714a', [-.265, .79, -.015], [.135, .16, .115])
  b.add('sphere', skin.color, [0, 1.43, 0], [.265, .29, .245])
  makeHair(b, avatar)
  for (const side of [-1, 1]) {
    b.add('sphere', skin.color, [side * .255, 1.42, -.015], [.05, .073, .065])
    b.add('sphere', '#30362e', [side * .096, 1.46, .233], [.027, .047, .018])
    b.add('sphere', '#fff2d5', [side * .09, 1.48, .247], [.008, .012, .007])
    b.add('sphere', skin.blush, [side * .155, 1.365, .19], [.05, .024, .016])
  }
  b.add('sphere', skin.color, [0, 1.387, .25], [.035, .043, .025])
  b.add('sphere', '#8f6050', [0, 1.31, .217], [.036, .014, .012])
  makeHat(b, avatar)
  return b.buildColored()!
}

function makeArm(side: number, avatar: AvatarAppearance) {
  const b = new Batch(), outfit = avatarOutfits[avatar.outfit]
  b.add('cylinder', outfit.color, [side * .025, -.2, .01], [.087, .42, .087], [0, 0, side * .13])
  b.add('cylinder', outfit.accent, [side * .046, -.353, .014], [.09, .047, .09], [0, 0, side * .13])
  b.add('sphere', avatarSkins[avatar.skin].color, [side * .05, -.43, .025], [.078, .095, .078])
  if (side > 0) {
    b.add('cylinder', '#9c7648', [.09, -.13, .1], [.029, 1.5, .029], [.08, 0, -.08])
    const crook = new THREE.TorusGeometry(.105, .031, 7, 14, Math.PI * 1.2)
    crook.rotateX(.05); crook.rotateZ(-.1); crook.translate(.02, .58, .17); b.geometry(crook, '#9c7648')
  }
  return b.buildColored()!
}

function makeLeg(avatar: AvatarAppearance) {
  const b = new Batch(), outfit = avatarOutfits[avatar.outfit]
  b.add('cylinder', outfit.pants, [0, -.24, 0], [.094, .43, .096])
  b.add('sphere', outfit.boots, [0, -.61, .045], [.115, .115, .17])
  b.add('cylinder', outfit.boots, [0, -.48, 0], [.098, .23, .103])
  b.add('box', outfit.accent, [0, -.404, .087], [.07, .025, .025])
  return b.buildColored()!
}

export const Shepherd = memo(function Shepherd({ player, username, remote = false, serverTimeOffset = 0, avatar, showRing = true }: { player: WorldPlayer; username?: string; remote?: boolean; serverTimeOffset?: number; avatar?: AvatarAppearance; showRing?: boolean }) {
  const group = useRef<THREE.Group>(null), torso = useRef<THREE.Group>(null)
  const groundRing = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Group>(null), rightArm = useRef<THREE.Group>(null), leftLeg = useRef<THREE.Group>(null), rightLeg = useRef<THREE.Group>(null)
  const appearance = avatar || player.avatar || defaultAvatar
  const parts = useMemo(() => makeShepherd(appearance), [appearance.skin, appearance.hair, appearance.outfit, appearance.hat])
  const arms = useMemo(() => [-1, 1].map(side => makeArm(side, appearance)), [appearance.skin, appearance.outfit])
  const legGeometry = useMemo(() => makeLeg(appearance), [appearance.outfit])
  useEffect(() => () => parts.dispose(), [parts])
  useEffect(() => () => legGeometry.dispose(), [legGeometry])
  useEffect(() => () => arms.forEach(geometry => geometry.dispose()), [arms])
  const previous = useRef({ x: player.position.x, z: player.position.z, angle: player.facing, walking: 0 })
  useFrame((state, dt) => {
    if (!group.current || !torso.current) return
    const p = previous.current, target = player.position
    const moving = player.moving || Math.hypot(target.x - p.x, target.z - p.z) > .012
    const blend = remote ? Math.min(1, dt * 10) : 1
    p.x += (target.x - p.x) * blend; p.z += (target.z - p.z) * blend
    p.angle += Math.atan2(Math.sin(player.facing - p.angle), Math.cos(player.facing - p.angle)) * Math.min(1, dt * 12)
    p.walking = THREE.MathUtils.damp(p.walking, moving ? 1 : 0, 10, dt)
    const gait = Math.sin(state.clock.elapsedTime * 11) * p.walking
    const bridgeHeight = groundHeight(p)
    const jumpPhase = player.jumpAt ? (Date.now() + (remote ? serverTimeOffset : 0) - player.jumpAt) / 650 : 2
    const jumping = jumpPhase >= 0 && jumpPhase < 1
    const jump = jumping ? 4 * jumpPhase * (1 - jumpPhase) * .9 : 0
    group.current.position.set(p.x, bridgeHeight + jump, p.z)
    if (groundRing.current) groundRing.current.position.y = .021 - jump
    group.current.rotation.y = p.angle
    torso.current.position.y = Math.abs(gait) * .055
    torso.current.rotation.z = gait * .025
    if (leftArm.current) leftArm.current.rotation.x = gait * .5
    if (rightArm.current) rightArm.current.rotation.x = -gait * .32 - .13
    if (leftLeg.current) leftLeg.current.rotation.x = jumping ? -.35 : -gait * .56
    if (rightLeg.current) rightLeg.current.rotation.x = jumping ? .24 : gait * .56
  })
  const coat = avatarOutfits[appearance.outfit].color
  return <group ref={group} position={[player.position.x, 0, player.position.z]}>
    {!remote && showRing && <mesh ref={groundRing} position={[0, .021, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.38, .45, 32]} /><meshBasicMaterial color="#fff0bb" transparent opacity={.6} /></mesh>}
    <group ref={torso}>
      <mesh geometry={parts} castShadow><meshStandardMaterial vertexColors roughness={.85} /></mesh>
      {[-1, 1].map((side, i) => <group key={side} position={[side * .27, 1.15, 0]} ref={side < 0 ? leftArm : rightArm}><mesh geometry={arms[i]} castShadow><meshStandardMaterial vertexColors roughness={.85} /></mesh></group>)}
    </group>
    {[-1, 1].map(side => <group key={side} ref={side === -1 ? leftLeg : rightLeg} position={[side * .12, .73, 0]}>
      <mesh geometry={legGeometry} castShadow><meshStandardMaterial vertexColors roughness={.9} /></mesh>
    </group>)}
    {remote && username && <Html position={[0, 2.3, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><div className="world-player-label"><span style={{ background: coat }} />{username}</div></Html>}
  </group>
})
