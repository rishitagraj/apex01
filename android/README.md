# Apex01 Android App (WebView Wrapper)

Native Android application (Kotlin) that wraps the existing **Apex01** website in a full-screen `WebView`, with no browser address bar/toolbar/URL UI. The website remains hosted on **Vercel** and **Microtalk/MiroTalk** remains hosted on **Render**.

## Configuration (no placeholders)

| Setting | Value |
|---|---|
| Main website (Vercel) | `https://apex01.vercel.app` |
| Microtalk/MiroTalk (Render) | `https://p2p-latest-ajnb.onrender.com` (host: `p2p-latest-ajnb.onrender.com`) |
| Supabase host (auth) | `bfuqwrjoohyhsexvmnib.supabase.co` |
| App name | Apex01 |
| Package ID | `com.apex01.app` |
| Min SDK | 24 (Android 7.0) |
| Target/Compile SDK | 35 |

These are set in `app/build.gradle.kts` (`BuildConfig.MAIN_URL`, `BuildConfig.ALLOWED_HOSTS`). Only change them if your deployment URLs change.

## Project structure

```
android/
  app/
    src/main/
      AndroidManifest.xml
      java/com/apex01/app/MainActivity.kt
      res/ (layouts, drawables, mipmap icons, values, xml configs)
    build.gradle.kts
    proguard-rules.pro
  build.gradle.kts
  settings.gradle.kts
  gradle.properties
  gradle/wrapper/gradle-wrapper.properties
  keystore.properties.template
  README.md
```

## Features implemented

- **Full-screen WebView** with no Chrome address bar, browser toolbar, or visible URL.
- **Native splash screen** (Android 12+ SplashScreen API) and custom adaptive app icon.
- **Navigation**: internal/allowlisted links open inside the WebView; external links open outside the app UI (Custom Tabs/system browser). `target="_blank"`/new windows are handled without showing a URL in the app.
- **Android back button** uses WebView history; at root it requires a second press to exit (prevents accidental exits). Fullscreen/custom views are exited first.
- **Microtalk/MiroTalk** stays embedded via the existing website integration (iframe) and Render deployment. Camera/microphone runtime permissions and WebView permission grants are handled for trusted origins; WebRTC/media playback settings are enabled. Fullscreen video is supported.
- **WebViewClient + WebChromeClient** implemented.
- **JavaScript and DOM storage** enabled (required by the website).
- **File uploads** via `onShowFileChooser`.
- **Downloads** via `DownloadManager` (with legacy storage permission on API ≤ 28). Downloaded files (including PDFs) can be opened from notifications/device downloads.
- **Connectivity handling** with loading progress, error screen, and retry.
- **HTTPS-only** navigation (`usesCleartextTraffic=false`, network security config, and URL checks). **SSL errors are never bypassed**.
- **Domain allowlist** for in-app navigation: `apex01.vercel.app`, `p2p-latest-ajnb.onrender.com`, `bfuqwrjoohyhsexvmnib.supabase.co`, and required auth subdomains (including Google/Supabase auth hosts) so existing authentication flows continue to work. No unnecessary native JavaScript interfaces are exposed.
- **Release hardening**: WebView debugging disabled in release builds; no secrets/API keys hardcoded.

> **Security note:** URLs are not visible in the application interface, but they are **not hidden from network inspection** (device network logs, proxies, carrier/network-level tooling, or rooted-device inspection). Do not treat this wrapper as network-level obfuscation.

## Prerequisites

- **Android Studio** (latest stable recommended) with Android SDK Platform 35 and Build Tools.
- **JDK 17** (Android Studio bundled JBR works).
- Internet access for Gradle dependency downloads on first build.

## Build and run (Android Studio)

1. Open Android Studio → **Open** → select the `android/` folder.
2. If prompted, let Android Studio **sync Gradle**. If it asks to generate/use a Gradle wrapper, accept it (the project includes `gradle/wrapper/gradle-wrapper.properties`; `gradle-wrapper.jar` may be generated locally and is gitignored).
3. Wait for sync to complete.
4. Connect an Android device (USB debugging enabled) or start an emulator.
5. Click **Run** (▶) to install the debug build.

## Build a debug APK (command line)

If `gradle-wrapper.jar` exists (after Android Studio sync or `gradle wrapper`):

```bash
cd android
# Windows
gradlew.bat :app:assembleDebug
# macOS/Linux
./gradlew :app:assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

If the wrapper JAR is missing, open the project in Android Studio once to generate it, or run `gradle wrapper` using a system Gradle installation.

## Build a signed release APK / AAB

1. **Create a keystore** (keep it private; do not commit it):

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore android/release.keystore -alias apex01 -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Create `android/keystore.properties`** from the template (do not commit):

   ```bash
   cp android/keystore.properties.template android/keystore.properties
   ```

   Fill in `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`.

3. **Build**:

   ```bash
   cd android
   # Release APK
   gradlew.bat :app:assembleRelease   # Windows
   ./gradlew :app:assembleRelease     # macOS/Linux

   # Release AAB (Play Store)
   gradlew.bat :app:bundleRelease     # Windows
   ./gradlew :app:bundleRelease       # macOS/Linux
   ```

   Outputs:
   - APK: `android/app/build/outputs/apk/release/app-release.apk`
   - AAB: `android/app/build/outputs/bundle/release/app-release.aab`

If `keystore.properties` is not present, the release build type still compiles but won’t apply the release signing config; Android Studio can also sign via **Build → Generate Signed Bundle / APK**.

## Install APK on an Android device

1. Enable **Install unknown apps** for your file manager/browser (or use `adb`).
2. Transfer `app-debug.apk` or `app-release.apk` to the device.
3. Open it and install.

Using `adb`:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Testing checklist

- [ ] App launches to splash screen, then loads `https://apex01.vercel.app` with no URL bar.
- [ ] Internal navigation stays inside the WebView; back button navigates history; double-back exits at root.
- [ ] Login/auth flows work (Supabase). Google OAuth behavior depends on provider/WebView constraints—verify on your accounts.
- [ ] Focus rooms: MiroTalk iframe loads (Render may cold-start). Grant camera/mic permissions when prompted.
- [ ] WebRTC audio/video works between participants (test with two devices/browsers).
- [ ] Fullscreen video works.
- [ ] File uploads work.
- [ ] PDF/file downloads work and can be opened.
- [ ] External/untrusted links open outside the app UI.
- [ ] Offline/error state shows retry screen.
- [ ] HTTPS-only: `http://` navigation is blocked.

## Notes on existing deployments

- **Vercel** (main website) and **Render** (Microtalk/MiroTalk) are not migrated or reconfigured by this Android project. The app consumes the existing deployed services.
- If the MiroTalk Render instance is sleeping (free tier), the website already shows retry/wake-up behavior; the WebView preserves that functionality.
