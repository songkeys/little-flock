import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import regions from '../game/regions.json'

export type V3 = [number, number, number]
type Shape = 'sphere' | 'box' | 'cylinder' | 'cone' | 'torus' | 'leaf'
export const shapes = {
  sphere: new THREE.SphereGeometry(1, 10, 7),
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, .15, 6, 16),
  leaf: new THREE.SphereGeometry(1, 7, 5),
}

export function random(seed: number) {
  let value = seed
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}
export function hash(input: string) {
  let n = 0
  for (let i = 0; i < input.length; i++) n = ((n << 5) - n + input.charCodeAt(i)) | 0
  return Math.abs(n)
}

export class Batch {
  buckets = new Map<string, THREE.BufferGeometry[]>()
  constructor(private palette: Record<string, string> = {}) {}
  add(shape: Shape, color: string, position: V3, scale: V3 = [1, 1, 1], rotation: V3 = [0, 0, 0]) {
    const geometry = shapes[shape].clone()
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale))
    geometry.applyMatrix4(matrix)
    this.geometry(geometry, color)
  }
  geometry(geometry: THREE.BufferGeometry, color: string) {
    color = this.palette[color] || color
    if (!this.buckets.has(color)) this.buckets.set(color, [])
    this.buckets.get(color)!.push(geometry)
  }
  beam(color: string, from: V3, to: V3, width: number, depth = width) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
    const direction = b.clone().sub(a)
    const geometry = shapes.box.clone()
    geometry.applyMatrix4(new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()), new THREE.Vector3(width, direction.length(), depth)))
    this.geometry(geometry, color)
  }
  build() {
    return [...this.buckets.entries()].map(([color, geometries]) => {
      const geometry = mergeGeometries(geometries)
      geometries.forEach(g => g.dispose())
      geometry.computeBoundingSphere()
      return { color, geometry }
    })
  }
  buildColored() { return mergeColored(this.build()) }
}

/** Bake a palette into vertex colors so a whole prop or landscape needs one draw. */
export function mergeColored(parts: { color: string; geometry: THREE.BufferGeometry }[]) {
  if (!parts.length) return null
  const geometries = parts.map(({ color, geometry }) => {
    const c = new THREE.Color(color), count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geometry
  })
  const merged = mergeGeometries(geometries)
  geometries.forEach(geometry => geometry.dispose())
  merged.computeBoundingSphere()
  return merged
}

export function ribbon(points: THREE.Vector3[], width: number, height = .02) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = []
  const curve = new THREE.CatmullRomCurve3(points)
  const segments = Math.ceil(curve.getLength() * 2)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), tangent = curve.getTangent(t)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const variation = 1 + Math.sin(i * .7) * .045
    for (let side = 0; side < 2; side++) {
      const offset = normal.clone().multiplyScalar((side - .5) * width * variation)
      positions.push(p.x + offset.x, p.y + height, p.z + offset.z)
      uvs.push(side, t * curve.getLength() / 3)
    }
    if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const regionPaths: Record<'meadow' | 'forest' | 'highland', number[][][]> = {
  meadow: [[[0, 17], [-2, 21], [-7, 25], [-10, 27]], [[-10, 27], [-14, 29], [-20, 28]]],
  forest: [[[16.8, 5], [23, 5], [29, 2], [33, -4], [35, -10], [31, -15]], [[29, 2], [35, 7], [40, 9]], [[24, 5], [26, 9], [28, 12]]],
  highland: [[[31, -15], [33, -20], [39, -23], [43, -30]], [[43, -30], [48, -33], [55, -34]]],
}

export const riverX = (z: number) => 12 + Math.sin(z * .065) * 2.6 + Math.sin(z * .22) * .45

/** Keep the main destinations clear of tall foreground canopies. */
export function blocksScenicView(x: number, z: number) {
  const mainDestination = [regions.meadow.waterPoint, regions.meadow.grazePoint, regions.highland.viewPoint].some(point => {
    const dx = x - point.x, dz = z - point.z, distance = Math.hypot(dx, dz)
    return distance < 6.5 || (dx > -2 && dz > -2 && distance < 11)
  })
  return mainDestination || regions.forest.forageNodes.some(node => {
    const dx = x - node.position.x, dz = z - node.position.z, distance = Math.hypot(dx, dz)
    return distance < 4.5 || (dx > -2.5 && dz > -2.5 && distance < 8.5)
  })
}

export function groundHeight(position: { x: number; z: number }) {
  const bridgeDistance = Math.abs(position.x - riverX(5))
  if (Math.abs(position.z - 5) < 1.45 && bridgeDistance < 3.1) return .16 + Math.cos(bridgeDistance / 3.1 * Math.PI / 2) * .32
  if (position.x > 26.95 && position.x < 30.05 && position.z > 2 && position.z < 4.45) return .23
  return 0
}

export function getLockedRegion(position: { x: number; z: number }, progressionStep: number) {
  return (['meadow', 'forest', 'highland'] as const).find(id => {
    const region = regions[id], bounds = region.bounds
    return progressionStep < region.unlockStep && position.x >= bounds.minX && position.x <= bounds.maxX && position.z >= bounds.minZ && position.z <= bounds.maxZ
  })
}

export function walkablePosition(position: { x: number; z: number }, previous?: { x: number; z: number }, progressionStep = 15) {
  let x = THREE.MathUtils.clamp(position.x, regions.bounds.minX, regions.bounds.maxX), z = THREE.MathUtils.clamp(position.z, regions.bounds.minZ, regions.bounds.maxZ)
  const locked = getLockedRegion({ x, z }, progressionStep)
  if (locked) {
    if (previous) return { x: previous.x, z: previous.z }
    return { ...regions[locked].gate }
  }
  const water = Math.abs(x - riverX(z)) < 1.7 && Math.abs(z - 5) > 1.4
  const house = progressionStep > 0 && x > -12.8 && x < -7.2 && z > -12 && z < -6.4
  const windmill = Math.hypot(x - 20, z + 18) < 2.1
  if ((water || house || windmill) && previous) return { x: previous.x, z: previous.z }
  if (water) x = riverX(z) + (x < riverX(z) ? -1.8 : 1.8)
  if (house) z = -6.3
  return { x, z }
}

type WalkPoint = { x: number; z: number }
const distance = (a: WalkPoint, b: WalkPoint) => Math.hypot(b.x - a.x, b.z - a.z)

function crossesHouse(from: WalkPoint, to: WalkPoint) {
  let enter = 0, leave = 1
  for (const [key, min, max] of [['x', -12.85, -7.15], ['z', -12.05, -6.35]] as const) {
    const direction = to[key] - from[key]
    if (Math.abs(direction) < .00001) { if (from[key] <= min || from[key] >= max) return false; continue }
    const a = (min - from[key]) / direction, b = (max - from[key]) / direction
    enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b))
    if (enter >= leave) return false
  }
  return enter < leave
}

/** Short walking routes use the bridge and go around the cottage footprint. */
export function getWalkPath(from: WalkPoint, destination: WalkPoint, progressionStep = 15): WalkPoint[] {
  const target = walkablePosition(destination, undefined, progressionStep), steps = Math.max(1, Math.ceil(distance(from, target) / .5))
  let crossesWater = false
  for (let step = 1; step < steps; step++) {
    const t = step / steps, x = from.x + (target.x - from.x) * t, z = from.z + (target.z - from.z) * t
    if (Math.abs(x - riverX(z)) < 1.78 && Math.abs(z - 5) > 1.3) { crossesWater = true; break }
  }
  const route: WalkPoint[] = []
  if (crossesWater) {
    const side = from.x < riverX(from.z) ? -1 : 1
    const targetSide = target.x < riverX(target.z) ? -1 : 1
    route.push({ x: riverX(5) + side * 3.1, z: 5 })
    if (side !== targetSide) route.push({ x: riverX(5) + targetSide * 3.1, z: 5 })
  }
  route.push(target)
  const corners = [{ x: -13.3, z: -12.5 }, { x: -6.7, z: -12.5 }, { x: -6.7, z: -5.9 }, { x: -13.3, z: -5.9 }]
  const result: WalkPoint[] = []
  let cursor = from
  for (const point of route) {
    if (progressionStep > 0 && crossesHouse(cursor, point)) {
      let shortest: WalkPoint[] = [], best = Infinity
      for (let i = 0; i < corners.length; i++) for (let j = 0; j < corners.length; j++) {
        const candidate = i === j ? [corners[i], point] : [corners[i], corners[j], point]
        let previous = cursor, length = 0, clear = true
        for (const next of candidate) { if (crossesHouse(previous, next)) { clear = false; break }; length += distance(previous, next); previous = next }
        if (clear && length < best) { best = length; shortest = candidate.slice(0, -1) }
      }
      result.push(...shortest)
    }
    result.push(point); cursor = point
  }
  return result.filter((point, i) => distance(i === 0 ? from : result[i - 1], point) > .15)
}
