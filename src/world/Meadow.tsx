import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { random, regionPaths, riverX } from './geometry'
import type { Season } from '../game/types'
import { seasonArt } from './seasons'

const paths = [
  [[0, 24], [1, 14], [.2, 7], [-.2, 1], [-3, -3.5], [-9.4, -5.9]],
  [[-.2, 4.5], [6, 4.5], [13, 5], [20, 5], [27, 8]],
  [[18, 5], [19, -.5], [17.5, -7], [20, -15.5]],
  [[-3, -3.5], [-1, -7], [3, -14], [4, -28]],
]
function distanceToSegment(x: number, z: number, a: number[], b: number[]) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)
}

function grassy(x: number, z: number) {
  if (Math.abs(x - riverX(z)) < 2.15) return false
  if (x > -14.8 && x < -6.8 && z > -11.6 && z < -5.7) return false
  if (x > 1.7 && x < 9.8 && z > -4.5 && z < 2) return false
  if (x > 4.8 && x < 9.2 && z > 8.5 && z < 11.3) return false
  if (Math.hypot((x + 20) / 2.4, (z - 28) / 1.8) < 1) return false
  for (const region of Object.values(regionPaths)) for (const path of region) for (let i = 0; i < path.length - 1; i++) if (distanceToSegment(x, z, path[i], path[i + 1]) < 1.02) return false
  for (const path of paths) for (let i = 0; i < path.length - 1; i++) if (distanceToSegment(x, z, path[i], path[i + 1]) < 1.04) return false
  return true
}

export function useMeadowMaterial(season: Season = '春日') {
  const material = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ color: seasonArt[season].ground, roughness: 1 })
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vMeadowPosition;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMeadowPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = 'varying vec3 vMeadowPosition;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float meadowPatch = sin(vMeadowPosition.x*.29 + sin(vMeadowPosition.z*.33)*1.8)*sin(vMeadowPosition.z*.37 + sin(vMeadowPosition.x*.19));
        float meadowGrain = fract(sin(dot(floor(vMeadowPosition.xz*26.),vec2(12.9898,78.233)))*43758.5453);
        diffuseColor.rgb *= .98 + meadowPatch*.11 + (meadowGrain-.5)*.04;
        float woodland = 1. - smoothstep(10., 20., length((vMeadowPosition.xz-vec2(32.,3.))*vec2(1.,.8)));
        float alpine = 1. - smoothstep(12., 23., length((vMeadowPosition.xz-vec2(42.,-30.))*vec2(.8,1.)));
        float flowerMeadow = 1. - smoothstep(7., 16., length((vMeadowPosition.xz-vec2(-10.,27.))*vec2(.7,1.)));
        diffuseColor.rgb *= mix(vec3(1.), vec3(.77,.87,.81), woodland*.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*.6+vec3(.15,.15,.16), alpine*.65);
        diffuseColor.rgb *= mix(vec3(1.), vec3(1.09,1.045,.98), flowerMeadow*.55);
      `)
    }
    material.customProgramCacheKey = () => 'meadow-ground-regions-v2'
    return material
  }, [season])
  useEffect(() => () => material.dispose(), [material])
  return material
}

export const Meadow = memo(function Meadow({ season = '春日' }: { season?: Season }) {
  const grass = useRef<THREE.InstancedMesh>(null)
  const blades = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), vertices: number[] = [], colors: number[] = [], indices: number[] = []
    const bottom = new THREE.Color(seasonArt[season].grassBottom), top = new THREE.Color(seasonArt[season].grassTop)
    for (let blade = 0; blade < 4; blade++) {
      const angle = blade * 2.4, width = .042 + blade * .002, dx = Math.cos(angle) * width, dz = Math.sin(angle) * width, height = .11 + blade * .023
      const start = vertices.length / 3
      vertices.push(-dx, 0, -dz, dx, 0, dz, dx * .7 + .02, height * .6, dz * .7, .035, height, .025)
      for (let p = 0; p < 4; p++) { const c = bottom.clone().lerp(top, p / 3); colors.push(c.r, c.g, c.b) }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices); geometry.computeVertexNormals()
    return geometry
  }, [season])
  useEffect(() => () => blades.dispose(), [blades])
  const data = useMemo(() => {
    const rand = random(519), points: { x: number; z: number; size: number; rotation: number }[] = []
    for (let patch = 0; patch < 990; patch++) {
      const px = -31 + rand() * 92, pz = -45 + rand() * 82
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2, radius = Math.sqrt(rand()) * (.4 + patch % 4 * .12), x = px + Math.cos(a) * radius, z = pz + Math.sin(a) * radius
        if (!grassy(x, z)) continue
        const pasture = x > -15 && x < -1 && z > -3.5 && z < 10.5
        points.push({ x, z, size: (pasture ? .5 : .85) + rand() * .6, rotation: rand() * Math.PI * 2 })
      }
    }
    return points
  }, [])
  const shaderRef = useRef<{ uTime: { value: number } }>(null)
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })
    m.onBeforeCompile = shader => {
      shader.uniforms.uTime = { value: 0 }; shaderRef.current = shader.uniforms as { uTime: { value: number } }
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 grassOrigin = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
        float breeze = sin(uTime*1.4 + grassOrigin.x*.55 + grassOrigin.z*.35);
        transformed.x += breeze * position.y * position.y * .7;
      `)
    }
    m.customProgramCacheKey = () => 'meadow-breeze-v1'
    return m
  }, [])
  useEffect(() => () => material.dispose(), [material])
  useLayoutEffect(() => {
    if (!grass.current) return
    const object = new THREE.Object3D()
    data.forEach((p, i) => {
      object.position.set(p.x, .018, p.z); object.rotation.set(0, p.rotation, 0); object.scale.setScalar(p.size); object.updateMatrix(); grass.current!.setMatrixAt(i, object.matrix)
    })
    grass.current.instanceMatrix.needsUpdate = true; grass.current.computeBoundingSphere()
  }, [data, blades])
  useFrame(state => { if (shaderRef.current) shaderRef.current.uTime.value = state.clock.elapsedTime })
  return <instancedMesh ref={grass} args={[blades, material, data.length]} receiveShadow />
})
