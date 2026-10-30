# Crea (una sola vez) la llave con la que se firma la app para Google Play
# y deja en el portapapeles su contenido en base64, listo para pegarlo como secret en GitHub.
#
# Uso (en PowerShell, desde la carpeta del proyecto):   .\tools\crear-llave-android.ps1
#
# IMPORTANTE: guarda el archivo .keystore y la contraseña en un lugar seguro (p. ej. un gestor de contraseñas).
# Si se pierden, no podrás publicar actualizaciones de la app con la misma llave.

$keytool = Get-ChildItem "C:\Program Files\Java\*\bin\keytool.exe", "C:\Program Files\Eclipse Adoptium\*\bin\keytool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $keytool) { Write-Host "No encuentro keytool. Instala un JDK (por ejemplo Temurin 21) y vuelve a intentarlo."; exit 1 }

$out = Join-Path $env:USERPROFILE "Documents\armys-vinyl-upload.keystore"
if (Test-Path $out) { Write-Host "Ya existe $out. No la sobrescribo."; exit 1 }

Write-Host "Te pedirá una contraseña (mínimo 6 caracteres). Apúntala: la necesitarás en GitHub."
& $keytool.FullName -genkeypair -v -storetype PKCS12 -keystore $out -alias upload -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Army's Vinyl"
if (-not (Test-Path $out)) { Write-Host "No se creó la llave."; exit 1 }

[Convert]::ToBase64String([IO.File]::ReadAllBytes($out)) | Set-Clipboard
Write-Host ""
Write-Host "Llave creada en: $out"
Write-Host "Su contenido en base64 ya está en el portapapeles: pégalo en GitHub como ANDROID_KEYSTORE_BASE64."
Write-Host "Alias de la llave: upload"
