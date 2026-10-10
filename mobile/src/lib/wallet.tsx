// The wallet, through Mobile Wallet Adapter: Seed Vault on Seeker, or Phantom and Solflare.
import { useMemo, type ReactNode } from 'react'
import {
  bytesEqual,
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

/**
 * A signer that asks the wallet to sign, then lets the client send through Veni's RPC,
 * which rebroadcasts and confirms the same way as on the website.
 */
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

/**
 * The wallet hands back bytes, which lose the blockhash the sender confirms against. Keep the
 * original's when the wallet didn't change it, or read it from the signed message (as @solana/react does).
 */
async function withLifetime(signed: Transaction, original: Transaction) {
  const existing = 'lifetimeConstraint' in original ? (original as Transaction & TransactionWithLifetime).lifetimeConstraint : undefined
  const message = getCompiledTransactionMessageDecoder().decode(signed.messageBytes)
  if (existing) {
    const token = 'blockhash' in existing ? existing.blockhash : existing.nonce
    if (bytesEqual(signed.messageBytes, original.messageBytes) || message.lifetimeToken === token) {
      return { ...signed, lifetimeConstraint: existing }
    }
  }
  return { ...signed, lifetimeConstraint: await getTransactionLifetimeConstraintFromCompiledTransactionMessage(message) }
}

/** The program client for the connected wallet, or null before it connects. */
export function useVeniClient() {
  const { account, signTransactions } = useMobileWallet()
  const address = account?.address
  return useMemo(
    () => (address ? createVeniClient(walletSigner(address, signTransactions), RPC_URL) : null),
    [address, signTransactions],
  )
}
