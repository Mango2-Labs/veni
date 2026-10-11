import type { Address } from '@solana/kit'
import type { PhotoInput, UsernameInput } from '@veni/sdk'
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

/** Empty when the wallet has no username. `photo` is the photo's version. */
export type MyUsername = { username?: string; changeableAt?: string; photo?: number }

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

export function fetchPeople(wallets: Address[]) {
  return json<{ usernames: Record<string, string>; photos: Record<string, number> }>(`/api/usernames?wallets=${wallets.join(',')}`)
}

export async function savePhoto(input: PhotoInput & { image: string; signature: string }) {
  const { version } = await post<{ version?: number }>('/api/photos', input)
  if (!version) throw new Error("Couldn't save your photo.")
  return version
}

/** A past event the wallet signed up for. `result` is what it made (+) or lost (-) beyond the stake, in base units. */
export type HistoryEvent = {
  address: string
  title: string
  hostName: string
  city: string
  startsAt: number
  outcome: 'checked-in' | 'missed' | 'cancelled'
  result: string
}

export function fetchHistory(wallet: Address, offset: number) {
  return json<{ events: HistoryEvent[]; earned: string; hasMore: boolean }>(`/api/me/history?wallet=${wallet}&offset=${offset}`)
}

export function requestTestFunds(wallet: Address) {
  return post<{ ok: true }>('/api/faucet', { wallet })
}

/** An event a host ran, as Veni's archive kept it once it was over. */
export type HostedEvent = {
  address: string
  title: string
  city: string
  venue: string
  startsAt: number
  guestCount: number
  attendedCount: number
  isCancelled: boolean
}

export type HostPage = {
  profile?: { name: string }
  record: { eventCount: number; guestCount: number; attendedCount: number }
  pastEvents: HostedEvent[]
}

export function fetchHostPage(wallet: Address) {
  return json<HostPage>(`/api/hosts/${wallet}`)
}

export async function fetchDescription(event: Address) {
  return (await json<{ description: string | null }>(`/api/events/${event}/description`)).description
}

export async function fetchLumaDescription(url: string) {
  return (await post<{ event?: { description: string } }>('/api/luma', { url })).event?.description
}
