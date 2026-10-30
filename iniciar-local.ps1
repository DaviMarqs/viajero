$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$logs = Join-Path $root '.local'
$node = (Get-Command node -ErrorAction Stop).Source
$python = Join-Path $root 'backend/.venv/Scripts/python.exe'

if (!(Test-Path -LiteralPath $python)) {
    throw 'Python local ausente. Execute uv sync na pasta backend primeiro.'
}
foreach ($folder in @('backend-nest', 'front')) {
    if (!(Test-Path -LiteralPath (Join-Path $root "$folder/node_modules"))) {
        throw "Dependencias ausentes. Execute npm ci na pasta $folder primeiro."
    }
}
foreach ($file in @('backend/.env', 'backend-nest/.env')) {
    if (!(Test-Path -LiteralPath (Join-Path $root $file))) {
        throw "Configure $file conforme RODAR_LOCALMENTE.md."
    }
}

# Django gerencia o schema; o Nest usa as mesmas tabelas.
Push-Location (Join-Path $root 'backend')
try {
    & $python manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw 'Falha nas migrations. Verifique PostgreSQL e DATABASE_URL.' }
} finally { Pop-Location }

New-Item -ItemType Directory -Path $logs -Force | Out-Null

function Start-LocalServer($name, $folder, $arguments, $url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "$name ja esta respondendo: $url"
            return
        }
    } catch { }

    $process = Start-Process -FilePath $node -ArgumentList $arguments `
        -WorkingDirectory (Join-Path $root $folder) -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logs "$name.log") `
        -RedirectStandardError (Join-Path $logs "$name.error.log")
    $process.Id | Set-Content (Join-Path $logs "$name.pid")

    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        if ($process.HasExited) { throw "$name encerrou. Consulte .local/$name.error.log e .local/$name.log." }
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "$name pronto: $url"
                return
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    throw "$name nao respondeu. Consulte os logs em .local/."
}

Start-LocalServer 'api' 'backend-nest' @('node_modules/@nestjs/cli/bin/nest.js', 'start', '--watch') 'http://127.0.0.1:8001/api/destinations/'
Start-LocalServer 'front' 'front' @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') 'http://127.0.0.1:5173'
Write-Host 'Abra http://localhost:5173. Servicos em segundo plano com recarga automatica; logs em .local/.'
