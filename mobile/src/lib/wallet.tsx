import { useMemo, type ReactNode } from 'react'
import {
  getCompiledTransactionMessageDecoder,
  getTransactionLifetimeConstraintFromCompiledTransactionMessage,
  type Address,
  type Transaction,
  type TransactionModifyingSigner,
  type TransactionWithLifetime,
} from '@solana/kit'
import { createSolanaDevnet, MobileWalletProvider, useMobileWallet } from '@wallet-ui/react-native-kit'
import { createVeniClient } from '@veni/sdk'
import { RPC_URL, VENI_URL } from './config'

const cluster = createSolanaDevnet({ url: RPC_URL })
const identity = { name: 'Veni', uri: VENI_URL, icon: 'icon.png' }

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <MobileWalletProvider cluster={cluster} identity={identity}>
      {children}
    </MobileWalletProvider>
  )
}

export const useWallet = useMobileWallet

// Sign-only, so the client sends through Veni's RPC, which rebroadcasts and confirms as on the website.
function walletSigner(
  address: Address,
  signTransactions: <T extends Transaction | Transaction[]>(transactions: T) => Promise<T>,
): TransactionModifyingSigner {
  type Signed = Awaited<ReturnType<TransactionModifyingSigner['modifyAndSignTransactions']>>
  return Object.freeze({
    address,
    modifyAndSignTransactions: async (transactions) => {
      const signed = await signTransactions([...transactions] as Transaction[])
      return (await Promise.all(signed.map((transaction, i) => withLifetime(transaction, transactions[i])))) as unknown as Signed
    },
  })
}

// The wallet returns bytes without the lifetime the sender confirms against, so restore it (as @solana/react does).
async function withLifetime(signed: Transaction, original: Transaction) {
  const existing = 'lifetimeConstraint' in original ? (original as Transaction & TransactionWithLifetime).lifetimeConstraint : undefined
  const message = getCompiledTransactionMessageDecoder().decode(signed.messageBytes)
  if (existing && message.lifetimeToken === ('blockhash' in existing ? existing.blockhash : existing.nonce)) {
    return { ...signed, lifetimeConstraint: existing }
  }
  return { ...signed, lifetimeConstraint: await getTransactionLifetimeConstraintFromCompiledTransactionMessage(message) }
}

export function useVeniClient() {
  const { account, signTransactions } = useMobileWallet()
  const address = account?.address
  return useMemo(
    () => (address ? createVeniClient(walletSigner(address, signTransactions), RPC_URL) : null),
    [address, signTransactions],
  )
}
