import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react-native'
import { Avatar } from './Avatar'
import { formatUsd, LOW_SOL_LAMPORTS, STAKE_MINTS } from '@veni/sdk'
import { tokenLabel, useWalletBalances } from '@/lib/balances'
import { useMyUsername } from '@/lib/username'
import { useWallet } from '@/lib/wallet'
import { colors, fonts, radius, type } from '@/lib/theme'

export function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function AccountMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { account, disconnect } = useWallet()
  const { data } = useMyUsername()
  const balances = useWalletBalances()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!account) return null

  function go(href: '/profile' | '/host') {
    setOpen(false)
    router.navigate(href)
  }

  const items: { label: string; onPress: () => void }[] = [
    { label: 'View profile', onPress: () => go('/profile') },
    { label: 'Host an event', onPress: () => go('/host') },
    {
      label: 'Sign out',
      onPress: async () => {
        setOpen(false)
        await disconnect()
        queryClient.clear()
        router.replace('/')
      },
    },
  ]

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="rounded-full active:opacity-80"
      >
        <Avatar username={data?.username} size={40} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close menu" className="flex-1 bg-ink/40" onPress={() => setOpen(false)}>
          <View style={{ borderRadius: radius.card }} className="mx-4 mt-24 overflow-hidden border border-line bg-paper" onStartShouldSetResponder={() => true}>
            <View className="flex-row items-center gap-3 border-b border-line p-4">
              <Avatar username={data?.username} size={44} />
              <View className="flex-1">
                <Text style={type.strong}>{data?.username ?? '…'}</Text>
                <View className="flex-row items-center">
                  <Text style={{ ...type.small, fontFamily: 'monospace' }}>{shortAddress(account.address)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copied ? 'Address copied' : 'Copy address'}
                    hitSlop={4}
                    onPress={async () => {
                      await Clipboard.setStringAsync(account.address)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    }}
                    style={{ borderRadius: 12 }}
                    className="h-10 w-10 items-center justify-center active:bg-sky"
                  >
                    {copied ? <Check color={colors.tealText} size={18} /> : <Copy color={colors.ink2} size={18} />}
                  </Pressable>
                </View>
              </View>
            </View>
            <MenuBalance balances={balances.data} failed={balances.isError} />
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={item.onPress}
                className="min-h-14 justify-center px-4 active:bg-sky"
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

// SOL shows only when it runs too low for fees.
function MenuBalance({ balances, failed }: { balances: ReturnType<typeof useWalletBalances>['data']; failed: boolean }) {
  if (!balances) {
    return (
      <View className="border-b border-line px-4 py-3">
        <Text style={type.small}>{failed ? 'Balance unavailable' : '…'}</Text>
      </View>
    )
  }
  const held = balances.dollars.filter(({ amount }) => amount > 0n)
  const shown = held.length > 0 ? held : [{ mint: STAKE_MINTS[0], amount: 0n }]
  return (
    <View className="gap-1 border-b border-line px-4 py-3">
      {shown.map(({ mint, amount }) => (
        <Text key={mint} style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>
          {formatUsd(amount)} <Text style={{ ...type.small, fontFamily: fonts.bold }}>{tokenLabel(mint)}</Text>
        </Text>
      ))}
      {balances.lamports < LOW_SOL_LAMPORTS ? (
        <Text style={{ ...type.small, fontFamily: fonts.semibold, color: colors.orangeText }}>
          Add a little SOL for network fees.
        </Text>
      ) : null}
    </View>
  )
}
