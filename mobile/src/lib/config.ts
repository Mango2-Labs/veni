// Through the website's API: its /api/rpc proxy keeps the RPC key off the phone.
export const VENI_URL = process.env.EXPO_PUBLIC_VENI_URL ?? 'https://veni-phi.vercel.app'
export const RPC_URL = `${VENI_URL}/api/rpc`
