import { useQuery } from '@tanstack/react-query'
import { fetchAllMaybeEvent } from '@veni/client'
import { cardOfEvent, chainTime, exampleEvents, fetchEventAddresses } from '@veni/sdk'
import { reader } from './balances'

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
      // Dated by the day, so the examples don't shift as the chain's clock ticks.
      const today = new Date(Number((now / DAY_SECONDS) * DAY_SECONDS) * 1000)
      return [...live, ...exampleEvents(today)]
    },
    refetchInterval: 15_000,
  })
}
