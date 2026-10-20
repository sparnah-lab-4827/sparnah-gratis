#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sdk="${ANDROID_HOME:?Android SDK required}"
tools="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
out="${RUNNER_TEMP:-/tmp}/sparnah-android"
mkdir -p "$out/classes" "$out/dex" "$out/gen" "$out/res/drawable" "$out/assets/site" "$out/dist"
cp site/icon-192.png "$out/res/drawable/icon.png"
# Deliberate allowlist: never package encrypted regional datasets or keys.
for file in index.html styles.css engine.js estimate-references.js estimates.js search.js leaflets.js stores.js shopping.js logos.js choices.js selection.js updates.js vault.js install.js app.js sw.js manifest.webmanifest icon.svg icon-192.png icon-512.png; do cp "site/$file" "$out/assets/site/$file"; done
cp -R site/logos "$out/assets/site/logos"
"$tools/aapt2" compile --dir "$out/res" -o "$out/resources.zip"
"$tools/aapt2" link -o "$out/base.apk" --manifest android/AndroidManifest.xml --replace-version --version-code "${GITHUB_RUN_NUMBER:-1}" --version-name "1.0.${GITHUB_RUN_NUMBER:-1}" -I "$platform" --java "$out/gen" -A "$out/assets" "$out/resources.zip"
find android/src "$out/gen" -name '*.java' > "$out/sources.txt"
javac -encoding UTF-8 --release 8 -classpath "$platform" -d "$out/classes" @"$out/sources.txt"
jar cf "$out/classes.jar" -C "$out/classes" .
"$tools/d8" --lib "$platform" --min-api 26 --output "$out/dex" "$out/classes.jar"
cp "$out/base.apk" "$out/unsigned.apk"
(cd "$out/dex" && zip -q "$out/unsigned.apk" classes.dex)
"$tools/zipalign" -f -p 4 "$out/unsigned.apk" "$out/aligned.apk"
python - "$out" <<'PY'
import base64,json,os,sys,pathlib
out=pathlib.Path(sys.argv[1]);secret=json.loads(os.environ['SPARNAH_ANDROID_SIGNING'])
for name in ['key','cert']:(out/(name+'.der')).write_bytes(base64.b64decode(secret[name],validate=True))
PY
trap 'rm -f "$out/key.der" "$out/cert.der"' EXIT
"$tools/apksigner" sign --key "$out/key.der" --cert "$out/cert.der" --out "$out/dist/Sparnah.apk" "$out/aligned.apk"
"$tools/apksigner" verify --verbose --print-certs "$out/dist/Sparnah.apk"
"$tools/aapt2" dump badging "$out/dist/Sparnah.apk" > "$out/dist/apk-info.txt"
grep -F "versionCode='${GITHUB_RUN_NUMBER:-1}'" "$out/dist/apk-info.txt"
(cd "$out/dist" && sha256sum Sparnah.apk > SHA256SUMS.txt)
echo "APK_DIST=$out/dist" >> "$GITHUB_ENV"
