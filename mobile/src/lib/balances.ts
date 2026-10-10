import { useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { TEST_USD_MINT, USDC_MINT } from '@veni/client'
import { createVeniReader, fetchWalletBalances } from '@veni/sdk'
import { RPC_URL } from './config'
import { useWallet } from './wallet'

export const reader = createVeniReader(RPC_URL)

export const balancesKey = (wallet: string | undefined) => ['balances', wallet] as const

/** The connected wallet's dollars and SOL. */
export function useWalletBalances() {
  const { account } = useWallet()
  const wallet = account?.address
  return useQuery({
    queryKey: balancesKey(wallet),
    queryFn: () => fetchWalletBalances(reader, wallet!),
    enabled: Boolean(wallet),
  })
}

/** Both stake tokens are dollars with 6 decimals: "$12.25". */
export function formatUsd(baseUnits: bigint) {
  return `$${(Number(baseUnits) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}

/** "$10" or "$12.25": without empty cents, for cards and buttons. */
export function formatUsdShort(baseUnits: bigint) {
  return formatUsd(baseUnits).replace(/\.00$/, '')
}

export function tokenLabel(mint: Address) {
  return mint === TEST_USD_MINT ? 'Test USD' : mint === USDC_MINT ? 'USDC' : 'tokens'
}
