import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const androidDir = process.env.ANDROID_DIR
  ? path.resolve(process.env.ANDROID_DIR)
  : path.join(rootDir, 'android');

const pkgJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
);
const version = (pkgJson?.version ?? '0.1.0').trim();
const parsedRun = Number.parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
const runNum = Number.isFinite(parsedRun) && parsedRun >= 1 ? parsedRun : 1;

function findFileRecursive(dir, targetName) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFileRecursive(fullPath, targetName);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === targetName) {
      return fullPath;
    }
  }
  return null;
}

if (!fs.existsSync(androidDir)) {
  throw new Error(`Android directory not found: ${androidDir}`);
}

const iconsDir = path.join(rootDir, 'public', 'icons');
const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');

if (!fs.existsSync(resDir)) {
  throw new Error(`Android res directory not found: ${resDir}`);
}

// 1. Copy PNG app icons & generate adaptive icon XMLs
const resEntries = fs.readdirSync(resDir, { withFileTypes: true });
for (const entry of resEntries) {
  if (!entry.isDirectory()) continue;
  if (/^mipmap-.*dpi$/.test(entry.name)) {
    const dpiDir = path.join(resDir, entry.name);
    const stdIconName =
      entry.name === 'mipmap-mdpi' || entry.name === 'mipmap-hdpi'
        ? 'icon-192.png'
        : 'icon-512.png';
    const stdIconSrc = path.join(iconsDir, stdIconName);
    const maskableSrc = path.join(iconsDir, 'icon-maskable-512.png');

    fs.copyFileSync(stdIconSrc, path.join(dpiDir, 'ic_launcher.png'));
    fs.copyFileSync(stdIconSrc, path.join(dpiDir, 'ic_launcher_round.png'));
    fs.copyFileSync(maskableSrc, path.join(dpiDir, 'ic_launcher_foreground.png'));
  }
}

const drawableDir = path.join(resDir, 'drawable');
fs.mkdirSync(drawableDir, { recursive: true });
fs.writeFileSync(
  path.join(drawableDir, 'ic_launcher_bg_solid.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#110A06"/>
</shape>
`,
  'utf8'
);

const anyDpiDir = path.join(resDir, 'mipmap-anydpi-v26');
if (fs.existsSync(anyDpiDir)) {
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@drawable/ic_launcher_bg_solid"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');
}

// 2. Lock orientation to sensorLandscape in AndroidManifest.xml
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
  throw new Error(`AndroidManifest.xml not found at ${manifestPath}`);
}
let manifestXml = fs.readFileSync(manifestPath, 'utf8');
manifestXml = manifestXml.replace(/<activity\b[^>]*>/g, (tag) => {
  if (!tag.includes('MainActivity')) return tag;
  if (/android:screenOrientation\s*=/.test(tag)) {
    return tag.replace(
      /android:screenOrientation\s*=\s*"[^"]*"/,
      'android:screenOrientation="sensorLandscape"'
    );
  }
  return tag.replace(/>$/, '\n            android:screenOrientation="sensorLandscape">');
});
fs.writeFileSync(manifestPath, manifestXml, 'utf8');

// 3. Configure immersive fullscreen in MainActivity.java
const javaDir = path.join(androidDir, 'app', 'src', 'main', 'java');
const mainActivityPath = findFileRecursive(javaDir, 'MainActivity.java');
if (!mainActivityPath) {
  throw new Error(`MainActivity.java not found under ${javaDir}`);
}
const existingJava = fs.readFileSync(mainActivityPath, 'utf8');
const pkgMatch = existingJava.match(/^\s*package\s+([^;]+);/m);
const pkgName = pkgMatch ? pkgMatch[1].trim() : 'com.itaminx16.firsttribes';

const patchedJava = `package ${pkgName};

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat windowInsetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (windowInsetsController != null) {
            windowInsetsController.hide(WindowInsetsCompat.Type.systemBars());
            windowInsetsController.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        }
    }
}
`;
fs.writeFileSync(mainActivityPath, patchedJava, 'utf8');

// 4. Patch versionCode and versionName in app/build.gradle
const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
if (!fs.existsSync(buildGradlePath)) {
  throw new Error(`app/build.gradle not found at ${buildGradlePath}`);
}
let gradleSrc = fs.readFileSync(buildGradlePath, 'utf8');
gradleSrc = gradleSrc
  .replace(/\bversionCode\s+\d+/, `versionCode ${runNum}`)
  .replace(/\bversionName\s+"[^"]*"/, `versionName "${version}.${runNum}"`);
fs.writeFileSync(buildGradlePath, gradleSrc, 'utf8');

console.log(
  `Configured Android project at ${androidDir} (versionName="${version}.${runNum}", versionCode=${runNum})`
);
