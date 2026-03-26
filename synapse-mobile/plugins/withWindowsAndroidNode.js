/**
 * After `expo prebuild`, Gradle on Windows often cannot find `node`.
 * This plugin re-applies the same fixes as manual edits to settings.gradle,
 * gradlew.bat, and app/build.gradle, and ensures local.properties has sdk.dir.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

function patchSettingsGradle(content) {
  if (content.includes('synapseNodeExecutable')) return content;
  const needle = `pluginManagement {
  def reactNativeGradlePlugin = new File(
    providers.exec {
      workingDir(rootDir)
      commandLine("node", "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })")`;
  if (!content.includes(needle)) return content;
  const head = `pluginManagement {
  def synapseNodeExecutable = {
    def envNode = System.getenv("NODE_BINARY")
    if (envNode != null && !envNode.trim().isEmpty()) {
      def fn = new File(envNode.trim())
      if (fn.exists()) return fn.absolutePath
    }
    def candidates = []
    def pf = System.getenv("ProgramFiles")
    if (pf) candidates.add(new File(pf, "nodejs/node.exe"))
    def pf86 = System.getenv("ProgramFiles(x86)")
    if (pf86) candidates.add(new File(pf86, "nodejs/node.exe"))
    def local = System.getenv("LOCALAPPDATA")
    if (local) candidates.add(new File(local, "Programs/nodejs/node.exe"))
    for (def f : candidates) {
      if (f.exists()) return f.absolutePath
    }
    return "node"
  }()

  def reactNativeGradlePlugin = new File(
    providers.exec {
      workingDir(rootDir)
      commandLine(synapseNodeExecutable, "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })")`;
  let out = content.replace(needle, head);
  out = out.replace(
    `commandLine("node", "--print", "require.resolve('expo-modules-autolinking/package.json', { paths: [require.resolve('expo/package.json')] })")`,
    `commandLine(synapseNodeExecutable, "--print", "require.resolve('expo-modules-autolinking/package.json', { paths: [require.resolve('expo/package.json')] })")`
  );
  return out;
}

function patchGradlewBat(content) {
  const marker = '@rem React Native / Expo need';
  if (content.includes(marker)) return content;
  const insert =
    '@rem React Native / Expo need `node` on PATH (Gradle plugins spawn it).\r\n' +
    'if exist "%ProgramFiles%\\nodejs\\node.exe" set "PATH=%ProgramFiles%\\nodejs;%PATH%"\r\n' +
    'if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" set "PATH=%ProgramFiles(x86)%\\nodejs;%PATH%"\r\n' +
    'if exist "%LocalAppData%\\Programs\\nodejs\\node.exe" set "PATH=%LocalAppData%\\Programs\\nodejs;%PATH%"\r\n\r\n';
  const anchor = '@rem Add default JVM options here.';
  const idx = content.indexOf(anchor);
  if (idx === -1) return content;
  return content.slice(0, idx) + insert + content.slice(idx);
}

function patchAppBuildGradle(content) {
  if (content.includes('synapseNodeForApp')) return content;
  const old = `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

/**
 * This is the configuration block to customize your React Native Android app.
 * By default you don't need to apply any configuration, just uncomment the lines you need.
 */
react {
    entryFile = file(["node", "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())
    reactNativeDir = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    hermesCommand = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()

    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()
    // Use Expo CLI to bundle the app, this ensures the Metro config
    // works correctly with Expo projects.
    cliFile = new File(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())`;
  if (!content.includes('entryFile = file(["node"')) return content;
  const neu = `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

def synapseResolveNodeForApp() {
  def envNode = System.getenv("NODE_BINARY")
  if (envNode != null && !envNode.trim().isEmpty()) {
    def f = new File(envNode.trim())
    if (f.exists()) return f.absolutePath
  }
  def candidates = []
  def pf = System.getenv("ProgramFiles")
  if (pf) candidates.add(new File(pf, "nodejs/node.exe"))
  def pf86 = System.getenv("ProgramFiles(x86)")
  if (pf86) candidates.add(new File(pf86, "nodejs/node.exe"))
  def local = System.getenv("LOCALAPPDATA")
  if (local) candidates.add(new File(local, "Programs/nodejs/node.exe"))
  for (def f : candidates) {
    if (f.exists()) return f.absolutePath
  }
  return "node"
}
def synapseNodeForApp = synapseResolveNodeForApp()

/**
 * This is the configuration block to customize your React Native Android app.
 * By default you don't need to apply any configuration, just uncomment the lines you need.
 */
react {
    nodeExecutableAndArgs = [synapseNodeForApp]

    entryFile = file([synapseNodeForApp, "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())
    reactNativeDir = new File([synapseNodeForApp, "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    hermesCommand = new File([synapseNodeForApp, "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File([synapseNodeForApp, "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()

    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()
    // Use Expo CLI to bundle the app, this ensures the Metro config
    // works correctly with Expo projects.
    cliFile = new File([synapseNodeForApp, "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())`;
  return content.replace(old, neu);
}

function ensureLocalProperties(androidRoot) {
  const envSdk = process.env.ANDROID_HOME;
  const defaultSdk =
    envSdk && fs.existsSync(envSdk)
      ? envSdk
      : process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
        : null;
  if (!defaultSdk || !fs.existsSync(defaultSdk)) return;
  const lp = path.join(androidRoot, 'local.properties');
  let text = '';
  try {
    text = fs.readFileSync(lp, 'utf8');
  } catch {
    /* new */
  }
  const line = `sdk.dir=${defaultSdk.replace(/\\/g, '/')}`;
  if (text.includes('sdk.dir=')) return;
  const header =
    '## Generated by withWindowsAndroidNode — set ANDROID_HOME or edit sdk.dir if wrong.\n';
  fs.writeFileSync(lp, header + line + '\n', 'utf8');
}

function withWindowsAndroidNode(config) {
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const androidRoot = c.modRequest.platformProjectRoot;
      ensureLocalProperties(androidRoot);

      const sg = path.join(androidRoot, 'settings.gradle');
      if (fs.existsSync(sg)) {
        fs.writeFileSync(sg, patchSettingsGradle(fs.readFileSync(sg, 'utf8')), 'utf8');
      }
      const gw = path.join(androidRoot, 'gradlew.bat');
      if (fs.existsSync(gw)) {
        fs.writeFileSync(gw, patchGradlewBat(fs.readFileSync(gw, 'utf8')), 'utf8');
      }
      const ag = path.join(androidRoot, 'app', 'build.gradle');
      if (fs.existsSync(ag)) {
        fs.writeFileSync(ag, patchAppBuildGradle(fs.readFileSync(ag, 'utf8')), 'utf8');
      }
      return c;
    },
  ]);
}

module.exports = withWindowsAndroidNode;
