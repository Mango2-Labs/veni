import { useQuery } from '@tanstack/react-query'
import { fetchMyUsername } from './api'
import { useWallet } from './wallet'

export const myUsernameKey = (wallet: string | undefined) => ['username', wallet] as const

export function useMyUsername() {
  const { account } = useWallet()
  const wallet = account?.address
  return useQuery({
    queryKey: myUsernameKey(wallet),
    queryFn: () => fetchMyUsername(wallet!),
    enabled: Boolean(wallet),
  })
}
