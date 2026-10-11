import { useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { fetchMaybeStampCount, findStampCountPda } from '@veni/client'
import { fetchPastEvents } from './api'
import { reader } from './balances'

/** The wallet's stamp count, kept on-chain where nothing can lower it. */
export function useStampCount(wallet: Address | undefined) {
  return useQuery({
    queryKey: ['stamps', wallet],
    queryFn: async () => {
      const [address] = await findStampCountPda({ wallet: wallet! })
      const account = await fetchMaybeStampCount(reader.rpc, address)
      return account.exists ? account.data.count : 0
    },
    enabled: Boolean(wallet),
  })
}

export function usePastEvents(wallet: Address | undefined) {
  return useQuery({ queryKey: ['past', wallet], queryFn: () => fetchPastEvents(wallet!), enabled: Boolean(wallet) })
}
