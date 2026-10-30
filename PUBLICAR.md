# Publicar Army's Vinyl en Google Play y App Store

Las apps se compilan en los servidores de GitHub (GitHub Actions), así que **no necesitas Mac ni Android Studio**.
Cada vez que haces *Push* en GitHub Desktop, se compilan solas. Los resultados se ven en
GitHub → repositorio → pestaña **Actions**.

---

## 0. Antes de empezar (una vez)

| Qué | Coste | Notas |
|---|---|---|
| Cuenta de **Google Play Console** | 25 USD, un solo pago | Cuentas personales nuevas: hay que hacer una **prueba cerrada con 12 personas durante 14 días** antes de publicar. |
| **Apple Developer Program** | 99 USD al año | Como persona física no hace falta número D-U-N-S. |

**Clave de YouTube:** en Google Cloud → Credenciales → tu clave → *Restricciones de aplicaciones → Sitios web*, añade:
- `https://diegxadf.github.io/*` (la web)
- `https://localhost/*` (la app de Android)
- `capacitor://localhost/*` (la app de iOS)

**Cupo de YouTube:** el cupo gratis (unas 100 canciones nuevas al día) es **compartido por todos los usuarios**.
Antes de publicar pide más cupo en el formulario
[YouTube API Services – Audit and Quota Extension](https://support.google.com/youtube/contact/yt_api_form).
Te pedirán la política de privacidad: `https://diegxadf.github.io/bts_vinyl/privacidad.html`.

---

## 1. Android (Google Play)

### 1.1 Probar la app en tu tablet (sin cuenta)
1. Haz Push en GitHub Desktop.
2. GitHub → **Actions** → *Android* → la última ejecución en verde → abajo, **Artifacts** → descarga `armys-vinyl-prueba-apk`.
3. Descomprime y pasa el `.apk` a la tablet. Ábrelo y permite *instalar apps de origen desconocido*.

### 1.2 Crear la llave de firma (una sola vez)
1. En PowerShell, dentro de la carpeta del proyecto: `.\tools\crear-llave-android.ps1`
2. Elige una contraseña y **guárdala junto con el archivo** `Documents\armys-vinyl-upload.keystore`.
   Si los pierdes, no podrás actualizar la app.
3. En GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `ANDROID_KEYSTORE_BASE64` → pega lo que dejó el script en el portapapeles
   - `ANDROID_KEYSTORE_PASSWORD` → tu contraseña
   - `ANDROID_KEY_ALIAS` → `upload`
   - `ANDROID_KEY_PASSWORD` → la misma contraseña
4. Haz Push (o en Actions → *Android* → **Run workflow**). Ahora también saldrá `armys-vinyl-google-play-aab`.

### 1.3 Subirla a Google Play
1. Play Console → **Crear app** → nombre *Army's Vinyl*, app, gratis.
2. **Prueba interna**: sube el `.aab`. Acepta *Play App Signing*.
3. Rellena: **Seguridad de los datos** (no se recogen datos), **Clasificación de contenido**, **Público objetivo**, **Política de privacidad** (la URL de arriba).
4. **Prueba cerrada** con 12 personas durante 14 días y, después, **Producción**.

---

## 2. iOS (App Store), sin Mac

1. En [developer.apple.com](https://developer.apple.com/account) → *Certificates, IDs & Profiles* → **Identifiers** → registra el ID `io.github.diegxadf.armysvinyl`.
2. En [App Store Connect](https://appstoreconnect.apple.com) → **Apps → Nueva app** con ese ID, nombre *Army's Vinyl*.
3. App Store Connect → **Usuarios y acceso → Integraciones → App Store Connect API** → nueva clave con rol **App Manager**. Descarga el `.p8` (solo se puede una vez).
4. Crea estos secrets en GitHub:
   - `ASC_KEY_ID` → el *Key ID*
   - `ASC_ISSUER_ID` → el *Issuer ID* (arriba de la lista de claves)
   - `ASC_KEY_P8_BASE64` → en PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta\AuthKey_XXXX.p8")) | Set-Clipboard` y pégalo
   - `APPLE_TEAM_ID` → developer.apple.com → *Membership details* → Team ID
5. Haz Push o lanza *Actions → iOS → Run workflow*. La app se firma y se sube sola a App Store Connect.
6. Pruébala en tu iPhone/iPad con **TestFlight** y luego envíala a revisión.

---

## 3. Para que no la rechacen

- **Descripción:** empieza aclarando *"App de fans no oficial. No está afiliada a BTS, BIGHIT MUSIC ni HYBE."*
- **Capturas de pantalla:** no uses portadas, fotos ni logos oficiales de BTS. Crea álbumes de ejemplo con portadas genéricas (Editar → *Usar portada genérica*).
- **No digas** que reproduce música "gratis" ni "descarga canciones": reproduce avances de Apple y el reproductor oficial de YouTube.
- **Revisar en TestFlight** que los videos de YouTube se reproducen dentro de la app de iOS. Si salen errores 152/153, avisa: hay una solución (reproductor alojado en la web).

---

## Archivos del proyecto relacionados

- `capacitor.config.json` — nombre e ID de la app
- `android/`, `ios/` — proyectos nativos generados por Capacitor
- `.github/workflows/android.yml`, `ios.yml` — compilación en la nube
- `assets/` — originales del icono y la pantalla de inicio (`npm run icons` y `npx @capacitor/assets generate`)
- `tools/build-www.mjs` — copia la app web a `www/` antes de compilar
- `privacidad.html` — política de privacidad (se publica con GitHub Pages)
