$ErrorActionPreference = "Stop"
$venvPython = "C:\Users\julius daclan jr\Documents\my-cool-project\.venv\Scripts\python.exe"
$ruff = "C:\Users\julius daclan jr\Documents\my-cool-project\.venv\Scripts\ruff.exe"
$mypy = "C:\Users\julius daclan jr\Documents\my-cool-project\.venv\Scripts\mypy.exe"
$proj = "C:\Users\julius daclan jr\Documents\my-cool-project"

Write-Host "=== Python Tests ==="
& $venvPython -m pytest "$proj/tests" -q
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Ruff Lint ==="
& $ruff check "$proj"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Mypy ==="
& $mypy "$proj/hello.py" "$proj/main.py" "$proj/tests/"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Node Tests ==="
Push-Location "$proj/dashboard"
npm test -- --silent
$nodeExit = $LASTEXITCODE
Pop-Location
exit $nodeExit
