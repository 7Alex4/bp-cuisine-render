import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { createDefaultStudioScene } from '../lib/studio/catalog.ts'
import { compileStudioScene } from '../lib/studio/compiler.ts'
import { buildBlenderRenderPackage } from '../lib/server/blender.ts'

const tempDirs: string[] = []

afterEach(async () => {
  process.env.STUDIO_DATA_DIR = ''
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true })
    }),
  )
})

describe('compileStudioScene', () => {
  it('derives floor, walls, modules and worktops from the canonical scene', () => {
    const scene = createDefaultStudioScene('scene-1', 'Projet test')
    const compiled = compileStudioScene(scene)

    assert.equal(compiled.sceneId, 'scene-1')
    assert.ok(compiled.meshes.some((mesh) => mesh.kind === 'floor'))
    assert.ok(compiled.meshes.some((mesh) => mesh.kind === 'wall'))
    assert.ok(compiled.meshes.some((mesh) => mesh.kind === 'module'))
    assert.ok(compiled.meshes.some((mesh) => mesh.kind === 'worktop'))
    assert.equal(compiled.warnings.length, 0)
  })

  it('emits warnings when modules overflow the room', () => {
    const scene = createDefaultStudioScene('scene-2', 'Projet overflow')
    scene.modules[0] = {
      ...scene.modules[0],
      placement: { mode: 'wall', wall: 'north', offset: 99 },
    }

    const compiled = compileStudioScene(scene)
    assert.ok(compiled.warnings.some((warning) => warning.includes('depasse le mur north')))
  })
})

describe('buildBlenderRenderPackage', () => {
  it('wraps the compiled scene with a deterministic Cycles preset', () => {
    const scene = createDefaultStudioScene('scene-3', 'Projet blender')
    const project = {
      id: 'scene-3',
      name: 'Projet blender',
      status: 'ready' as const,
      latestRevisionNumber: 4,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z',
      scene,
      revisions: [],
    }

    const pkg = buildBlenderRenderPackage(project)
    assert.equal(pkg.renderPreset.engine, 'CYCLES')
    assert.equal(pkg.renderPreset.output.width, 2400)
    assert.equal(pkg.project.latestRevisionNumber, 4)
    assert.equal(pkg.compiled.sceneId, 'scene-3')
  })
})

describe('studio repository', () => {
  it('creates, lists and saves project revisions in the local studio store', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet repo' })
    assert.equal(created.latestRevisionNumber, 1)

    const listed = await repository.listStudioProjects()
    assert.equal(listed.length, 1)
    assert.equal(listed[0].name, 'Projet repo')

    const saved = await repository.saveStudioProject(created.id, {
      name: 'Projet repo maj',
      scene: { ...created.scene, name: 'Projet repo maj' },
      source: 'manual',
      status: 'ready',
    })

    assert.equal(saved.latestRevisionNumber, 2)
    assert.equal(saved.revisions.length, 2)

    const loaded = await repository.getStudioProject(created.id)
    assert.equal(loaded?.name, 'Projet repo maj')
  })
})
