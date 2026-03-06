'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CompiledScene } from '@/lib/studio/schema'

interface Props {
  compiled: CompiledScene
}

export default function ScenePreview3D({ compiled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f8f5f0')

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.shadowMap.enabled = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(
      compiled.camera.fov,
      1,
      0.1,
      100,
    )
    camera.position.set(
      compiled.camera.position.x,
      compiled.camera.position.y,
      compiled.camera.position.z,
    )

    const target = new THREE.Vector3(
      compiled.camera.target.x,
      compiled.camera.target.y,
      compiled.camera.target.z,
    )
    camera.lookAt(target)

    const ambient = new THREE.AmbientLight('#ffffff', 1.2)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight('#fff9f0', 2.2)
    sun.position.set(4.2, 6.5, 3.8)
    sun.castShadow = true
    scene.add(sun)

    for (const mesh of compiled.meshes) {
      const geometry = new THREE.BoxGeometry(mesh.size.x, mesh.size.y, mesh.size.z)
      const material = new THREE.MeshStandardMaterial({
        color: mesh.color,
        transparent: typeof mesh.opacity === 'number',
        opacity: mesh.opacity ?? 1,
        roughness: mesh.kind === 'worktop' ? 0.24 : 0.54,
        metalness: mesh.kind === 'worktop' ? 0.08 : 0.02,
      })
      const object = new THREE.Mesh(geometry, material)
      object.position.set(mesh.position.x, mesh.position.y, mesh.position.z)
      object.rotation.y = mesh.rotationY
      object.receiveShadow = true
      object.castShadow = mesh.kind !== 'opening'
      scene.add(object)

      if (mesh.kind === 'module') {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: '#1f1b1c' }),
        )
        edges.position.copy(object.position)
        edges.rotation.copy(object.rotation)
        scene.add(edges)
      }
    }

    const grid = new THREE.GridHelper(
      Math.max(compiled.bounds.width, compiled.bounds.depth) * 1.4,
      24,
      '#cabaa6',
      '#e6ddd1',
    )
    scene.add(grid)

    let controls: { dispose: () => void; update: () => void } | null = null
    let frameId = 0

    import('three/examples/jsm/controls/OrbitControls.js')
      .then(({ OrbitControls }) => {
        controls = new OrbitControls(camera, renderer.domElement)
        controls.update()
      })
      .catch(() => {})

    const resize = () => {
      const width = container.clientWidth || 1
      const height = container.clientHeight || 1
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const tick = () => {
      controls?.update()
      renderer.render(scene, camera)
      frameId = window.requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    tick()

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls?.dispose()

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })

      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [compiled])

  return <div ref={containerRef} className="h-full w-full rounded-[24px] overflow-hidden" />
}
