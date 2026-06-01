<#
.SYNOPSIS
  Release de uma tacada: verificacao -> commit -> push -> deploy na Droplet.
  Roda a PARTIR da sua maquina (Windows) e mostra todo o processo ao vivo.

  Diferenca para scripts/deploy.sh:
    - scripts/deploy.sh  roda DENTRO da Droplet (git pull + build docker + up).
    - scripts/release.ps1 (este) roda na SUA maquina: valida, commita, faz push
      e dispara o `make deploy` na Droplet via SSH.

.EXAMPLE
  .\scripts\release.ps1 -Message "fix: ajuste no mapa"
.EXAMPLE
  # so re-deploy do que ja esta no main (sem commitar nada):
  .\scripts\release.ps1 -SkipCommit
.EXAMPLE
  # deploy + acompanhar os logs da API ao final:
  .\scripts\release.ps1 -Message "feat: x" -Logs
.EXAMPLE
  # rodar o build completo local (atencao: no Windows o passo final do Next
  # 'standalone' falha por symlink/EPERM -> use so se precisar, o build real e na Droplet):
  .\scripts\release.ps1 -Message "x" -FullBuild

.NOTES
  Pre-requisitos: pnpm, git e a chave SSH da Droplet ja configurados.
#>
param(
  [string]$Message,
  [switch]$FullBuild,
  [switch]$SkipVerify,
  [switch]$SkipCommit,
  [switch]$SkipDeploy,
  [switch]$Logs
)

$ErrorActionPreference = 'Stop'

# ============== CONFIG (ajuste se necessario) ==============
$Branch      = 'main'
$DropletHost = 'root@159.89.91.222'
$SshKey      = "$env:USERPROFILE\.ssh\beeeyes_digitalocean"
$RemoteDir   = '/opt/gestao-360-indicadores'
$ComposeFile = 'docker-compose.droplet.yml'
# ===========================================================

function Section($t) { Write-Host "`n========== $t ==========" -ForegroundColor Cyan }
function Ok($t)       { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)     { Write-Host "  [!] $t"  -ForegroundColor Yellow }
function Die($t)      { Write-Host "  [ERRO] $t" -ForegroundColor Red; exit 1 }

# Sempre rodar a partir da raiz do repositorio (este script fica em /scripts)
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "Repositorio: $(Get-Location)" -ForegroundColor DarkGray

# ---------- 1/4  Verificacao ----------
if (-not $SkipVerify) {
  if ($FullBuild) {
    Section "1/4  Build completo (pnpm build)"
    Warn "No Windows o passo final 'standalone' pode falhar por symlink (EPERM). O build real roda na Droplet (Docker/Linux)."
    pnpm build
    if ($LASTEXITCODE -ne 0) { Die "build falhou" }
  } else {
    Section "1/4  Verificacao (type-check API + Web)"
    Write-Host "-> API..." -ForegroundColor DarkGray
    pnpm -C apps/api exec tsc --noEmit -p tsconfig.json
    if ($LASTEXITCODE -ne 0) { Die "type-check da API falhou" }
    Write-Host "-> Web..." -ForegroundColor DarkGray
    pnpm -C apps/web exec tsc --noEmit
    if ($LASTEXITCODE -ne 0) { Die "type-check do Web falhou" }
  }
  Ok "verificacao passou"
} else {
  Section "1/4  Verificacao"
  Warn "pulada (-SkipVerify)"
}

# ---------- 2/4  Commit ----------
if (-not $SkipCommit) {
  Section "2/4  Commit"
  $changes = git status --porcelain
  if (-not $changes) {
    Warn "nada para commitar (working tree limpo)"
  } else {
    Write-Host "Alteracoes:" -ForegroundColor DarkGray
    git status --short
    if ([string]::IsNullOrWhiteSpace($Message)) {
      $Message = Read-Host "`nMensagem do commit"
      if ([string]::IsNullOrWhiteSpace($Message)) { Die "mensagem de commit vazia" }
    }
    git add -A
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Die "commit falhou" }
    Ok "commit criado"
  }
} else {
  Section "2/4  Commit"
  Warn "pulado (-SkipCommit)"
}

# ---------- 3/4  Push ----------
Section "3/4  Push (origin/$Branch)"
$cur = (git rev-parse --abbrev-ref HEAD).Trim()
if ($cur -ne $Branch) { Warn "branch atual e '$cur' (esperado '$Branch'). A Droplet faz pull de '$Branch'." }
git push origin $cur
if ($LASTEXITCODE -ne 0) { Die "push falhou" }
Ok "push concluido"

# ---------- 4/4  Deploy na Droplet ----------
if (-not $SkipDeploy) {
  Section "4/4  Deploy na Droplet ($DropletHost)"
  if (-not (Test-Path $SshKey)) { Die "chave SSH nao encontrada: $SshKey" }
  Write-Host "Conectando e rodando 'make deploy' (git pull + build docker + up + migrate)...`n" -ForegroundColor DarkGray
  ssh -i $SshKey -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new $DropletHost "cd $RemoteDir && make deploy"
  if ($LASTEXITCODE -ne 0) { Die "deploy falhou na Droplet" }
  Ok "deploy concluido"

  if ($Logs) {
    Section "Logs da API (Ctrl+C para sair)"
    ssh -i $SshKey -o BatchMode=yes $DropletHost "cd $RemoteDir && docker compose -f $ComposeFile logs -f --tail=50 api"
  } else {
    Write-Host "`nVer logs da API:" -ForegroundColor DarkGray
    Write-Host "  ssh -i `"$SshKey`" $DropletHost `"cd $RemoteDir && docker compose -f $ComposeFile logs -f api`"" -ForegroundColor DarkGray
  }
} else {
  Section "4/4  Deploy"
  Warn "pulado (-SkipDeploy)"
}

Write-Host "`n========== Release finalizado ==========" -ForegroundColor Green
