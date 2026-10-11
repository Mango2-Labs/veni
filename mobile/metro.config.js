const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const repo = path.resolve(__dirname, '..')
const shared = {
  '@veni/sdk': path.join(repo, 'sdk'),
  '@veni/client': path.join(repo, 'clients', 'veni'),
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// The SDK and program client come straight from the repo, like on the web, and their imports
// resolve from this app's node_modules, so there's one copy of Kit.
config.watchFolders = Object.values(shared)
config.resolver.extraNodeModules = shared
const sharedDirs = Object.values(shared).map((dir) => dir + path.sep)
const appEntry = path.join(__dirname, 'index.js')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = sharedDirs.some((dir) => context.originModulePath.startsWith(dir))
  if (fromShared && !moduleName.startsWith('.')) {
    return context.resolveRequest({ ...context, originModulePath: appEntry }, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})
