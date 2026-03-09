import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import {
  applyPresetEnL,
  applyPresetEnU,
  applyPresetLineaire,
  createBlankStudioScene,
  createDefaultStudioScene,
} from '../lib/studio/catalog.ts'
import { compileStudioScene, getPreviewVisibleWalls, getSceneCamera } from '../lib/studio/compiler.ts'
import {
  MODULE_JOINT_GAP,
  buildDuplicatedModule,
  deriveDraggedPlacement,
  getModuleFootprintBounds,
  resolveDraggedOpening,
  resolveDraggedPlacement,
} from '../lib/studio/plan2d.ts'
import {
  getAutoCameraPresetLabel,
  getCameraAngleLabel,
  getImplantationLabel,
  getPreviewDeliveryLabel,
  getRenderAmbienceLabel,
  getRenderQualityLabel,
  getVisualDossierSummary,
  getVisualReferencesSummary,
} from '../lib/studio/project-summary.ts'
import { buildBlenderRenderPackage } from '../lib/server/blender.ts'
import {
  normalizeStudioScene,
  summarizeRoomPhotoReferences,
  validateSiteSurvey,
  validateStudioScene,
} from '../lib/studio/schema.ts'

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

  it('keeps a blank project renderable while surfacing survey warnings', () => {
    const scene = createBlankStudioScene('scene-blank', 'Projet vide')
    const compiled = compileStudioScene(scene)

    assert.equal(compiled.sceneId, 'scene-blank')
    assert.ok(compiled.meshes.some((mesh) => mesh.kind === 'floor'))
    assert.equal(scene.modules.length, 0)
    assert.ok(compiled.warnings.some((warning) => warning.includes('[Releve chantier]')))
  })

  it('places room walls outside the floor footprint so the inner faces stay aligned', () => {
    const scene = createBlankStudioScene('scene-wall-offset', 'Projet murs')
    const compiled = compileStudioScene(scene)
    const northWall = compiled.meshes.find((mesh) => mesh.id === 'wall-north')
    const southWall = compiled.meshes.find((mesh) => mesh.id === 'wall-south')
    const westWall = compiled.meshes.find((mesh) => mesh.id === 'wall-west')
    const eastWall = compiled.meshes.find((mesh) => mesh.id === 'wall-east')

    assert.ok(northWall)
    assert.ok(southWall)
    assert.ok(westWall)
    assert.ok(eastWall)
    assert.equal(northWall.position.z, -(scene.room.depth / 2) - scene.room.wallThickness / 2)
    assert.equal(southWall.position.z, scene.room.depth / 2 + scene.room.wallThickness / 2)
    assert.equal(westWall.position.x, -(scene.room.width / 2) - scene.room.wallThickness / 2)
    assert.equal(eastWall.position.x, scene.room.width / 2 + scene.room.wallThickness / 2)
    assert.equal(northWall.rotationY, 0)
    assert.equal(southWall.rotationY, 0)
    assert.equal(westWall.rotationY, 0)
    assert.equal(eastWall.rotationY, 0)
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

  it('keeps only the kitchen walls visible in the 3D preview', () => {
    const scene = createDefaultStudioScene('scene-preview-walls', 'Projet preview')
    scene.modules = [
      {
        ...scene.modules[0],
        placement: { mode: 'wall', wall: 'north', offset: 0.3 },
      },
      {
        ...scene.modules[1],
        placement: { mode: 'wall', wall: 'west', offset: 0.4 },
      },
    ]

    const visibleWalls = getPreviewVisibleWalls(scene)

    assert.deepEqual(visibleWalls, ['north', 'west'])
  })

  it('can force a 3-wall shell even when the kitchen uses 2 walls', () => {
    const scene = createDefaultStudioScene('scene-preview-force-3', 'Projet preview 3 murs')
    scene.previewShellMode = '3-walls'
    scene.modules = [
      {
        ...scene.modules[0],
        placement: { mode: 'wall', wall: 'north', offset: 0.3 },
      },
      {
        ...scene.modules[1],
        placement: { mode: 'wall', wall: 'west', offset: 0.4 },
      },
    ]

    const visibleWalls = getPreviewVisibleWalls(scene)

    assert.deepEqual(visibleWalls, ['north', 'east', 'west'])
  })

  it('can force a 2-wall shell even when the kitchen uses 3 walls', () => {
    const scene = createDefaultStudioScene('scene-preview-force-2', 'Projet preview 2 murs')
    scene.previewShellMode = '2-walls'
    scene.modules = [
      {
        ...scene.modules[0],
        placement: { mode: 'wall', wall: 'north', offset: 0.3 },
      },
      {
        ...scene.modules[1],
        placement: { mode: 'wall', wall: 'west', offset: 0.4 },
      },
      {
        ...scene.modules[2],
        placement: { mode: 'wall', wall: 'east', offset: 0.5 },
      },
    ]

    const visibleWalls = getPreviewVisibleWalls(scene)

    assert.deepEqual(visibleWalls, ['north', 'west'])
  })

  it('falls back to a readable corner shell for a blank project preview', () => {
    const scene = createBlankStudioScene('scene-preview-blank', 'Projet vide')

    const visibleWalls = getPreviewVisibleWalls(scene)

    assert.deepEqual(visibleWalls, ['north', 'west'])
  })

  it('keeps a corner shell in 2-wall mode instead of opposite walls', () => {
    const scene = createBlankStudioScene('scene-preview-opposite', 'Projet oppose')
    scene.previewShellMode = '2-walls'
    scene.modules = [
      {
        ...createDefaultStudioScene('seed-opposite', 'Seed').modules[0],
        placement: { mode: 'wall', wall: 'north', offset: 0.3 },
      },
      {
        ...createDefaultStudioScene('seed-opposite-2', 'Seed').modules[1],
        placement: { mode: 'wall', wall: 'south', offset: 0.4 },
      },
    ]

    const visibleWalls = getPreviewVisibleWalls(scene)

    assert.notDeepEqual(visibleWalls, ['north', 'south'])
    assert.equal(visibleWalls.length, 2)
  })

  it('changes the automatic camera when a preset is selected', () => {
    const scene = createBlankStudioScene('scene-camera-preset', 'Projet camera preset')
    const balanced = getSceneCamera(scene)

    scene.autoCameraPreset = 'wide'
    const wide = getSceneCamera(scene)

    assert.notDeepEqual(wide.position, balanced.position)
    assert.ok(wide.fov > balanced.fov)
  })
})

describe('site survey validation', () => {
  it('computes a ready completeness status for a coherent survey', () => {
    const scene = createDefaultStudioScene('scene-survey-1', 'Projet releve')
    const result = validateSiteSurvey(scene.siteSurvey)

    assert.deepEqual(result.errors, [])
    assert.equal(result.completeness.status, 'pret')
    assert.equal(result.completeness.score, 100)
    assert.equal(result.workflow.previewReady, true)
    assert.equal(result.workflow.renderReady, true)
  })

  it('flags structural incoherences from measured data', () => {
    const scene = createDefaultStudioScene('scene-survey-2', 'Projet releve incoherent')
    scene.siteSurvey = {
      ...scene.siteSurvey,
      usefulHeights: scene.siteSurvey.usefulHeights.map((usefulHeight, index) =>
        index === 0 ? { ...usefulHeight, height: scene.siteSurvey.dimensions.height + 0.25 } : usefulHeight,
      ),
      technicalConstraints: {
        ...scene.siteSurvey.technicalConstraints,
        waterSupplyWall: 'unknown',
        drainWall: 'unknown',
      },
      completeness: {
        score: 100,
        status: 'pret',
      },
    }

    const result = validateSiteSurvey(scene.siteSurvey)

    assert.ok(result.errors.some((error) => error.includes('sous-hauteur')))
    assert.ok(result.errors.some((error) => error.includes('Evier requis')))
    assert.equal(result.completeness.status, 'bloquant')
    assert.ok(result.warnings.some((warning) => warning.includes('n est pas a jour')))
    assert.equal(result.workflow.previewReady, false)
    assert.equal(result.workflow.renderReady, false)
  })

  it('marks a survey as sufficient when geometry is reliable but final polish is missing', () => {
    const scene = createDefaultStudioScene('scene-survey-4', 'Projet suffisant')
    scene.siteSurvey = {
      ...scene.siteSurvey,
      finishPreferences: {
        ...scene.siteSurvey.finishPreferences,
        handleStyle: '',
      },
      workflowChecklist: {
        ...scene.siteSurvey.workflowChecklist,
        finishesVerified: false,
      },
      completeness: {
        score: 100,
        status: 'pret',
      },
    }

    const result = validateSiteSurvey(scene.siteSurvey)

    assert.equal(result.completeness.status, 'suffisant')
    assert.equal(result.workflow.previewReady, true)
    assert.equal(result.workflow.renderReady, false)
    assert.ok(result.workflow.verificationPoints.some((item) => item.includes('finitions generiques')))
  })

  it('warns when canonical dimensions diverge from the measured survey', () => {
    const scene = createDefaultStudioScene('scene-survey-3', 'Projet divergence')
    scene.room.width += 0.25

    const warnings = validateStudioScene(scene)
    assert.ok(warnings.some((warning) => warning.includes('dimensions de la scene canonique divergent')))
  })
})

describe('project summary helpers', () => {
  it('detects an L-shaped kitchen with an island', () => {
    const scene = createDefaultStudioScene('scene-summary-l', 'Projet L')
    scene.modules = [
      {
        ...scene.modules[0],
        kind: 'tall',
        placement: { mode: 'wall', wall: 'north', offset: 0.3 },
      },
      {
        ...scene.modules[1],
        kind: 'base',
        placement: { mode: 'wall', wall: 'west', offset: 0.4 },
      },
      {
        ...scene.modules[5],
        kind: 'island',
        placement: { mode: 'free', x: 0, z: 0, rotation: 0 },
      },
    ]

    assert.equal(getImplantationLabel(scene), 'En L + ilot')
  })

  it('describes the default automatic camera as a 3/4 angle', () => {
    const scene = createBlankStudioScene('scene-summary-camera', 'Projet camera')
    assert.equal(getCameraAngleLabel(scene), '3/4 sud-est')
  })

  it('returns readable labels for render presets', () => {
    assert.equal(getAutoCameraPresetLabel('hero'), 'Hero')
    assert.equal(getRenderAmbienceLabel('warm-showroom'), 'Showroom chaud')
    assert.equal(getRenderQualityLabel('refined'), 'Affine')
  })

  it('summarizes preview and render readiness for the operator', () => {
    assert.equal(
      getPreviewDeliveryLabel({ previewReady: false, renderReady: false }),
      'Preview a completer',
    )
    assert.equal(
      getPreviewDeliveryLabel({ previewReady: true, renderReady: false }),
      'Preview ok · rendu verrouille',
    )
    assert.equal(
      getPreviewDeliveryLabel({
        previewReady: true,
        renderReady: false,
        renderQualityPreset: 'express',
      }),
      'Preview ok · express dispo',
    )
    assert.equal(
      getPreviewDeliveryLabel({ previewReady: true, renderReady: true }),
      'Preview ok · rendu pret',
    )
  })

  it('summarizes visual references for the operator', () => {
    const scene = createBlankStudioScene('scene-summary-refs', 'Projet refs')
    scene.references.sketchName = 'croquis.pdf'
    scene.references.roomPhotoAssets = [
      { fileName: 'mur-nord.jpg', category: 'mur-nord' },
      { fileName: 'mur-est.jpg', category: 'mur-est' },
      { fileName: 'sol.jpg', category: 'sol' },
    ]
    scene.references.roomPhotoNames = scene.references.roomPhotoAssets.map((asset) => asset.fileName)
    scene.siteSurvey.visualReferences.floorPhotoProvided = true

    const summary = getVisualReferencesSummary(scene)

    assert.equal(summary.value, 'Croquis joint · 3 photos')
    assert.ok(summary.hint.includes('murs nord/est'))
    assert.ok(summary.hint.includes('sol ok'))
  })

  it('summarizes wall coverage from categorized room photos', () => {
    const scene = createBlankStudioScene('scene-summary-coverage', 'Projet coverage')
    scene.references.roomPhotoAssets = [
      { fileName: 'north.jpg', category: 'mur-nord' },
      { fileName: 'east.jpg', category: 'mur-est' },
      { fileName: 'ceiling.jpg', category: 'plafond' },
      { fileName: 'detail.jpg', category: 'detail-technique' },
    ]

    const coverage = summarizeRoomPhotoReferences(scene.references)

    assert.deepEqual(coverage.wallCoverage, ['north', 'east'])
    assert.deepEqual(coverage.missingWalls, ['south', 'west'])
    assert.equal(coverage.hasCeiling, true)
    assert.equal(coverage.technicalDetailCount, 1)
  })

  it('marks the visual dossier as insufficient when the photo set is too thin', () => {
    const scene = createBlankStudioScene('scene-visual-dossier-low', 'Projet visuel faible')
    scene.references.roomPhotoAssets = [{ fileName: 'piece.jpg', category: 'piece' }]

    const dossier = getVisualDossierSummary(scene)

    assert.equal(dossier.status, 'insuffisant')
    assert.ok(dossier.missing.includes('joindre le croquis ou plan'))
    assert.ok(dossier.missing.includes('prendre au moins 2 photos de la piece'))
  })

  it('marks the visual dossier as sufficient when the context is usable', () => {
    const scene = createBlankStudioScene('scene-visual-dossier-mid', 'Projet visuel suffisant')
    scene.references.sketchName = 'croquis.pdf'
    scene.references.roomPhotoAssets = [
      { fileName: 'north.jpg', category: 'mur-nord' },
      { fileName: 'east.jpg', category: 'mur-est' },
      { fileName: 'floor.jpg', category: 'sol' },
    ]

    const dossier = getVisualDossierSummary(scene)

    assert.equal(dossier.status, 'suffisant')
    assert.ok(dossier.score >= 50)
  })

  it('marks the visual dossier as complete when all key references are covered', () => {
    const scene = createBlankStudioScene('scene-visual-dossier-full', 'Projet visuel complet')
    scene.references.sketchName = 'croquis.pdf'
    scene.references.roomPhotoAssets = [
      { fileName: 'north.jpg', category: 'mur-nord' },
      { fileName: 'east.jpg', category: 'mur-est' },
      { fileName: 'south.jpg', category: 'mur-sud' },
      { fileName: 'west.jpg', category: 'mur-ouest' },
      { fileName: 'floor.jpg', category: 'sol' },
      { fileName: 'ceiling.jpg', category: 'plafond' },
      { fileName: 'detail.jpg', category: 'detail-technique' },
    ]

    const dossier = getVisualDossierSummary(scene)

    assert.equal(dossier.status, 'complet')
    assert.equal(dossier.score, 100)
    assert.deepEqual(dossier.missing, [])
  })
})

describe('buildBlenderRenderPackage', () => {
  it('wraps the compiled scene with a deterministic Cycles preset', () => {
    const scene = createDefaultStudioScene('scene-3', 'Projet blender')
    scene.renderAmbiencePreset = 'warm-showroom'
    scene.renderQualityPreset = 'refined'
    const project = {
      id: 'scene-3',
      name: 'Projet blender',
      status: 'ready' as const,
      surveyStage: 'pret' as const,
      visualDossierStatus: 'complet' as const,
      visualDossierScore: 100,
      latestRevisionNumber: 4,
      createdAt: '2026-03-06T00:00:00.000Z',
      updatedAt: '2026-03-06T00:00:00.000Z',
      scene,
      revisions: [],
    }

    const pkg = buildBlenderRenderPackage(project)
    assert.equal(pkg.renderPreset.engine, 'CYCLES')
    assert.equal(pkg.renderPreset.output.width, 2200)
    assert.equal(pkg.renderPreset.output.samples, 192)
    assert.equal(pkg.renderPreset.ambience, 'warm-showroom')
    assert.equal(pkg.renderPreset.quality, 'refined')
    assert.equal(pkg.renderPreset.views.length, 2)
    assert.equal(pkg.renderPreset.views[0].fileName, 'final.png')
    assert.equal(pkg.renderPreset.views[1].fileName, 'wide.png')
    assert.equal(pkg.renderPreset.denoise, true)
    assert.equal(pkg.renderPreset.bevelSegments, 3)
    assert.equal(pkg.renderPreset.lighting.fillEnergy, 480)
    assert.equal(pkg.renderPreset.colorManagement, 'AgX - Medium Contrast')
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
    assert.equal(created.status, 'draft')
    assert.equal(created.surveyStage, 'a_verifier')
    assert.equal(created.visualDossierStatus, 'insuffisant')
    assert.equal(created.scene.modules.length, 0)
    assert.equal(created.scene.siteSurvey.completeness.status, 'a_verifier')

    const listed = await repository.listStudioProjects()
    assert.equal(listed.length, 1)
    assert.equal(listed[0].name, 'Projet repo')
    assert.equal(listed[0].surveyStage, 'a_verifier')
    assert.equal(listed[0].visualDossierStatus, 'insuffisant')

    const saved = await repository.saveStudioProject(created.id, {
      name: 'Projet repo maj',
      scene: { ...created.scene, name: 'Projet repo maj' },
      source: 'manual',
    })

    assert.equal(saved.latestRevisionNumber, 2)
    assert.equal(saved.revisions.length, 2)
    assert.equal(typeof saved.visualDossierScore, 'number')

    const loaded = await repository.getStudioProject(created.id)
    assert.equal(loaded?.name, 'Projet repo maj')
  })

  it('stores autosave revisions with the autosave source', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-autosave-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet autosave' })
    const saved = await repository.saveStudioProject(created.id, {
      name: 'Projet autosave',
      scene: { ...created.scene, name: 'Projet autosave' },
      source: 'autosave',
    })

    assert.equal(saved.revisions.at(-1)?.source, 'autosave')
    assert.equal(saved.latestRevisionNumber, 2)
  })

  it('derives status=ready when site survey is complete', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-status-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet pret' })
    const readyScene = createDefaultStudioScene(created.id, created.name)

    const saved = await repository.saveStudioProject(created.id, {
      scene: readyScene,
      source: 'manual',
    })
    assert.equal(saved.status, 'ready')
    assert.equal(saved.surveyStage, 'pret')
  })

  it('derives status=ready when survey is sufficient for preview', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-sufficient-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet suffisant preview' })
    const sufficientScene = createDefaultStudioScene(created.id, created.name)
    sufficientScene.siteSurvey = {
      ...sufficientScene.siteSurvey,
      finishPreferences: {
        ...sufficientScene.siteSurvey.finishPreferences,
        handleStyle: '',
      },
      workflowChecklist: {
        ...sufficientScene.siteSurvey.workflowChecklist,
        finishesVerified: false,
      },
      completeness: {
        score: 100,
        status: 'pret',
      },
    }

    const saved = await repository.saveStudioProject(created.id, {
      scene: sufficientScene,
      source: 'manual',
    })

    assert.equal(saved.status, 'ready')
    assert.equal(saved.surveyStage, 'suffisant')
  })

  it('derives status=draft when site survey is incomplete', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-draft-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet incomplet' })
    const readyScene = createDefaultStudioScene(created.id, created.name)

    const degradedScene = {
      ...readyScene,
      siteSurvey: {
        ...readyScene.siteSurvey,
        desiredEquipment: [],
        completeness: { score: 0, status: 'bloquant' },
      },
    }

    const saved = await repository.saveStudioProject(created.id, {
      scene: degradedScene,
      source: 'manual',
    })
    assert.equal(saved.status, 'draft')
    assert.equal(saved.surveyStage, 'a_verifier')
  })

  it('normalizes legacy room photo names into categorized assets', () => {
    const scene = createBlankStudioScene('scene-legacy-photos', 'Projet legacy')
    scene.references.roomPhotoName = 'photo-1.jpg'
    scene.references.roomPhotoNames = ['photo-1.jpg', 'photo-2.jpg']

    const normalized = normalizeStudioScene(scene)

    assert.deepEqual(normalized.references.roomPhotoAssets, [
      { fileName: 'photo-1.jpg', category: 'piece' },
      { fileName: 'photo-2.jpg', category: 'piece' },
    ])
  })

  it('synchronizes survey visual flags from categorized uploads', () => {
    const scene = createBlankStudioScene('scene-visual-sync', 'Projet visuel')
    scene.references.sketchName = 'croquis.pdf'
    scene.references.roomPhotoAssets = [
      { fileName: 'north.jpg', category: 'mur-nord' },
      { fileName: 'east.jpg', category: 'mur-est' },
      { fileName: 'south.jpg', category: 'mur-sud' },
      { fileName: 'west.jpg', category: 'mur-ouest' },
      { fileName: 'floor.jpg', category: 'sol' },
      { fileName: 'ceiling.jpg', category: 'plafond' },
    ]

    const normalized = normalizeStudioScene(scene)

    assert.equal(normalized.siteSurvey.visualReferences.sketchProvided, true)
    assert.equal(normalized.siteSurvey.visualReferences.roomPhotosProvided, true)
    assert.equal(normalized.siteSurvey.visualReferences.roomPhotoCount, 6)
    assert.equal(normalized.siteSurvey.visualReferences.floorPhotoProvided, true)
    assert.equal(normalized.siteSurvey.visualReferences.ceilingPhotoProvided, true)
    assert.equal(normalized.siteSurvey.visualReferences.fullWallSetProvided, true)
  })

  it('uploads a file and associates it with the project', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-upload-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet upload' })

    const fakeImage = Buffer.from('fake-image-data')
    await repository.saveProjectUpload(created.id, 'croquis.png', fakeImage)

    const uploadPath = repository.getProjectUploadPath(created.id, 'croquis.png')
    const saved = await fs.readFile(uploadPath)
    assert.deepEqual(saved, fakeImage)
  })

  it('deletes a single uploaded file without removing the project', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-delete-one-upload-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet suppression upload' })

    await repository.saveProjectUpload(created.id, 'photo.jpg', Buffer.from('fake-photo'))
    const uploadPath = repository.getProjectUploadPath(created.id, 'photo.jpg')
    await fs.access(uploadPath)

    await repository.deleteProjectUpload(created.id, 'photo.jpg')

    await fs.access(path.join(tempDir, 'projects', created.id, 'project.json'))
    await assert.rejects(fs.access(uploadPath))
  })

  it('deleteStudioProject cleans up uploads alongside blender artifacts', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-delete-up-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet uploads delete' })

    await repository.saveProjectUpload(created.id, 'photo.jpg', Buffer.from('fake-photo'))
    const uploadPath = repository.getProjectUploadPath(created.id, 'photo.jpg')
    await fs.access(uploadPath)

    await repository.deleteStudioProject(created.id)

    await assert.rejects(fs.access(path.join(tempDir, 'projects', created.id)))
    await assert.rejects(fs.access(uploadPath))
  })

  it('deletes a project and its generated Blender artifacts', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-studio-delete-'))
    tempDirs.push(tempDir)
    process.env.STUDIO_DATA_DIR = tempDir

    const repository = await import(`../lib/server/studio-repository.ts?ts=${Date.now()}`)
    const created = await repository.createStudioProject({ name: 'Projet a supprimer' })

    const packageDir = path.join(tempDir, 'blender-packages', created.id)
    const renderDir = path.join(tempDir, 'blender-renders', created.id)
    await fs.mkdir(packageDir, { recursive: true })
    await fs.mkdir(renderDir, { recursive: true })
    await fs.writeFile(path.join(packageDir, 'rev-1.json'), '{}\n', 'utf8')
    await fs.writeFile(path.join(renderDir, 'final.png'), 'fake-image', 'utf8')

    await repository.deleteStudioProject(created.id)

    const listed = await repository.listStudioProjects()
    assert.equal(listed.length, 0)

    await assert.rejects(fs.access(path.join(tempDir, 'projects', created.id)))
    await assert.rejects(fs.access(packageDir))
    await assert.rejects(fs.access(renderDir))
  })
})

describe('implantation presets', () => {
  it('applyPresetLineaire places modules on the north wall without overflow', () => {
    const scene = createBlankStudioScene('scene-preset-lin', 'Preset lineaire')
    const result = applyPresetLineaire(scene)

    assert.equal(result.previewShellMode, '2-walls')

    const northModules = result.modules.filter(
      (m) => m.placement.mode === 'wall' && (m.placement as { wall: string }).wall === 'north',
    )
    assert.ok(northModules.length > 0)
    for (const mod of northModules) {
      const placement = mod.placement as { mode: 'wall'; wall: string; offset: number }
      assert.ok(
        placement.offset + mod.width <= scene.room.width,
        `Module ${mod.label} overflows north wall: ${placement.offset} + ${mod.width} > ${scene.room.width}`,
      )
    }
  })

  it('applyPresetEnL uses north and west walls', () => {
    const scene = createBlankStudioScene('scene-preset-l', 'Preset en L')
    const result = applyPresetEnL(scene)

    assert.equal(result.previewShellMode, '2-walls')
    const walls = new Set(
      result.modules
        .filter((m) => m.placement.mode === 'wall')
        .map((m) => (m.placement as { wall: string }).wall),
    )
    assert.ok(walls.has('north'))
    assert.ok(walls.has('west'))

    for (const mod of result.modules.filter((m) => m.placement.mode === 'wall')) {
      const placement = mod.placement as { mode: 'wall'; wall: string; offset: number }
      const wallLength = placement.wall === 'north' || placement.wall === 'south' ? scene.room.width : scene.room.depth
      assert.ok(
        placement.offset + mod.width <= wallLength,
        `Module ${mod.label} overflows wall ${placement.wall}: ${placement.offset} + ${mod.width} > ${wallLength}`,
      )
    }
  })

  it('applyPresetEnU uses north, west and east walls', () => {
    const scene = createBlankStudioScene('scene-preset-u', 'Preset en U')
    const result = applyPresetEnU(scene)

    assert.equal(result.previewShellMode, '3-walls')
    assert.equal(getImplantationLabel(result), 'En U')
    assert.equal(result.modules.some((m) => m.kind === 'island'), false)

    const walls = new Set(
      result.modules
        .filter((m) => m.placement.mode === 'wall')
        .map((m) => (m.placement as { wall: string }).wall),
    )
    assert.ok(walls.has('north'))
    assert.ok(walls.has('west'))
    assert.ok(walls.has('east'))

    for (const mod of result.modules.filter((m) => m.placement.mode === 'wall')) {
      const placement = mod.placement as { mode: 'wall'; wall: string; offset: number }
      const wallLength = placement.wall === 'north' || placement.wall === 'south' ? scene.room.width : scene.room.depth
      assert.ok(
        placement.offset + mod.width <= wallLength,
        `Module ${mod.label} overflows wall ${placement.wall}: ${placement.offset} + ${mod.width} > ${wallLength}`,
      )
    }
  })
})

describe('plan 2D drag helpers', () => {
  it('snaps a wall module to the nearest wall with a coherent offset', () => {
    const scene = createBlankStudioScene('scene-drag-wall', 'Drag wall')
    const moduleSpec = applyPresetLineaire(scene).modules[0]

    const placement = deriveDraggedPlacement(scene, moduleSpec, { x: 0.35, z: 1.6 })

    assert.equal(placement.mode, 'wall')
    assert.equal(placement.wall, 'west')
    assert.ok(placement.offset >= 0)
    assert.ok(placement.offset + moduleSpec.width <= scene.room.depth)
  })

  it('avoids openings when dragging a wall module', () => {
    const scene = createBlankStudioScene('scene-drag-opening', 'Drag opening')
    scene.openings = [
      {
        id: 'opening-1',
        name: 'Fenetre',
        wall: 'north',
        kind: 'window',
        offset: 1.1,
        width: 1.2,
        height: 1.2,
        baseHeight: 0.9,
      },
    ]
    const moduleSpec = applyPresetLineaire(scene).modules[0]

    const resolution = resolveDraggedPlacement(scene, moduleSpec, { x: 1.5, z: 0.2 })

    assert.equal(resolution.placement.mode, 'wall')
    assert.equal(resolution.placement.wall, 'north')
    assert.equal(resolution.snapReason, 'opening')
    assert.ok(
      resolution.placement.offset + moduleSpec.width <= 1.1 ||
        resolution.placement.offset >= 2.3,
    )
  })

  it('snaps neatly against adjacent modules on the same wall', () => {
    const scene = createBlankStudioScene('scene-drag-module-snap', 'Drag module snap')
    scene.modules = applyPresetLineaire(scene).modules.slice(0, 2)
    const moduleSpec = {
      ...scene.modules[1],
      id: 'moving-module',
      placement: { mode: 'wall' as const, wall: 'north' as const, offset: 1.31 },
    }
    scene.modules = [scene.modules[0], moduleSpec]

    const resolution = resolveDraggedPlacement(scene, moduleSpec, { x: 1.24, z: 0.2 })

    assert.equal(resolution.placement.mode, 'wall')
    assert.equal(resolution.placement.wall, 'north')
    assert.equal(resolution.snapReason, 'module')
    assert.equal(
      resolution.placement.offset,
      scene.modules[0].placement.mode === 'wall'
        ? scene.modules[0].placement.offset + scene.modules[0].width + MODULE_JOINT_GAP
        : 0,
    )
  })

  it('keeps an island in free placement and clamps it inside the room', () => {
    const scene = createBlankStudioScene('scene-drag-island', 'Drag island')
    const island = createDefaultStudioScene('scene-drag-island-seed', 'Seed').modules.find(
      (moduleSpec) => moduleSpec.kind === 'island',
    )

    assert.ok(island)
    const placement = deriveDraggedPlacement(scene, island!, { x: 9, z: 9 })

    assert.equal(placement.mode, 'free')
    assert.ok(Math.abs(placement.x) <= scene.room.width / 2 - island!.width / 2)
    assert.ok(Math.abs(placement.z) <= scene.room.depth / 2 - island!.depth / 2)
  })

  it('prevents collisions between free modules', () => {
    const scene = createBlankStudioScene('scene-drag-free-collision', 'Drag free collision')
    const templateIsland = createDefaultStudioScene('scene-drag-free-collision-seed', 'Seed').modules.find(
      (moduleSpec) => moduleSpec.kind === 'island',
    )

    assert.ok(templateIsland)
    const leftIsland = {
      ...templateIsland!,
      id: 'island-left',
      placement: { mode: 'free' as const, x: -0.7, z: 0, rotation: 0 },
    }
    const rightIsland = {
      ...templateIsland!,
      id: 'island-right',
      placement: { mode: 'free' as const, x: 0.7, z: 0, rotation: 0 },
    }
    scene.modules = [leftIsland, rightIsland]

    const resolution = resolveDraggedPlacement(scene, leftIsland, {
      x: scene.room.width / 2 + 0.55,
      z: scene.room.depth / 2,
    })

    assert.equal(resolution.placement.mode, 'free')
    assert.equal(resolution.snapReason, 'collision')

    const movedBounds = getModuleFootprintBounds(scene, leftIsland, resolution.placement)
    const otherBounds = getModuleFootprintBounds(scene, rightIsland)
    const overlapX =
      Math.min(movedBounds.maxX, otherBounds.maxX) - Math.max(movedBounds.minX, otherBounds.minX)
    const overlapZ =
      Math.min(movedBounds.maxZ, otherBounds.maxZ) - Math.max(movedBounds.minZ, otherBounds.minZ)

    assert.ok(overlapX <= 0 || overlapZ <= 0)
  })

  it('prevents collisions between a free module and wall modules', () => {
    const scene = createBlankStudioScene('scene-drag-free-vs-wall', 'Drag free vs wall')
    scene.modules = applyPresetLineaire(scene).modules
    const island = createDefaultStudioScene('scene-drag-free-vs-wall-seed', 'Seed').modules.find(
      (moduleSpec) => moduleSpec.kind === 'island',
    )

    assert.ok(island)
    const resolution = resolveDraggedPlacement(scene, island!, {
      x: 1.8,
      z: 0.4,
    })

    assert.equal(resolution.placement.mode, 'free')
    assert.equal(resolution.snapReason, 'collision')

    const islandBounds = getModuleFootprintBounds(scene, island!, resolution.placement)
    const wallModuleBounds = getModuleFootprintBounds(scene, scene.modules[0])
    const overlapX =
      Math.min(islandBounds.maxX, wallModuleBounds.maxX) - Math.max(islandBounds.minX, wallModuleBounds.minX)
    const overlapZ =
      Math.min(islandBounds.maxZ, wallModuleBounds.maxZ) - Math.max(islandBounds.minZ, wallModuleBounds.minZ)

    assert.ok(overlapX <= 0 || overlapZ <= 0)
  })

  it('builds a duplicated module with a non-overlapping placement', () => {
    const scene = createBlankStudioScene('scene-duplicate-module', 'Duplicate module')
    scene.modules = applyPresetLineaire(scene).modules.slice(0, 2)

    const duplicated = buildDuplicatedModule(scene, scene.modules[0])

    assert.notEqual(duplicated.id, scene.modules[0].id)
    assert.ok(duplicated.label.includes('copie'))
    assert.equal(duplicated.placement.mode, 'wall')
    assert.notEqual(
      duplicated.placement.mode === 'wall' ? duplicated.placement.offset : -1,
      scene.modules[0].placement.mode === 'wall' ? scene.modules[0].placement.offset : -1,
    )
  })

  it('drags an opening to the nearest wall with a coherent offset', () => {
    const scene = createBlankStudioScene('scene-drag-opening-wall', 'Drag opening wall')
    const opening = {
      id: 'opening-1',
      name: 'Fenetre',
      wall: 'north' as const,
      kind: 'window' as const,
      offset: 0.6,
      width: 1.2,
      height: 1.2,
      baseHeight: 0.9,
    }
    scene.openings = [opening]

    const resolution = resolveDraggedOpening(scene, opening, { x: 0.2, z: 2.1 })

    assert.equal(resolution.wall, 'west')
    assert.ok(resolution.offset >= 0)
    assert.ok(resolution.offset + opening.width <= scene.room.depth)
  })

  it('prevents dragged openings from overlapping other openings on the same wall', () => {
    const scene = createBlankStudioScene('scene-drag-opening-overlap', 'Drag opening overlap')
    const fixedOpening = {
      id: 'opening-1',
      name: 'Fenetre 1',
      wall: 'north' as const,
      kind: 'window' as const,
      offset: 0.8,
      width: 1.2,
      height: 1.2,
      baseHeight: 0.9,
    }
    const movingOpening = {
      id: 'opening-2',
      name: 'Fenetre 2',
      wall: 'north' as const,
      kind: 'window' as const,
      offset: 2.6,
      width: 1.1,
      height: 1.2,
      baseHeight: 0.9,
    }
    scene.openings = [fixedOpening, movingOpening]

    const resolution = resolveDraggedOpening(scene, movingOpening, { x: 1.4, z: 0.1 })

    assert.equal(resolution.wall, 'north')
    assert.ok(
      resolution.offset + movingOpening.width <= fixedOpening.offset ||
        resolution.offset >= fixedOpening.offset + fixedOpening.width,
    )
  })
})
