import { useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { TEST_USD_MINT, USDC_MINT } from '@veni/client'
import { createVeniReader, fetchWalletBalances } from '@veni/sdk'
import { RPC_URL } from './config'
import { useWallet } from './wallet'

export const reader = createVeniReader(RPC_URL)

export const balancesKey = (wallet: string | undefined) => ['balances', wallet] as const

export function useWalletBalances() {
  const { account } = useWallet()
  const wallet = account?.address
  return useQuery({
    queryKey: balancesKey(wallet),
    queryFn: () => fetchWalletBalances(reader, wallet!),
    enabled: Boolean(wallet),
  })
}

export function tokenLabel(mint: Address) {
  return mint === TEST_USD_MINT ? 'Test USD' : mint === USDC_MINT ? 'USDC' : 'tokens'
}
