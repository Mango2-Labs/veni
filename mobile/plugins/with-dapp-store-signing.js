/**
 * Expo config plugin that injects a `dappStore` signing config into
 * android/app/build.gradle and routes the `release` build type through
 * it. Keystore + passwords are read at build time from
 * `keystore.properties` at the repo root, which is gitignored.
 *
 * If `keystore.properties` doesn't exist, the plugin still injects the
 * gradle code, but the `release` build falls back to the debug keystore
 * so dev / side-load builds keep working without the production key.
 *
 * Required `keystore.properties` keys:
 *   storeFile      — path relative to repo root (e.g. keystores/veni-dapp-store.keystore)
 *   storePassword
 *   keyAlias
 *   keyPassword
 */

const { withAppBuildGradle } = require('@expo/config-plugins')

const DAPP_STORE_BLOCK = `
        dappStore {
            def keystorePropertiesFile = rootProject.file("../keystore.properties")
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile rootProject.file("../" + keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    `

// Inject a dappStore { } block immediately before the closing `}` of the
// `signingConfigs { }` block. Uses brace counting so the placement is
// independent of indentation and the existing `debug { }` block size.
function injectSigningConfig(gradle) {
  if (gradle.includes('dappStore {')) return gradle

  const start = gradle.indexOf('signingConfigs {')
  if (start === -1) return gradle

  let depth = 0
  let i = start + 'signingConfigs '.length
  for (; i < gradle.length; i++) {
    if (gradle[i] === '{') depth++
    else if (gradle[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  if (i >= gradle.length) return gradle

  return gradle.slice(0, i) + DAPP_STORE_BLOCK + gradle.slice(i)
}

// Within the `release { }` block specifically, replace
// `signingConfig signingConfigs.debug` so release builds prefer the
// dappStore key whenever keystore.properties is present. Anchored on
// `release {` to avoid touching the `debug { }` block above.
function rewriteReleaseSigningConfig(gradle) {
  return gradle.replace(
    /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    `$1signingConfig rootProject.file("../keystore.properties").exists() ? signingConfigs.dappStore : signingConfigs.debug`,
  )
}

module.exports = function withDappStoreSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents
    gradle = injectSigningConfig(gradle)
    gradle = rewriteReleaseSigningConfig(gradle)
    cfg.modResults.contents = gradle
    return cfg
  })
}
