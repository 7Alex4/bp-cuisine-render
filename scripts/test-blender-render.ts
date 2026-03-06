import path from 'node:path'
import { createStudioProject } from '../lib/server/studio-repository.ts'
import { runBlenderRender } from '../lib/server/blender.ts'

async function main() {
  process.env.BLENDER_PATH ||= 'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe'

  const project = await createStudioProject({ name: 'Validation Blender Local' })
  const result = await runBlenderRender(project)
  const finalImagePath = path.join(result.outputDir, 'final.png')

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        exitCode: result.exitCode,
        outputDir: result.outputDir,
        finalImagePath,
        stdoutSnippet: result.stdout.slice(0, 500),
        stderrSnippet: result.stderr.slice(0, 500),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
