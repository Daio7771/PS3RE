# `npm run shortcut`: crea (o actualiza) el acceso directo "PS3 Reimagined" en
# el escritorio. Abre la app directamente, sin ventana de consola, y con
# --build recompila la interfaz al arrancar para que nunca quede desactualizada.
$root = Split-Path -Parent $PSScriptRoot
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$icon = Join-Path $root 'build\icon.ico'

if (-not (Test-Path $electron)) {
  Write-Error 'Falta Electron: ejecuta npm install primero.'
  exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
$path = Join-Path $desktop 'PS3 Reimagined.lnk'

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($path)
$link.TargetPath = $electron
$link.Arguments = "`"$root`" --build"
$link.WorkingDirectory = $root
if (Test-Path $icon) { $link.IconLocation = "$icon,0" }
$link.Description = 'PS3 Reimagined - el XMB para los juegos del PC'
$link.Save()

Write-Output "Acceso directo creado: $path"
