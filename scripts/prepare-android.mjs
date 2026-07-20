#!/usr/bin/env node
// One-command Android setup for Localphotos Pro.
// Adds the android platform if missing, builds web, syncs Capacitor, and
// patches AndroidManifest.xml with every permission the app needs.
// Run: npm run android
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const ANDROID_DIR = resolve("android");

if (!existsSync(ANDROID_DIR)) {
  console.log("📱 android/ folder not found — adding platform...");
  run("npx cap add android");
} else {
  console.log("📱 android/ folder exists — reusing it.");
}

console.log("\n🛠  Building web bundle...");
run("npm run build");

console.log("\n🔄 Syncing Capacitor plugins...");
run("npx cap sync android");

// ---- Patch AndroidManifest.xml ---------------------------------------------
const manifestPath = resolve("android/app/src/main/AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  console.error(`❌ Cannot find ${manifestPath}`);
  process.exit(1);
}

const PERMS = [
  '<uses-permission android:name="android.permission.CAMERA"/>',
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>',
  '<uses-permission android:name="android.permission.READ_MEDIA_VIDEOS"/>',
  '<uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED"/>',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29"/>',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>',
  '<uses-permission android:name="android.permission.INTERNET"/>',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>',
  '<uses-permission android:name="android.permission.VIBRATE"/>',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>',
  '<uses-permission android:name="android.permission.WAKE_LOCK"/>',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>',
  '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>',
];


let xml = readFileSync(manifestPath, "utf8");
let added = 0;
const missing = PERMS.filter((p) => {
  const name = p.match(/android:name="([^"]+)"/)?.[1];
  return name && !xml.includes(`android:name="${name}"`);
});

if (missing.length) {
  const block = missing.join("\n    ");
  xml = xml.replace(/<application\b/, `${block}\n\n    <application`);
  writeFileSync(manifestPath, xml);
  added = missing.length;
}

console.log(
  added
    ? `\n✅ Patched AndroidManifest.xml — added ${added} permission(s).`
    : `\n✅ AndroidManifest.xml already had every required permission.`,
);

console.log(
  "\n🎉 Ready! Open Android Studio with:\n" +
    "   npx cap open android\n" +
    "then hit ▶ Run, or Build → Build APK(s).\n",
);
