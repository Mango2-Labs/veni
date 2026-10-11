import { useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { fetchMaybeEvent } from '@veni/client'
import { chainTime, fetchGuests, lumaLinkOf } from '@veni/sdk'
import { fetchDescription, fetchHostPage, fetchLumaDescription } from './api'
import { reader } from './balances'

export const eventKey = (address: Address) => ['event', address] as const

/** The event, its guests and the chain's clock, read every 5 seconds. Null once it's closed. */
export function useEventSnapshot(address: Address) {
  return useQuery({
    queryKey: eventKey(address),
    queryFn: async () => {
      const account = await fetchMaybeEvent(reader.rpc, address)
      if (!account.exists) return null
      const [guests, now] = await Promise.all([fetchGuests(reader, address), chainTime(reader)])
      return { event: account.data, guests, now }
    },
    refetchInterval: 5_000,
  })
}

export function useHostPage(organizer: Address | undefined) {
  return useQuery({ queryKey: ['host', organizer], queryFn: () => fetchHostPage(organizer!), enabled: Boolean(organizer) })
}

/** The host's own description, else the one on Luma. */
export function useDescription(address: Address, event: Parameters<typeof lumaLinkOf>[0] | undefined) {
  const luma = event ? lumaLinkOf(event) : undefined
  return useQuery({
    queryKey: ['description', address],
    queryFn: async () => (await fetchDescription(address)) || (luma ? await fetchLumaDescription(luma).catch(() => undefined) : undefined) || null,
    enabled: Boolean(event),
    staleTime: 60_000,
  })
}
