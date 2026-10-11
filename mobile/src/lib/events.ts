import { useQuery } from '@tanstack/react-query'
import { fetchEncodedAccounts } from '@solana/kit'
import { decodeEvent, fetchAllMaybeEvent } from '@veni/client'
import { cardOfEvent, chainTime, EVENT_ACCOUNT_SIZE, exampleEvents, fetchEventAddresses, fetchGuestsOfWallet } from '@veni/sdk'
import { fetchCategories } from './api'
import { reader } from './balances'
import { useWallet } from './wallet'

const DAY_SECONDS = 86_400n

export function useEventCards() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const addresses = await fetchEventAddresses(reader)
      const [accounts, now] = await Promise.all([fetchAllMaybeEvent(reader.rpc, addresses), chainTime(reader)])
      const live = accounts
        .flatMap((account) => (account.exists ? [{ address: account.address, event: account.data }] : []))
        .sort((a, b) => Number(b.event.terms.rsvpEndsAt - a.event.terms.rsvpEndsAt))
        .map(({ address, event }) => cardOfEvent(address, event, now))
      // Categories live on Veni's site; without them, events still list.
      const categories = await fetchCategories(live.map((card) => card.seed)).catch(() => ({}) as Record<string, undefined>)
      for (const card of live) card.category = categories[card.seed]
      // Dated by the day, so the examples don't shift as the chain's clock ticks.
      const today = new Date(Number((now / DAY_SECONDS) * DAY_SECONDS) * 1000)
      return [...live, ...exampleEvents(today)]
    },
    refetchInterval: 15_000,
  })
}

/** Events the connected wallet signed up for, soonest first. */
export function useMyEventCards() {
  const { account } = useWallet()
  const wallet = account?.address
  return useQuery({
    queryKey: ['going', wallet],
    queryFn: async () => {
      const signUps = await fetchGuestsOfWallet(reader, wallet!)
      const [accounts, now] = await Promise.all([fetchEncodedAccounts(reader.rpc, signUps.map(({ data }) => data.event)), chainTime(reader)])
      // Skips events from older program versions.
      return accounts
        .flatMap((account) => (account.exists && account.data.length === EVENT_ACCOUNT_SIZE ? [decodeEvent(account)] : []))
        .sort((a, b) => Number(a.data.terms.rsvpEndsAt - b.data.terms.rsvpEndsAt))
        .map(({ address, data }) => cardOfEvent(address, data, now))
    },
    enabled: Boolean(wallet),
  })
}
