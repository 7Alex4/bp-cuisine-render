param(
  [int]$Port = 3102,
  [switch]$UseExistingServer
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$proc = $null

function Wait-ForServer {
  param(
    [string]$Url,
    [int]$Attempts = 40
  )

  for ($i = 0; $i -lt $Attempts; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $resp = Invoke-WebRequest -UseBasicParsing $Url
      if ($resp.StatusCode -eq 200) {
        return
      }
    } catch {
    }
  }

  throw "Server did not become ready on $Url"
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Body = ''
  )

  $tempFile = New-TemporaryFile
  try {
    $args = @('-sS', '-L', '--max-time', '30', '-o', $tempFile.FullName, '-w', '%{http_code}', '-X', $Method)
    if ($Body) {
      $args += @('-H', 'Content-Type: application/json', '--data-raw', $Body)
    }
    $args += @('--url', $Url)

    $status = & curl.exe @args
    $content = Get-Content $tempFile.FullName -Raw

    return [pscustomobject]@{
      StatusCode = [int]$status
      Body = $content
      Json = if ($content) { $content | ConvertFrom-Json } else { $null }
    }
  } finally {
    Remove-Item $tempFile.FullName -Force -ErrorAction SilentlyContinue
  }
}

try {
  if (-not $UseExistingServer) {
    $nextBin = Join-Path $root 'node_modules\next\dist\bin\next'
    $proc = Start-Process -FilePath 'node.exe' -ArgumentList $nextBin, 'start', '-p', $Port -WorkingDirectory $root -PassThru
  }
  Wait-ForServer -Url "http://127.0.0.1:$Port/studio"
  Write-Host "Server ready on port $Port"

  $projectResponse = Invoke-JsonRequest `
    -Method 'POST' `
    -Url "http://127.0.0.1:$Port/api/studio/projects" `
    -Body (@{ name = 'Validation studio end-to-end' } | ConvertTo-Json -Compress)
  Write-Host "Project created"

  $project = $projectResponse.Json.project
  $projectId = $project.id
  $projectBaseUrl = "http://127.0.0.1:$Port/api/studio/projects/$projectId/"
  $fetched = (Invoke-JsonRequest -Method 'GET' -Url $projectBaseUrl).Json.project
  Write-Host "Project fetched"

  $scene = $fetched.scene
  $scene.room.width = 6200
  $scene.room.depth = 4200
  $scene.cameraMatch.position.x = 2.4
  $scene.cameraMatch.position.y = 1.72
  $scene.cameraMatch.position.z = 6.8

  $saved = (Invoke-JsonRequest `
    -Method 'PUT' `
    -Url $projectBaseUrl `
    -Body (@{
      name = $fetched.name
      scene = $scene
    } | ConvertTo-Json -Depth 20 -Compress)).Json.project
  Write-Host "Project saved"

  $compiled = (Invoke-JsonRequest -Method 'POST' -Url "${projectBaseUrl}compile/").Json
  Write-Host "Scene compiled"
  $packageResponse = Invoke-JsonRequest -Method 'POST' -Url "${projectBaseUrl}render-package/"
  $package = $packageResponse.Json
  Write-Host "Render package generated"

  $renderResponse = Invoke-JsonRequest -Method 'POST' -Url "${projectBaseUrl}render/"
  $renderStatus = $renderResponse.StatusCode
  $renderPayload = $renderResponse.Body
  Write-Host "Render endpoint returned"

  [pscustomobject]@{
    projectId = $projectId
    createStatus = $projectResponse.StatusCode
    fetchedProject = [bool]$fetched.id
    latestRevision = $saved.latestRevisionNumber
    compiledMeshCount = $compiled.compiled.meshes.Count
    compiledWarningCount = $compiled.compiled.warnings.Count
    packageStatus = $packageResponse.StatusCode
    packageGenerated = [bool]$package.packagePath
    packageExists = Test-Path $package.packagePath
    blenderConfigured = $package.blenderConfigured
    renderStatus = $renderStatus
    renderPayload = $renderPayload
  } | ConvertTo-Json -Depth 10
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
