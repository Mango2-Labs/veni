import { useQuery } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { photoPath } from '@veni/sdk'
import { fetchPeople } from './api'
import { VENI_URL } from './config'

/** Usernames, photo versions and verified hosts for a list of wallets, in one request. */
export function usePeople(wallets: Address[]) {
  const unique = [...new Set(wallets)].sort()
  return useQuery({ queryKey: ['people', unique.join(',')], queryFn: () => fetchPeople(unique), enabled: unique.length > 0, staleTime: 60_000 })
}

export function photoUrl(wallet: string, version: number | undefined) {
  return version ? `${VENI_URL}${photoPath(wallet, version)}` : undefined
}
