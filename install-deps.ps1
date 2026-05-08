# install-deps.ps1
# Run this script after installing Node.js and npm.

$systemNpm = Get-Command npm -ErrorAction SilentlyContinue
if ($systemNpm) {
  Write-Host "시스템 npm을 사용하여 의존성을 설치합니다..."
  npm install
  exit $LASTEXITCODE
}

$portableNpm = Join-Path $PSScriptRoot 'node-v20.19.0-win-x64\npm.cmd'
if (Test-Path $portableNpm) {
  Write-Host "포터블 npm을 사용하여 의존성을 설치합니다..."
  & $portableNpm install
  exit $LASTEXITCODE
}

Write-Error "npm을 찾을 수 없습니다. 먼저 Node.js를 설치하거나 포터블 Node를 준비하세요."
exit 1
