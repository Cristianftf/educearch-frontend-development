param(
  [ValidateSet('dev', 'prod')]
  [string]$Mode = 'dev',
  [switch]$WsThroughBackendTunnel
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = Join-Path $repoRoot 'backend'
$logDir = Join-Path $repoRoot '.tunnelmole-logs'

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$startedProcesses = @()

function Write-Step([string]$Message) {
  Write-Host "[tunnelmole] $Message"
}

function Test-TcpPortOpen([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(500)) {
      return $false
    }
    $client.EndConnect($result) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-Port([int]$Port, [string]$Name, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPortOpen -Port $Port) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Start-LoggedProcess([string]$Name, [string]$WorkingDirectory, [string]$Command) {
  $safeName = ($Name -replace '[^a-zA-Z0-9_-]', '_')
  $stdout = Join-Path $logDir "$safeName.stdout.log"
  $stderr = Join-Path $logDir "$safeName.stderr.log"

  if (Test-Path $stdout) { Remove-Item $stdout -Force }
  if (Test-Path $stderr) { Remove-Item $stderr -Force }

  $process = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList "/c $Command" `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  $info = [PSCustomObject]@{
    Name    = $Name
    Command = $Command
    Process = $process
    Stdout  = $stdout
    Stderr  = $stderr
  }

  $script:startedProcesses += $info
  return $info
}

function Wait-TunnelUrl([string]$LogPath, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $pattern = 'https://[a-zA-Z0-9-]+\.tunnelmole\.(net|com)'

  while ((Get-Date) -lt $deadline) {
    if (Test-Path $LogPath) {
      $content = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue
      if ($content) {
        $match = [regex]::Match($content, $pattern)
        if ($match.Success) {
          return $match.Value
        }
      }
    }
    Start-Sleep -Seconds 1
  }

  return $null
}

function Stop-StartedProcesses {
  foreach ($procInfo in $script:startedProcesses) {
    try {
      if ($procInfo.Process -and -not $procInfo.Process.HasExited) {
        Stop-Process -Id $procInfo.Process.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {
      # Ignore cleanup failures.
    }
  }
}

try {
  Write-Step "Repositorio: $repoRoot"
  Write-Step "Modo frontend: $Mode"
  Write-Step "Logs: $logDir"

  $backendRunning = Test-TcpPortOpen -Port 8080
  if ($backendRunning) {
    Write-Step 'Backend ya responde en puerto 8080. Se usa proceso existente.'
  } else {
    Write-Step 'Iniciando backend (mvn spring-boot:run)...'
    $backendProcess = Start-LoggedProcess -Name 'backend' -WorkingDirectory $backendRoot -Command 'mvn spring-boot:run'
    if (-not (Wait-Port -Port 8080 -Name 'backend' -TimeoutSeconds 180)) {
      throw "Backend no quedo disponible en puerto 8080. Revisa: $($backendProcess.Stderr)"
    }
    Write-Step 'Backend listo en http://localhost:8080'
  }

  $backendWsUrl = $null
  $backendTunnelUrl = $null
  if ($WsThroughBackendTunnel) {
    Write-Step 'Iniciando tunnelmole para backend (puerto 8080)...'
    $backendTunnel = Start-LoggedProcess -Name 'tmole-backend' -WorkingDirectory $repoRoot -Command 'npm run share:backend'
    $backendTunnelUrl = Wait-TunnelUrl -LogPath $backendTunnel.Stdout -TimeoutSeconds 90
    if (-not $backendTunnelUrl) {
      throw "No se detecto URL de backend tunnelmole. Revisa: $($backendTunnel.Stdout)"
    }

    $backendWsUrl = $backendTunnelUrl -replace '^http://', 'ws://' -replace '^https://', 'wss://'
    $backendWsUrl = "$($backendWsUrl.TrimEnd('/'))/ws-native"
    Write-Step "Backend tunnel URL: $backendTunnelUrl"
    Write-Step "NEXT_PUBLIC_WS_URL dinamico: $backendWsUrl"
  }

  $frontendRunning = Test-TcpPortOpen -Port 3000
  if ($frontendRunning) {
    Write-Step 'Frontend ya responde en puerto 3000. Se usa proceso existente.'
    if ($WsThroughBackendTunnel) {
      Write-Step 'Aviso: NEXT_PUBLIC_WS_URL no se inyecto porque frontend ya estaba levantado.'
    }
  } else {
    if ($Mode -eq 'prod') {
      Write-Step 'Construyendo frontend (npm run build)...'
      Push-Location $repoRoot
      try {
        cmd /c npm run build
        if ($LASTEXITCODE -ne 0) {
          throw 'Fallo npm run build.'
        }
      } finally {
        Pop-Location
      }
    }

    $frontendCommand = if ($Mode -eq 'prod') { 'npm run start:public' } else { 'npm run dev:public' }
    if ($backendWsUrl) {
      $frontendCommand = "set NEXT_PUBLIC_WS_URL=$backendWsUrl && $frontendCommand"
    }

    Write-Step "Iniciando frontend ($frontendCommand)..."
    $frontendProcess = Start-LoggedProcess -Name "frontend-$Mode" -WorkingDirectory $repoRoot -Command $frontendCommand

    if (-not (Wait-Port -Port 3000 -Name 'frontend' -TimeoutSeconds 120)) {
      throw "Frontend no quedo disponible en puerto 3000. Revisa: $($frontendProcess.Stderr)"
    }
    Write-Step 'Frontend listo en http://localhost:3000'
  }

  Write-Step 'Iniciando tunnelmole para frontend (puerto 3000)...'
  $frontendTunnel = Start-LoggedProcess -Name 'tmole-frontend' -WorkingDirectory $repoRoot -Command 'npm run share:frontend'
  $frontendTunnelUrl = Wait-TunnelUrl -LogPath $frontendTunnel.Stdout -TimeoutSeconds 90
  if (-not $frontendTunnelUrl) {
    throw "No se detecto URL de frontend tunnelmole. Revisa: $($frontendTunnel.Stdout)"
  }

  Write-Host ''
  Write-Host '==============================================='
  Write-Host 'STACK COMPARTIDO CON TUNNELMOLE'
  Write-Host '==============================================='
  Write-Host "Frontend publico: $frontendTunnelUrl"
  if ($backendTunnelUrl) {
    Write-Host "Backend publico:  $backendTunnelUrl"
    Write-Host "WS inyectado:     $backendWsUrl"
  }
  Write-Host ''
  Write-Host "Logs backend/frontend/tuneles: $logDir"
  Write-Host 'Para detener todo: cierra los procesos cmd.exe / node.exe / java.exe iniciados por este script.'
  Write-Host '==============================================='
} catch {
  Write-Host ''
  Write-Host "[tunnelmole] ERROR: $($_.Exception.Message)"
  Stop-StartedProcesses
  exit 1
}
