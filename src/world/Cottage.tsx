import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/** Tripo concept mesh, welded and reduced in Blender to 39,782 triangles. */
export function Cottage() {
  const { scene } = useGLTF('/models/cottage.glb')
  const model = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true; object.receiveShadow = true
        const material = object.material as THREE.MeshStandardMaterial
        material.roughness = .92; material.metalness = 0
      }
    })
    return copy
  }, [scene])
  return <primitive object={model} position={[-10, 0, -9]} />
}
