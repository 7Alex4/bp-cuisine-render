'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getPreviewVisibleWalls } from '@/lib/studio/compiler'
import { getRenderAmbienceSettings } from '@/lib/studio/render-presets'
import type { CompiledScene, StudioScene, WallId } from '@/lib/studio/schema'

interface Props {
  compiled: CompiledScene
  scene: StudioScene
}

function getWallFromMeshId(meshId: string): WallId | null {
  const match = meshId.match(/^wall-(north|east|south|west)(?:-|$)/)
  return (match?.[1] as WallId | undefined) || null
}

export default function ScenePreview3D({ compiled, scene: sourceScene }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ambience = getRenderAmbienceSettings(sourceScene.renderAmbiencePreset)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(ambience.previewBackgroundColor)

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

    const ambient = new THREE.AmbientLight('#ffffff', ambience.ambientIntensity)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight(ambience.sunColor, ambience.sunIntensity)
    sun.position.set(4.2, 6.5, 3.8)
    sun.castShadow = true
    scene.add(sun)

    const visibleWalls = new Set(getPreviewVisibleWalls(sourceScene))
    const openingWalls = new Map(sourceScene.openings.map((opening) => [opening.id, opening.wall]))

    for (const mesh of compiled.meshes) {
      if (mesh.kind === 'ceiling') {
        continue
      }

      if (mesh.kind === 'wall') {
        const wall = getWallFromMeshId(mesh.id)
        if (wall && !visibleWalls.has(wall)) {
          continue
        }
      }

      if (mesh.kind === 'opening') {
        const openingId = mesh.id.replace(/^opening-/, '')
        const wall = openingWalls.get(openingId)
        if (wall && !visibleWalls.has(wall)) {
          continue
        }
      }

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
  }, [compiled, sourceScene])

  return <div ref={containerRef} className="h-full w-full rounded-[24px] overflow-hidden" />
}
