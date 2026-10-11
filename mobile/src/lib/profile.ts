import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { fetchMaybeStampCount, findStampCountPda } from '@veni/client'
import { fetchRewardsFor } from '@veni/sdk'
import { fetchHistory } from './api'
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

export const rewardsKey = (wallet: Address | undefined) => ['rewards', wallet] as const

export function useRewards(wallet: Address | undefined) {
  return useQuery({ queryKey: rewardsKey(wallet), queryFn: () => fetchRewardsFor(reader, wallet!), enabled: Boolean(wallet) })
}

export function useHistory(wallet: Address | undefined) {
  return useInfiniteQuery({
    queryKey: ['history', wallet],
    queryFn: ({ pageParam }) => fetchHistory(wallet!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.reduce((count, page) => count + page.events.length, 0) : undefined),
    enabled: Boolean(wallet),
  })
}
