# ============================================================
# BP Cuisine Render Studio — Manual Integration Test
# ============================================================
# Prerequisites:
#   1. npm run dev is running on http://localhost:3000
#   2. .env.local has valid SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REPLICATE_API_TOKEN
#   3. scripts/migrate.sql has been run in Supabase
#   4. Two test images exist at the paths below (change them to real files)
# ============================================================

$BASE_URL   = "http://localhost:3000"
$ROOM_IMG   = "C:\Users\alexh\Documents\bp-cuisine-render-app\scripts\test-room.jpg"
$SKETCH_IMG = "C:\Users\alexh\Documents\bp-cuisine-render-app\scripts\test-sketch.jpg"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

function Write-OK($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-FAIL($msg) { Write-Host "    FAIL $msg" -ForegroundColor Red }
function Write-INFO($msg) { Write-Host "    ...  $msg" -ForegroundColor Gray }

# ── Check test images exist ────────────────────────────────────────────────────
Write-Step 0 "Checking test images"
if (-not (Test-Path $ROOM_IMG)) {
    Write-FAIL "Room image not found: $ROOM_IMG"
    Write-Host "    Create a small JPG/PNG at that path (any photo works for testing)." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path $SKETCH_IMG)) {
    Write-FAIL "Sketch image not found: $SKETCH_IMG"
    Write-Host "    Create a small JPG/PNG at that path (any photo works for testing)." -ForegroundColor Yellow
    exit 1
}
Write-OK "Both test images found"

# ── Step 1: POST /api/render/start ────────────────────────────────────────────
Write-Step 1 "POST $BASE_URL/api/render/start"

$startResponse = curl.exe `
    --silent `
    --show-error `
    --write-out "`n__HTTP_STATUS__%{http_code}" `
    --request POST `
    "$BASE_URL/api/render/start" `
    --form "room=@$ROOM_IMG;type=image/jpeg" `
    --form "sketch=@$SKETCH_IMG;type=image/jpeg" `
    --form "prompt=Cuisine moderne ouverte sur salon" `
    --form "style=moderne" `
    --form "dimensions={`"width`":4,`"depth`":3,`"height`":2.6}" `
    --form "materials={`"description`":`"laque blanche mat, plan de travail granit noir`"}"

# Split body and status code
$lines      = $startResponse -split "`n"
$statusLine = $lines | Where-Object { $_ -like "__HTTP_STATUS__*" }
$httpCode   = $statusLine -replace "__HTTP_STATUS__", ""
$body       = ($lines | Where-Object { $_ -notlike "__HTTP_STATUS__*" }) -join "`n"

Write-INFO "HTTP $httpCode"
Write-INFO "Body: $body"

if ($httpCode -ne "202") {
    Write-FAIL "Expected HTTP 202, got $httpCode"
    exit 1
}

# Parse job ID
try {
    $json  = $body | ConvertFrom-Json
    $jobId = $json.id
} catch {
    Write-FAIL "Could not parse JSON response: $body"
    exit 1
}

if (-not $jobId) {
    Write-FAIL "Response missing 'id' field: $body"
    exit 1
}

Write-OK "Job started — ID: $jobId"
Write-OK "Status: $($json.status)"
Write-OK "PollUrl: $($json.pollUrl)"

# ── Step 2: Poll until terminal ───────────────────────────────────────────────
Write-Step 2 "Polling $BASE_URL/api/render/status?id=$jobId"
Write-INFO "Polling every 5 seconds (Ctrl+C to abort)"

$maxPolls    = 120   # 10 minutes max
$pollCount   = 0
$finalStatus = $null

while ($pollCount -lt $maxPolls) {
    Start-Sleep -Seconds 5
    $pollCount++

    $pollResponse = curl.exe `
        --silent `
        --show-error `
        --write-out "`n__HTTP_STATUS__%{http_code}" `
        "$BASE_URL/api/render/status?id=$jobId"

    $pLines      = $pollResponse -split "`n"
    $pStatusLine = $pLines | Where-Object { $_ -like "__HTTP_STATUS__*" }
    $pHttpCode   = $pStatusLine -replace "__HTTP_STATUS__", ""
    $pBody       = ($pLines | Where-Object { $_ -notlike "__HTTP_STATUS__*" }) -join "`n"

    try {
        $pJson  = $pBody | ConvertFrom-Json
        $status = $pJson.status
    } catch {
        Write-INFO "Poll $pollCount — could not parse: $pBody"
        continue
    }

    Write-INFO "Poll $pollCount — HTTP $pHttpCode — status: $status"

    if ($status -eq "succeeded") {
        $finalStatus = "succeeded"
        Write-OK "Render succeeded!"
        Write-OK "outputUrl: $($pJson.outputUrl)"
        break
    }

    if ($status -eq "failed") {
        $finalStatus = "failed"
        Write-FAIL "Render failed: $($pJson.error)"
        break
    }
}

if (-not $finalStatus) {
    Write-FAIL "Timed out after $($maxPolls * 5) seconds"
    exit 1
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
if ($finalStatus -eq "succeeded") {
    Write-Host "  TEST PASSED" -ForegroundColor Green
    Write-Host "  Job ID   : $jobId"
    Write-Host "  OutputURL: $($pJson.outputUrl)"
    Write-Host ""
    Write-Host "  Open in browser:" -ForegroundColor Yellow
    Write-Host "  $BASE_URL/result/$jobId"
} else {
    Write-Host "  TEST FAILED" -ForegroundColor Red
    Write-Host "  Job ID : $jobId"
    Write-Host "  Error  : $($pJson.error)"
}
Write-Host "============================================================" -ForegroundColor Cyan
