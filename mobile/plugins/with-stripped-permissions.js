/**
 * Expo config plugin that strips Android permissions Veni doesn't actually
 * use but that get pulled in by upstream templates / native dependencies.
 *
 * Why it exists:
 *   `SYSTEM_ALERT_WINDOW` ("draw on top of other apps") is included in the
 *   Expo bare-template default manifest with the literal comment
 *   "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED" — it's a
 *   leftover for the React Native dev menu overlay. Veni draws no system
 *   overlays in production, so the permission has no purpose. Solana
 *   Mobile dApp Store reviewers flag it as a sensitive permission, and
 *   leaving it in invites scrutiny / rejection.
 *
 * To strip another permission later, append its full name to
 * PERMISSIONS_TO_STRIP. The plugin is a no-op for permissions not present.
 */

const { withAndroidManifest } = require('@expo/config-plugins')

const PERMISSIONS_TO_STRIP = ['android.permission.SYSTEM_ALERT_WINDOW']

module.exports = function withStrippedPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const permissions = cfg.modResults.manifest['uses-permission']
    if (!Array.isArray(permissions)) return cfg

    cfg.modResults.manifest['uses-permission'] = permissions.filter((p) => {
      const name = p?.$?.['android:name']
      return !PERMISSIONS_TO_STRIP.includes(name)
    })

    return cfg
  })
}
