import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { compileStudioScene } from '../studio/compiler.ts'
import { getRenderAmbienceSettings, getRenderQualitySettings } from '../studio/render-presets.ts'
import type { BlenderRenderPackage, StudioProjectRecord } from '../studio/schema.ts'

const DATA_ROOT = process.env.STUDIO_DATA_DIR || path.join(process.cwd(), '.data', 'studio')
const BLENDER_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'blender', 'render_scene.py')

export function isBlenderConfigured(): boolean {
  return Boolean(process.env.BLENDER_PATH)
}

export function buildBlenderRenderPackage(project: StudioProjectRecord): BlenderRenderPackage {
  const quality = getRenderQualitySettings(project.scene.renderQualityPreset)
  const ambience = getRenderAmbienceSettings(project.scene.renderAmbiencePreset)

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      latestRevisionNumber: project.latestRevisionNumber,
    },
    scene: project.scene,
    compiled: compileStudioScene(project.scene),
    renderPreset: {
      engine: 'CYCLES',
      quality: project.scene.renderQualityPreset,
      ambience: project.scene.renderAmbiencePreset,
      output: {
        width: quality.width,
        height: quality.height,
        format: 'PNG',
        samples: quality.samples,
      },
      colorManagement: ambience.colorManagement,
      exposure: ambience.exposure,
      backgroundColor: ambience.backgroundColor,
      worldStrength: ambience.worldStrength,
      denoise: quality.denoise,
      adaptiveThreshold: quality.adaptiveThreshold,
      maxBounces: quality.maxBounces,
      diffuseBounces: quality.diffuseBounces,
      glossyBounces: quality.glossyBounces,
      transmissionBounces: quality.transmissionBounces,
      filterWidth: quality.filterWidth,
      bevelWidth: quality.bevelWidth,
      bevelSegments: quality.bevelSegments,
      lighting: {
        areaEnergyMultiplier: ambience.areaEnergyMultiplier,
        areaColor: ambience.areaColor,
        fillEnergy: ambience.fillEnergy,
        fillColor: ambience.fillColor,
        rimEnergy: ambience.rimEnergy,
        rimColor: ambience.rimColor,
        sunEnergy: ambience.sunEnergy,
        sunColor: ambience.sunColor,
      },
    },
  }
}

export async function writeBlenderRenderPackage(project: StudioProjectRecord): Promise<{
  filePath: string
  packageData: BlenderRenderPackage
}> {
  const packageData = buildBlenderRenderPackage(project)
  const outputDir = path.join(DATA_ROOT, 'blender-packages', project.id)
  await fs.mkdir(outputDir, { recursive: true })
  const filePath = path.join(outputDir, `rev-${project.latestRevisionNumber}.json`)
  await fs.writeFile(filePath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8')
  return { filePath, packageData }
}

export async function runBlenderRender(project: StudioProjectRecord): Promise<{
  packagePath: string
  outputDir: string
  exitCode: number
  stdout: string
  stderr: string
}> {
  const blenderPath = process.env.BLENDER_PATH
  if (!blenderPath) {
    throw new Error('BLENDER_PATH is not configured')
  }

  const { filePath } = await writeBlenderRenderPackage(project)
  const outputDir = path.join(DATA_ROOT, 'blender-renders', project.id, `rev-${project.latestRevisionNumber}`)
  await fs.mkdir(outputDir, { recursive: true })

  const child = spawn(
    blenderPath,
    ['-b', '-P', BLENDER_SCRIPT_PATH, '--', filePath, outputDir],
    { cwd: process.cwd() },
  )

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
  child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf8')
  const stderr = Buffer.concat(stderrChunks).toString('utf8')
  const finalImagePath = path.join(outputDir, 'final.png')
  const finalImageExists = await fs
    .access(finalImagePath)
    .then(() => true)
    .catch(() => false)

  if (exitCode !== 0 || !finalImageExists) {
    throw new Error(
      [
        `Blender render failed (exit ${exitCode})`,
        finalImageExists ? null : `Missing output image: ${finalImagePath}`,
        stderr ? `stderr: ${stderr}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return {
    packagePath: filePath,
    outputDir,
    exitCode,
    stdout,
    stderr,
  }
}
