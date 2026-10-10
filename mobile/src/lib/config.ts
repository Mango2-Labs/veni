// The app talks to Veni through the website's API. Its /api/rpc proxy keeps the RPC key on
// the server, so the key never ships in the APK.
export const VENI_URL = process.env.EXPO_PUBLIC_VENI_URL ?? 'https://veni-phi.vercel.app'
export const RPC_URL = `${VENI_URL}/api/rpc`
