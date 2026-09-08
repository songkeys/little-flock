import { memo, Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Batch, blocksScenicView, random, ribbon, riverX, shapes, type V3 } from './geometry'
import { Meadow, useMeadowMaterial } from './Meadow'
import { Cottage } from './Cottage'
import { seasonArt } from './seasons'
import type { Season } from '../game/types'
import regions from '../game/regions.json'

const wood = '#9a7040', woodLight = '#bd9658', woodDark = '#76563b'
const foliage = ['#468356', '#58954f', '#73a450', '#83af58', '#3d7951']
const rockColors = ['#a9ac91', '#959d8b', '#bac0a8']
const potColors = ['#b97450', '#ce8660', '#a86047']

export function tree(b: Batch, x: number, z: number, size: number, seed: number, apple = false) {
  if (blocksScenicView(x, z)) return
  // Short crowns frame the woodland clearings without covering their ground-level activity.
  if (regions.forest.forageNodes.some(node => Math.hypot(x - node.position.x, z - node.position.z) < 12)) size = Math.min(size, 1.3)
  const rand = random(seed)
  const lean = (rand() - .5) * .14
  b.add('cylinder', '#826445', [x, size * 1.19, z], [size * .18, size * 2.38, size * .2], [.03, 0, lean])
  b.add('sphere', '#826445', [x, size * .12, z], [size * .31, size * .18, size * .28])
  for (let branch = 0; branch < 3; branch++) {
    const angle = branch * 2.09 + seed
    b.beam('#826445', [x, size * 1.03, z], [x + Math.cos(angle) * size * .89, size * (2.15 + branch * .16), z + Math.sin(angle) * size * .87], size * .13)
  }
  b.add('leaf', foliage[seed % 5], [x, size * 2.67, z], [size * 1.17, size * .9, size * 1.1])
  const blossom = seed === 91 || seed === 23
  for (let i = 0; i < 15; i++) {
    const angle = i * 2.399 + rand() * .3, ring = .7 + (i % 3) * .19, puff = .49 + rand() * .32
    const color = blossom && i % 3 === 0 ? ['#dda9b2', '#efd0c0'][i % 2] : foliage[Math.floor(rand() * foliage.length)]
    b.add('leaf', color, [x + Math.cos(angle) * size * ring, size * (2.57 + Math.sin(i * 2.1) * .53 + rand() * .3), z + Math.sin(angle) * size * ring], [size * puff * 1.05, size * puff * (.8 + rand() * .3), size * puff], [.1, angle, (rand() - .5) * .25])
  }
  if (apple) for (let i = 0; i < 15; i++) {
    const angle = i * 2.4, rad = size * (1.15 + rand() * .35)
    b.add('sphere', i % 3 === 0 ? '#efb548' : '#dd754e', [x + Math.cos(angle) * rad, size * (2.75 + rand() * .9), z + Math.sin(angle) * rad], [.13 * size, .14 * size, .13 * size])
  }
}

function fence(b: Batch, from: [number, number], to: [number, number], spacing = 1.65) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]), count = Math.max(1, Math.round(length / spacing))
  for (let i = 0; i <= count; i++) {
    const t = i / count, x = from[0] + (to[0] - from[0]) * t, z = from[1] + (to[1] - from[1]) * t
    b.add('box', i % 3 ? woodLight : wood, [x, .65, z], [.19, 1.3, .21], [0, .04, .015 * Math.sin(i)])
    b.add('sphere', woodLight, [x, 1.3, z], [.14, .095, .15])
  }
  for (const y of [.43, .97]) b.beam(wood, [from[0], y, from[1]], [to[0], y, to[1]], .13, .13)
}

export function flower(b: Batch, x: number, y: number, z: number, color: string, scale = 1) {
  b.add('cylinder', '#547d3f', [x, y + .16 * scale, z], [.018 * scale, .32 * scale, .018 * scale])
  b.add('leaf', '#6e963f', [x + .065 * scale, y + .17 * scale, z], [.11 * scale, .035 * scale, .04 * scale], [0, 0, .5])
  b.add('leaf', '#e7ad43', [x, y + .36 * scale, z], [.058 * scale, .038 * scale, .058 * scale])
  for (let p = 0; p < 5; p++) {
    const a = p / 5 * Math.PI * 2
    b.add('leaf', color, [x + Math.cos(a) * .075 * scale, y + .345 * scale, z + Math.sin(a) * .075 * scale], [.07 * scale, .03 * scale, .045 * scale], [0, -a, .1])
  }
}

function pot(b: Batch, x: number, y: number, z: number, size: number, seed: number) {
  const rand = random(seed)
  b.add('cylinder', potColors[seed % 3], [x, y + size * .37, z], [size * .44, size * .74, size * .44])
  b.add('torus', potColors[seed % 3], [x, y + size * .72, z], [size * .44, size * .44, size * .44], [Math.PI / 2, 0, 0])
  b.add('cylinder', '#5f5137', [x, y + size * .72, z], [size * .38, .025, size * .38])
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4, rad = rand() * size * .3
    flower(b, x + Math.cos(a) * rad, y + size * .7, z + Math.sin(a) * rad, ['#fff2ce', '#e9a283', '#edc75d'][seed % 3], size * (1 + rand() * .6))
  }
}

function barrel(b: Batch, x: number, y: number, z: number, size = 1) {
  b.add('cylinder', wood, [x, y + .45 * size, z], [.34 * size, .9 * size, .34 * size])
  b.add('cylinder', woodLight, [x, y + .91 * size, z], [.33 * size, .03, .33 * size])
  for (const by of [.15, .72]) b.add('torus', '#67694e', [x, y + by * size, z], [.345 * size, .345 * size, .25 * size], [Math.PI / 2, 0, 0])
}

function house(b: Batch) {
  const x = -10, z = -9
  b.add('box', '#bbb397', [x, .15, z], [6.15, .3, 4.9])
  b.add('box', '#ece0b9', [x, 1.95, z], [5.6, 3.6, 4.3])
  b.add('box', '#ded4ad', [x, .53, z], [5.69, .65, 4.38])
  // Gable ends and thick terracotta roof panels.
  const gable = new THREE.BufferGeometry()
  gable.setAttribute('position', new THREE.Float32BufferAttribute([-2.8, 0, 0, 2.8, 0, 0, 0, 1.9, 0, -2.8, 0, -.12, 0, 1.9, -.12, 2.8, 0, -.12], 3))
  gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1, 0, 0, .5, 1, 1, 0], 2))
  gable.setIndex([0, 1, 2, 3, 4, 5])
  gable.computeVertexNormals()
  for (const front of [-1, 1]) { const g = gable.clone(); g.translate(x, 3.75, z + front * 2.16); b.geometry(g, '#ece0b9') }
  gable.dispose()
  for (const side of [-1, 1]) {
    b.add('box', '#9e5a42', [x + side * 1.54, 4.62, z], [3.7, .25, 5.2], [0, 0, side * -.59])
    for (let row = 0; row < 6; row++) for (let col = 0; col < 9; col++) {
      const rx = side * (row * .5 + .19), ry = 5.9 - Math.abs(rx) * .67
      b.add('box', ['#c67550', '#b96648', '#d28456'][(row + col) % 3], [x + rx, ry, z - 2.28 + col * .57 + (row % 2) * .05], [.62, .1, .58], [0, 0, side * -.59])
    }
    b.beam('#8c6042', [x + side * 3.08, 3.65, z + 2.65], [x, 5.72, z + 2.65], .19, .19)
  }
  for (let i = 0; i < 11; i++) b.add('cylinder', '#d98b5b', [x, 5.76, z - 2.5 + i * .48], [.17, .5, .17], [Math.PI / 2, 0, 0])
  // Chimney: asymmetric brickwork, cream cap.
  b.add('box', '#d2c7a3', [x - 1.6, 5.8, z - .9], [.85, 2.4, .9])
  for (let row = 0; row < 5; row++) for (let side = 0; side < 2; side++) b.add('box', row % 2 ? '#b7ad8a' : '#c6bb97', [x - 1.6 + (side - .5) * .41, 5 + row * .37, z - .435], [.37, .21, .04])
  b.add('box', '#b86648', [x - 1.6, 7.08, z - .9], [1.09, .23, 1.13])
  b.add('box', '#625444', [x - 1.6, 7.21, z - .9], [.61, .035, .61])
  // Framed teal front door and brass hardware.
  b.add('box', '#a98754', [x + .42, 1.42, z + 2.22], [1.67, 2.7, .19])
  b.add('box', '#467f78', [x + .42, 1.31, z + 2.35], [1.37, 2.47, .1])
  for (let i = 0; i < 6; i++) b.add('box', '#5b9186', [x - .12 + i * .215, 1.32, z + 2.42], [.018, 2.38, .025])
  b.add('sphere', '#e6bd68', [x + .9, 1.28, z + 2.48], [.075, .075, .07])
  b.add('torus', '#d5a658', [x + .9, 1.17, z + 2.48], [.1, .13, .1])
  b.add('box', '#b8b092', [x + .4, .11, z + 2.8], [2.0, .22, .85])
  b.add('box', '#c9c0a0', [x + .4, .06, z + 3.2], [2.3, .12, .55])
  for (const wx of [-1.8, 2]) {
    b.add('box', '#957547', [x + wx, 2.04, z + 2.2], [1.11, 1.3, .17])
    b.add('box', '#6b9090', [x + wx, 2.09, z + 2.31], [.89, 1.08, .04])
    b.add('box', '#d9c897', [x + wx, 2.08, z + 2.35], [.07, 1.13, .06])
    b.add('box', '#d9c897', [x + wx, 2.09, z + 2.35], [.93, .07, .06])
    b.add('box', woodLight, [x + wx, 1.31, z + 2.45], [1.27, .24, .5])
    for (let f = 0; f < 6; f++) flower(b, x + wx - .48 + f * .18, 1.43, z + 2.43, f % 2 ? '#e6a391' : '#fff0cb', .75)
  }
  b.add('box', '#957547', [x, 4.24, z + 2.21], [.8, .93, .12])
  b.add('box', '#719b99', [x, 4.24, z + 2.29], [.64, .77, .05])
  b.add('box', '#e2d3a5', [x, 4.24, z + 2.34], [.055, .77, .025])
  b.add('box', '#e2d3a5', [x, 4.24, z + 2.34], [.64, .055, .025])
  // Attached timber shelter and hay bales.
  for (const pz of [-1.8, 1.8]) b.add('box', wood, [x - 4.28, 1.32, z + pz], [.2, 2.65, .2])
  b.add('box', '#ac7449', [x - 3.68, 2.86, z], [2.38, .16, 4.6], [0, 0, .22])
  for (let i = 0; i < 8; i++) b.add('box', '#c08a52', [x - 3.68, 2.96, z - 2 + i * .57], [2.42, .075, .045], [0, 0, .22])
  for (let i = 0; i < 3; i++) {
    b.add('box', '#c5af58', [x - 3.5 - i * .33, .35 + (i === 2 ? .7 : 0), z + .7 - i * .43], [.97, .68, .83])
    b.add('box', '#9d8b46', [x - 3.5 - i * .33, .35 + (i === 2 ? .7 : 0), z + .7 - i * .43], [.08, .7, .84])
  }
  barrel(b, -13.6, 0, -6.7, 1.05); barrel(b, -14.1, 0, -7.6, .86)
  pot(b, -11.4, 0, -6.35, .85, 12); pot(b, -8.2, 0, -6.2, .9, 13)
  // Climbing vine follows the front wall.
  for (let i = 0; i < 18; i++) {
    const vy = .45 + i * .18, vx = -12.5 + Math.sin(i * .7) * .24
    b.add('leaf', foliage[i % 3], [vx, vy, -6.68], [.17, .12, .08], [0, 0, i])
    if (i % 3 === 0) flower(b, vx, vy - .2, -6.53, '#dfa295', .6)
  }
}

function bridge(b: Batch) {
  const center = riverX(5)
  for (let i = 0; i < 16; i++) {
    const x = center - 2.85 + i * .38, y = .14 + Math.sin(i / 15 * Math.PI) * .35
    b.add('box', i % 3 ? '#b38b54' : '#cba16b', [x, y, 5], [.36, .17, 2.65])
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = center - 2.7 + i * 1.35, h = .18 + Math.sin(i / 4 * Math.PI) * .3
      b.add('box', wood, [x, h + .6, 5 + side * 1.35], [.19, 1.25, .19])
      b.add('sphere', woodLight, [x, h + 1.25, 5 + side * 1.35], [.145, .09, .145])
      if (i < 4) {
        const nextH = .18 + Math.sin((i + 1) / 4 * Math.PI) * .3
        b.beam(woodLight, [x, h + 1.06, 5 + side * 1.35], [x + 1.35, nextH + 1.06, 5 + side * 1.35], .14, .14)
      }
    }
  }
}

function wagon(b: Batch) {
  const x = 7, z = 10
  b.add('box', woodDark, [x, .78, z], [3.6, .3, 1.95])
  b.add('box', '#b08a50', [x, 1.15, z + .85], [3.5, .65, .17])
  b.add('box', '#b08a50', [x, 1.15, z - .85], [3.5, .65, .17])
  for (const side of [-1, 1]) {
    b.add('box', woodLight, [x + side * 1.72, 1.15, z], [.16, .65, 1.85])
    for (const zz of [-.65, .65]) {
      b.add('cylinder', woodDark, [x + side * 1.19, .54, z + zz * 1.62], [.5, .12, .5], [Math.PI / 2, 0, 0])
      b.add('torus', '#525a45', [x + side * 1.19, .54, z + zz * 1.72], [.43, .43, .43])
      b.add('sphere', woodLight, [x + side * 1.19, .54, z + zz * 1.84], [.12, .12, .075])
      for (let a = 0; a < 3; a++) b.add('box', woodLight, [x + side * 1.19, .54, z + zz * 1.8], [.73, .045, .055], [0, 0, a * Math.PI / 3])
    }
    for (const sz of [-.8, .8]) b.add('box', wood, [x + side * 1.65, 2.03, z + sz], [.11, 2.5, .11])
  }
  for (let stripe = 0; stripe < 9; stripe++) {
    const px = x - 1.92 + stripe * .48, c = stripe % 2 ? '#faf0c8' : '#da8d6c'
    b.add('box', c, [px, 3.2, z], [.49, .11, 2.53], [.13, 0, 0])
    b.add('sphere', c, [px, 2.98, z + 1.28], [.24, .3, .06])
  }
  for (let bin = 0; bin < 3; bin++) {
    b.add('box', '#78603f', [x - 1.07 + bin * 1.05, 1.31, z], [.97, .18, 1.5])
    for (let i = 0; i < 12; i++) {
      const px = x - 1.38 + bin * 1.04 + (i % 3) * .28, pz = z - .5 + Math.floor(i / 3) * .3
      b.add('sphere', ['#dda245', '#86a557', '#b286a0'][bin], [px, 1.59, pz], [.17, .17, .17])
      b.add('leaf', '#5c8849', [px, 1.76, pz], [.075, .04, .09])
    }
  }
  b.beam(wood, [x - 1.6, .8, z], [x - 3.15, .4, z + .3], .15)
  barrel(b, x + 2.5, 0, z + .55, .85)
  pot(b, x - 2.5, 0, z - 1.4, .8, 11)
}

function windmill(b: Batch) {
  const x = 20, z = -18
  const geo = new THREE.CylinderGeometry(1.35, 2.05, 6.5, 12)
  geo.translate(x, 3.25, z); b.geometry(geo, '#ded2aa')
  b.add('cone', '#b7684b', [x, 7.55, z], [2.25, 2.35, 2.25])
  b.add('sphere', '#d89b5a', [x, 8.82, z], [.19, .2, .19])
  b.add('box', '#507f76', [x, 1.04, z + 1.89], [1.05, 2.1, .12])
  for (const y of [2.95, 4.6]) b.add('box', '#6d8e86', [x + .82, y, z + 1.37], [.56, .71, .17])
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, y = .6 + (i % 5) * 1.05, radius = 2 - y * .1
    b.add('box', '#c1b798', [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius], [.43, .19, .12], [0, -a + Math.PI / 2, 0])
  }
}

function lantern(b: Batch, x: number, z: number) {
  b.add('box', woodDark, [x, 1.25, z], [.16, 2.5, .16])
  b.beam(woodDark, [x, 2.4, z], [x + .48, 2.4, z], .1)
  b.add('box', '#e4b46e', [x + .45, 2.03, z], [.31, .4, .31])
  b.add('cone', '#536a55', [x + .45, 2.3, z], [.3, .2, .3])
  b.add('box', '#536a55', [x + .45, 1.79, z], [.38, .08, .38])
}

function buildEnvironment(pastureLevel: number, wateringLevel: number, season: Season, shelterBuilt: boolean, gardenBuilt: boolean) {
  const b = new Batch(seasonArt[season].palette), rand = random(47291)
  bridge(b); windmill(b)
  if (gardenBuilt) wagon(b)
  if (shelterBuilt) {
  barrel(b, -13.6, 0, -6.7, 1.05); barrel(b, -14.1, 0, -7.6, .86)
  // Fences enclose a generous pasture with a clear opening to the central path.
  const pastureWest = -15 - pastureLevel * 2
  fence(b, [pastureWest, -3.5], [-1.2, -3.5]); fence(b, [pastureWest, -3.5], [pastureWest, 10.5])
  fence(b, [pastureWest, 10.5], [-1.2, 10.5]); fence(b, [-1.2, -3.5], [-1.2, 2.7]); fence(b, [-1.2, 6], [-1.2, 10.5])
  if (pastureLevel > 0) {
    const shelterX = pastureWest + 1.5
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add('box', wood, [shelterX + sx * .95, 1.05, 5.5 + sz * 1.2], [.15, 2.1, .15])
    for (const side of [-1, 1]) b.add('box', '#c38a65', [shelterX + side * .58, 2.22, 5.5], [1.5, .13, 2.85], [0, 0, side * -.38])
    b.add('box', '#c6b76a', [shelterX, .25, 5.5], [1.75, .5, 1.5])
    for (let i = 0; i < 6; i++) {
      const z = 2.9 + i * .49
      b.add('cone', ['#deb690', '#a4bea0', '#ceb7c8'][i % 3], [-1.15, 1.65 - Math.sin(i / 5 * Math.PI) * .13, z], [.1, .25, .025], [0, Math.PI / 2, Math.PI])
    }
    b.beam(woodLight, [-1.2, 1.85, 2.7], [-1.2, 1.85, 6], .04)
  }
  fence(b, [-17, -14.5], [7, -14.5], 2)
  // The trough, hay rack, and little shelter give the flock a home.
  b.add('box', '#826446', [-12.7, .3, -.8], [2, .6, .85])
  b.add('box', '#67a9a1', [-12.7, .62, -.8], [1.73, .025, .6])
  for (const sx of [-1, 1]) b.add('box', woodLight, [-12.7 + sx, .35, -.8], [.12, .7, .99])
  b.add('box', '#b29a51', [-12.6, .5, 7.65], [2, .7, 1.2])
  for (let i = 0; i < 5; i++) b.add('box', wood, [-13.5 + i * .45, .66, 8.27], [.075, 1, .09], [0, 0, .12])
  for (const px of [-14, -10.7]) b.add('box', wood, [px, 1.1, -2], [.15, 2.2, .15])
  b.add('box', '#b68655', [-12.35, 2.25, -2.5], [3.7, .14, 2.3], [.15, 0, 0])
  lantern(b, -2.1, 6.2)
  }
  if (gardenBuilt) {
  fence(b, [1.7, -5], [10, -5]); fence(b, [10, -5], [10, 2.2])
  // Garden stepping stones and a tools corner.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    if (col % 4 !== 0 && row !== 3) continue
    b.add('sphere', '#c0b693', [2.1 + col * 1.65, .06, -3.8 + row * 1.7], [.34, .08, .3], [0, rand() * 6, 0])
  }
  barrel(b, 9.55, 0, -4.05); pot(b, 1.8, 0, -4.45, .75, 15)
  if (wateringLevel > 0) {
    b.add('cylinder', '#537f76', [9.55, 1.25, -4.05], [.12, .65, .12])
    b.add('sphere', '#648d82', [9.55, 1.58, -4.05], [.18, .1, .14])
    b.beam('#658b7a', [9.55, 1.58, -4.05], [9.86, 1.87, -4.05], .075)
    b.add('box', wood, [9.93, 1.86, -4.05], [.27, .09, .11])
    b.beam('#a99060', [3, .13, -4.18], [9.55, .13, -4.18], .055)
    for (let i = 0; i < 2 + wateringLevel; i++) {
      const sx = 3.1 + i * 1.74
      b.add('cylinder', '#8c9d89', [sx, .39, -4.18], [.04, .55, .04])
      b.add('sphere', '#abc3b6', [sx, .7, -4.18], [.105, .055, .105])
      b.add('box', '#c5b581', [sx, .73, -4.18], [.32, .045, .07])
    }
    if (wateringLevel > 1) {
      b.beam('#a99060', [9.5, .13, -4.18], [9.5, .13, 1.8], .055)
      for (const z of [-1, 1.5]) {
        b.add('cylinder', '#8c9d89', [9.5, .39, z], [.04, .55, .04])
        b.add('sphere', '#abc3b6', [9.5, .7, z], [.105, .055, .105])
      }
    }
  }
  b.beam(wood, [9.1, .05, -4.6], [9.5, 1.6, -4.63], .06)
  b.add('box', '#68796d', [9.09, .15, -4.6], [.29, .31, .07])
  // Notice board and signpost beside the way to the bridge.
  for (const px of [2.05, 3.75]) b.add('box', wood, [px, 1, 5.8], [.13, 2, .13])
  b.add('box', '#99724b', [2.9, 1.62, 5.8], [2.1, 1.22, .14])
  b.add('box', '#c6a973', [2.9, 1.62, 5.9], [1.86, 1.01, .05])
  for (let i = 0; i < 3; i++) {
    b.add('box', i === 1 ? '#ead9b0' : '#fff0ca', [2.29 + i * .59, 1.63 + (i % 2) * .12, 5.94], [.44, .65, .03], [0, 0, (i - 1) * .12])
    b.add('sphere', '#b27453', [2.29 + i * .59, 1.88 + (i % 2) * .12, 5.97], [.035, .035, .028])
    for (let line = 0; line < 3; line++) b.add('box', '#b9a37c', [2.29 + i * .59, 1.72 - line * .12, 5.97], [.25 - line * .03, .025, .008])
  }
  b.add('box', woodDark, [5, 1, 9], [.13, 2, .13])
  b.add('box', woodLight, [5.24, 1.68, 9], [1.2, .36, .12], [0, 0, -.1])
  b.add('box', '#5f8b75', [4.88, 1.24, 9], [1.2, .33, .13], [0, 0, .08])
  lantern(b, 8.8, 12.1)
  }
  lantern(b, riverX(5) - 3.3, 7.05)
  // Main trees are art-directed; distant groves make the world feel inhabited.
  tree(b, -16.2, -7.8, 1.85, 71, true); tree(b, -16.8, 6.6, 1.25, 18)
  tree(b, -7.5, -16, 1.5, 6, true); tree(b, .5, -11, 1.35, 9)
  tree(b, 7.5, -11.2, 1.7, 15); tree(b, 21.5, -.6, 1.5, 23, true)
  tree(b, 23, 14, 1.45, 36); tree(b, -16.7, 15.2, 1.55, 46)
  tree(b, -12, 20, 1.3, 91); tree(b, 9, 21, 1.1, 84)
  for (let i = 0; i < 32; i++) {
    const angle = i * 2.4, radius = 28 + rand() * 28, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
    if (Math.abs(x - riverX(z)) < 4) continue
    const size = .9 + rand() * 1.65
    tree(b, x, z, size, i + 200)
  }
  // Rounded mountain silhouettes in layered, desaturated greens.
  for (let i = 0; i < 15; i++) {
    const a = i * Math.PI * 2 / 15
    b.add('sphere', ['#7ea584', '#90b590', '#a1bc96'][i % 3], [Math.cos(a) * (98 + i % 3 * 8), -3.5, Math.sin(a) * (98 + i % 3 * 8)], [15 + rand() * 10, 11 + rand() * 11, 16 + rand() * 9])
  }
  for (let i = 0; i < 130; i++) {
    const z = -47 + rand() * 94, side = i % 2 ? -1 : 1, x = riverX(z) + side * (1.9 + rand() * .7), size = .2 + rand() * .48
    b.add('sphere', rockColors[i % 3], [x, size * .28, z], [size, size * .68, size * .72], [rand() * .3, rand() * 6, .1])
    if (i % 2 === 0) b.add('sphere', '#739342', [x - side * .25, .17, z], [.32, .19, .35])
  }
  for (const [rx, rz] of [[-18, 2], [8, 11], [-12, 14], [17, -8], [3, -12]]) {
    for (let i = 0; i < 4; i++) {
      const size = .3 + rand() * .55
      b.add('sphere', rockColors[i % 3], [rx + rand(), size * .38, rz + rand()], [size, size * .8, size * .85], [.1, rand() * 5, .1])
    }
  }
  // Warm irregular flagstones along the central footpaths.
  const stonePath = [[0, 23], [1, 14], [.2, 7], [-.2, 1], [-3, -3.5], [-9.4, -5.9]]
  for (let segment = 0; segment < stonePath.length - 1; segment++) {
    const a = stonePath[segment], e = stonePath[segment + 1], length = Math.hypot(e[0] - a[0], e[1] - a[1])
    const tangentX = (e[0] - a[0]) / length, tangentZ = (e[1] - a[1]) / length
    for (let i = 0; i < length * 1.3; i++) {
      const t = (i + .5) / (length * 1.3), side = i % 2 ? -.3 : .3
      b.add('sphere', ['#d2c296', '#baae87', '#daccaa'][i % 3], [a[0] + (e[0] - a[0]) * t - tangentZ * side, .056, a[1] + (e[1] - a[1]) * t + tangentX * side], [.32 + rand() * .12, .065, .27 + rand() * .1], [0, rand() * 3, 0])
    }
  }
  // Short scattered wildflowers, plus abundant beds that frame the playable farm.
  for (let i = 0; i < 160; i++) {
    const x = -23 + rand() * 48, z = -19 + rand() * 44
    if (Math.abs(x - riverX(z)) < 2.2 || (x > -14 && x < -5 && z > -12 && z < -5) || (x > 1.4 && x < 10.4 && z > -5.2 && z < 2.3) || (Math.abs(x) < 1.6 && z > -5) || (z > 3.6 && z < 6.5 && x > -2)) continue
    flower(b, x, .02, z, ['#fff5d7', '#eaba78', '#dfa0a9', '#a89dc2'][i % 7 % 4], .65 + rand() * .45)
  }
  const flowerBeds = [[-14, 11.4], [-11.5, 11.25], [-8.5, 11.3], [-5.5, 11.5], [-2.8, 11.3], [-14.9, 1.5], [-14.9, 4.6], [-14.5, -4.5], [-6.6, -5.4], [1.8, -5.6], [5.1, -5.6], [8, -5.6], [9.4, 8.6], [10.6, 1.8], [16.5, 8.6], [21.7, 5.8], [-4.6, 15.2], [3.8, 14.7]]
  for (let patch = 0; patch < flowerBeds.length; patch++) {
    const [px, pz] = flowerBeds[patch], color = ['#fff0cc', '#e6afbf', '#eeb77b', '#bab0d8'][patch % 4]
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4, radius = Math.sqrt(rand()) * .87, x = px + Math.cos(a) * radius, z = pz + Math.sin(a) * radius * .5
      b.add('leaf', foliage[(patch + i) % 3], [x, .11, z], [.18, .14, .16], [0, a, 0])
      flower(b, x, .04, z, i % 5 === 0 ? '#f8e3a0' : color, 1 + rand() * .52)
    }
  }
  // Lavender beds frame the scene without hiding the interaction area.
  for (let patch = 0; patch < 18; patch++) {
    const px = patch < 9 ? -18 + patch * 3.4 : riverX(-7 + (patch - 9) * 3.2) - 3.1, pz = patch < 9 ? 13.3 + Math.sin(patch) * 2 : -7 + (patch - 9) * 3.2
    for (let stalk = 0; stalk < 6; stalk++) {
      const sx = px + (rand() - .5) * .7, sz = pz + (rand() - .5) * .7, h = .4 + rand() * .4
      b.add('cylinder', '#668747', [sx, h / 2, sz], [.025, h, .025], [0, 0, .08])
      for (let p = 0; p < 3; p++) b.add('sphere', p % 2 ? '#bca7ce' : '#9a88b5', [sx, h - p * .12, sz], [.09 - p * .014, .13, .085 - p * .012])
    }
  }
  return b.buildColored()!
}

function Ground({ season }: { season: Season }) {
  const groundMaterial = useMeadowMaterial(season)
  const meshes = useMemo(() => {
    const stream = Array.from({ length: 42 }, (_, i) => { const z = -75 + i * 3.7; return new THREE.Vector3(riverX(z), 0, z) })
    const paths = [
      [[0, 24], [1, 14], [.2, 7], [-.2, 1], [-3, -3.5], [-9.4, -5.9]],
      [[-.2, 4.5], [6, 4.5], [riverX(5), 5], [20, 5], [27, 8]],
      [[18, 5], [19, -.5], [17.5, -7], [20, -15.5]],
      [[-3, -3.5], [-1, -7], [3, -14], [4, -28]],
    ].map(points => ribbon(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), 1.75, .035))
    return { bank: ribbon(stream, 4.4, .008), stream: ribbon(stream, 3.55, .028), paths }
  }, [])
  useEffect(() => () => { meshes.bank.dispose(); meshes.stream.dispose(); meshes.paths.forEach(geometry => geometry.dispose()) }, [meshes])
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={groundMaterial}><planeGeometry args={[180, 180]} /></mesh>
    <mesh geometry={meshes.bank} receiveShadow><meshStandardMaterial color="#c2ba86" roughness={1} /></mesh>
    {meshes.paths.map((geometry, i) => <mesh key={i} geometry={geometry} receiveShadow><meshStandardMaterial color="#b8a984" roughness={1} /></mesh>)}
    <Water geometry={meshes.stream} />
  </>
}

function Water({ geometry }: { geometry: THREE.BufferGeometry }) {
  const shader = useMemo(() => ({
    uniforms: { uTime: { value: 0 }, colorA: { value: new THREE.Color('#58aeb3') }, colorB: { value: new THREE.Color('#a5d8c5') } },
    vertexShader: 'varying vec2 vUv; varying vec3 vPosition; void main(){vUv=uv;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime; uniform vec3 colorA; uniform vec3 colorB; varying vec2 vUv; varying vec3 vPosition;
      void main(){ float edge=smoothstep(.33,.5,abs(vUv.x-.5)); float wave=sin(vPosition.z*5.-uTime*1.1+sin(vPosition.x*9.))*sin(vPosition.x*8.+vPosition.z*2.-uTime*.7); float glint=smoothstep(.91,.99,wave); vec3 color=mix(colorA,colorB,edge*.75+glint*.55); gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }), [])
  useFrame((_, dt) => { shader.uniforms.uTime.value += dt })
  return <mesh geometry={geometry}><shaderMaterial {...shader} /></mesh>
}

function WindmillSails() {
  const rotor = useRef<THREE.Group>(null)
  const sail = useMemo(() => {
    const b = new Batch()
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2
      const transform = (x: number, y: number): V3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), 0]
      b.beam(wood, transform(0, 0), transform(0, 4.35), .14, .15)
      b.add('box', '#e7ddba', transform(.39, 2.94), [.75, 2.36, .07], [0, 0, a])
      for (let line = 0; line < 6; line++) b.beam(woodLight, transform(-.05, 1.78 + line * .47), transform(.81, 1.78 + line * .47), .055, .09)
      b.beam(woodLight, transform(.83, 1.75), transform(.83, 4.2), .065, .08)
    }
    b.add('sphere', woodDark, [0, 0, .11], [.33, .33, .23])
    return b.buildColored()!
  }, [])
  useEffect(() => () => sail.dispose(), [sail])
  useFrame((_, dt) => { if (rotor.current) rotor.current.rotation.z -= dt * .1 })
  return <group position={[20, 5.55, -16.32]} ref={rotor} rotation={[0, 0, .45]}><mesh geometry={sail} castShadow><meshStandardMaterial vertexColors roughness={.9} /></mesh></group>
}

function Clouds() {
  const group = useRef<THREE.Group>(null)
  const data = useMemo(() => {
    const b = new Batch(), rand = random(713)
    for (let i = 0; i < 17; i++) {
      const a = i * 2.4, x = Math.cos(a) * 53, z = Math.sin(a) * 53, y = 21 + rand() * 6
      for (let puff = 0; puff < 5; puff++) b.add('sphere', '#f8f1d9', [x + (puff - 2) * 2.2, y + Math.sin(puff) * .7, z], [2.5 + rand(), 1.1 + rand() * .6, 1.6])
    }
    return b.buildColored()!
  }, [])
  useEffect(() => () => data.dispose(), [data])
  useFrame((state) => { if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * .007) * .09 })
  return <group ref={group}><mesh geometry={data}><meshStandardMaterial vertexColors roughness={1} /></mesh></group>
}

export const Environment = memo(function Environment({ pastureLevel = 0, wateringLevel = 0, season = '春日', shelterBuilt = true, gardenBuilt = true }: { pastureLevel?: number; wateringLevel?: number; season?: Season; shelterBuilt?: boolean; gardenBuilt?: boolean }) {
  const parts = useMemo(() => buildEnvironment(pastureLevel, wateringLevel, season, shelterBuilt, gardenBuilt), [pastureLevel, wateringLevel, season, shelterBuilt, gardenBuilt])
  useEffect(() => () => parts.dispose(), [parts])
  return <>
    <Ground season={season} />
    <mesh geometry={parts} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.88} /></mesh>
    {shelterBuilt && <Suspense fallback={<HandmadeCottage />}><Cottage /></Suspense>}
    <WindmillSails /><Clouds /><Meadow season={season} />
  </>
})

function HandmadeCottage() {
  const geometry = useMemo(() => { const b = new Batch(); house(b); return b.buildColored()! }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.88} /></mesh>
}

export function NightLights({ night, shelterBuilt = true, gardenBuilt = true }: { night: number; shelterBuilt?: boolean; gardenBuilt?: boolean }) {
  const positions: V3[] = [[riverX(5) - 2.85, 2.03, 7.05]]
  if (shelterBuilt) positions.push([-9.58, 1.9, -6.48], [-1.65, 2.03, 6.2])
  if (gardenBuilt) positions.push([9.25, 2.03, 12.1])
  return <group visible={night > .2}>
    {positions.map((p, i) => <mesh key={i} position={p} geometry={shapes.sphere} scale={[.12, .17, .12]}><meshStandardMaterial color="#ffd492" emissive="#ffc875" emissiveIntensity={1.6 * night} /></mesh>)}
    {shelterBuilt && <pointLight position={[-9.5, 2.1, -5.8]} color="#ffc980" intensity={10 * night} distance={8} decay={2} />}
    <pointLight position={[riverX(5) - 3, 2.2, 7]} color="#ffd68c" intensity={8 * night} distance={7} decay={2} />
  </group>
}
