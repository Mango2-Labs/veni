// Calls to Veni's API on the website: usernames, test funds, the archive.
import type { Address } from '@solana/kit'
import type { UsernameInput } from '@veni/sdk'
import { VENI_URL } from './config'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${VENI_URL}${path}`, init)
  } catch {
    throw new Error("Couldn't reach Veni. Check your connection and try again.")
  }
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `Veni couldn't answer that (${response.status}).`)
  return body
}

function post<T>(path: string, body: unknown) {
  return json<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

/** The wallet's username, and when it may next change. Empty when it has none. */
export type MyUsername = { username?: string; changeableAt?: string }

export function fetchMyUsername(wallet: Address) {
  return json<MyUsername>(`/api/usernames/${wallet}`)
}

export function checkUsername(username: string, wallet: Address) {
  return json<{ available: boolean; problem?: string }>(
    `/api/usernames/check?name=${encodeURIComponent(username)}&wallet=${wallet}`,
  )
}

export async function saveUsername(input: UsernameInput & { signature: string }) {
  const { username } = await post<{ username?: string }>('/api/usernames', input)
  if (!username) throw new Error("Couldn't save your username.")
  return username
}

/** Usernames for up to 100 wallets; wallets without one are left out. */
export async function fetchUsernames(wallets: Address[]) {
  const { usernames } = await json<{ usernames: Record<string, string> }>(`/api/usernames?wallets=${wallets.join(',')}`)
  return usernames
}

/** 50 Test USD, plus 0.05 SOL if the wallet is low. */
export function requestTestFunds(wallet: Address) {
  return post<{ ok: true }>('/api/faucet', { wallet })
}

export type HostPage = {
  profile?: { name: string }
  record: { eventCount: number; guestCount: number; attendedCount: number }
}

export function fetchHostPage(wallet: Address) {
  return json<HostPage>(`/api/hosts/${wallet}`)
}

export async function fetchDescription(event: Address) {
  return (await json<{ description: string | null }>(`/api/events/${event}/description`)).description
}

/** The description on the event's Luma page, read through Veni's server. */
export async function fetchLumaDescription(url: string) {
  return (await post<{ event?: { description: string } }>('/api/luma', { url })).event?.description
}
