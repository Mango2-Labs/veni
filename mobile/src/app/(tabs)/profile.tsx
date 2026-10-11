import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from '@solana/kit'
import { Camera, Check } from 'lucide-react-native'
import { formatUsd, formatUsdShort, stampDateOf } from '@veni/sdk'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { CityStamp } from '@/components/CityStamp'
import { TabScreen } from '@/components/Screen'
import { requestTestFunds, type HistoryEvent } from '@/lib/api'
import { balancesKey, useWalletBalances } from '@/lib/balances'
import { photoUrl } from '@/lib/people'
import { useHistory, useStampCount } from '@/lib/profile'
import { pickAndSavePhoto } from '@/lib/photos'
import { myUsernameKey, useMyUsername } from '@/lib/username'
import { useWallet } from '@/lib/wallet'
import { colors, fonts, radius, type } from '@/lib/theme'

export default function Profile() {
  const queryClient = useQueryClient()
  const { account, signMessages } = useWallet()
  const { data } = useMyUsername()
  const stamps = useStampCount(account?.address)
  const history = useHistory(account?.address)
  const balances = useWalletBalances()
  const [tab, setTab] = useState<'past' | 'rewards'>('past')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  if (!account) return null
  const earned = BigInt(history.data?.pages[0]?.earned ?? 0)

  async function changePhoto() {
    setSaving(true)
    setError(undefined)
    try {
      if (await pickAndSavePhoto(account!.address, signMessages)) {
        await queryClient.invalidateQueries({ queryKey: myUsernameKey(account!.address) })
        queryClient.invalidateQueries({ queryKey: ['people'] })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TabScreen
      title="Profile"
      refreshing={history.isRefetching}
      onRefresh={() => {
        stamps.refetch()
        history.refetch()
        balances.refetch()
      }}
    >
      <View className="flex-row items-center" style={{ gap: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change your photo" disabled={saving} onPress={changePhoto}>
          <Avatar username={data?.username} photo={photoUrl(account.address, data?.photo)} size={72} />
          <View
            style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink }}
            className="items-center justify-center"
          >
            {saving ? <ActivityIndicator size="small" color={colors.ink} /> : <Camera color={colors.ink} size={13} strokeWidth={2.4} />}
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.title} numberOfLines={1}>
            {data?.username ?? '…'}
          </Text>
          <View className="flex-row flex-wrap" style={{ columnGap: 14 }}>
            {stamps.data === undefined ? (
              <Text style={type.small}>…</Text>
            ) : stamps.data === 0 ? (
              <Text style={type.small}>No stamps yet</Text>
            ) : (
              <Count value={stamps.data} label={stamps.data === 1 ? 'stamp' : 'stamps'} />
            )}
            {earned > 0n ? <Count value={`+${formatUsdShort(toCents(earned))}`} label="earned" color={colors.tealText} /> : null}
          </View>
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ ...type.small, color: colors.orangeText }}>{error}</Text> : null}
      <Balance wallet={account.address} total={balances.data?.dollars.reduce((sum, { amount }) => sum + amount, 0n)} failed={balances.isError} />
      <Tabs value={tab} onChange={setTab} />
      {tab === 'past' ? <PastEvents history={history} /> : <Rewards stamps={stamps.data ?? 0} />}
    </TabScreen>
  )
}

function Count({ value, label, color = colors.ink }: { value: number | string; label: string; color?: string }) {
  return (
    <Text style={type.small}>
      <Text style={{ fontFamily: fonts.heavy, color }}>{value}</Text> {label}
    </Text>
  )
}

/** Shares of no-shows' stakes can run to six decimals; cents are enough here. */
function toCents(baseUnits: bigint) {
  return (baseUnits / 10_000n) * 10_000n
}

function Balance({ wallet, total, failed }: { wallet: Address; total: bigint | undefined; failed: boolean }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function getTestFunds() {
    setBusy(true)
    setError(undefined)
    try {
      await requestTestFunds(wallet)
      await queryClient.invalidateQueries({ queryKey: balancesKey(wallet) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ borderRadius: radius.card, backgroundColor: colors.sky, padding: 16, gap: 8 }}>
      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={{ ...type.small, fontFamily: fonts.bold, color: colors.ink2 }}>Balance</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink }}>
            {total !== undefined ? formatUsd(total) : failed ? 'Unavailable' : '…'}
          </Text>
        </View>
        <Button label="Get test funds" variant="secondary" busy={busy} onPress={getTestFunds} />
      </View>
      {error ? <Text accessibilityRole="alert" style={{ ...type.small, color: colors.orangeText }}>{error}</Text> : null}
    </View>
  )
}

function Tabs({ value, onChange }: { value: 'past' | 'rewards'; onChange: (value: 'past' | 'rewards') => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row bg-sky" style={{ borderRadius: radius.button, padding: 4, gap: 4 }}>
      {(
        [
          ['past', 'Past events'],
          ['rewards', 'Rewards'],
        ] as const
      ).map(([key, label]) => {
        const selected = value === key
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.paper : 'transparent' }}
          >
            <Text style={{ fontFamily: selected ? fonts.heavy : fonts.bold, fontSize: 14, color: selected ? colors.ink : colors.ink2 }}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const STAMP_COLORS = [colors.tealText, colors.ink, colors.orangeText]

const OUTCOMES = {
  'checked-in': { label: 'Checked in', color: colors.tealText },
  missed: { label: 'Missed', color: colors.orangeText },
  cancelled: { label: 'Cancelled', color: colors.muted },
} as const

function PastEvents({ history }: { history: ReturnType<typeof useHistory> }) {
  if (history.isPending) return <Text style={type.body}>Loading…</Text>
  if (history.isError) {
    return (
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="alert" style={type.body}>
          {history.error.message}
        </Text>
        <Button label="Try again" variant="secondary" onPress={() => history.refetch()} />
      </View>
    )
  }
  const events = history.data.pages.flatMap((page) => page.events)
  if (events.length === 0) return <Text style={type.body}>No past events yet.</Text>
  return (
    <View style={{ gap: 12 }}>
      <View>
        {events.map((event, index) => (
          <PastEventRow key={event.address} event={event} color={STAMP_COLORS[index % STAMP_COLORS.length]} />
        ))}
      </View>
      {history.hasNextPage ? <Button label="Show more" variant="secondary" busy={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} /> : null}
    </View>
  )
}

function PastEventRow({ event, color }: { event: HistoryEvent; color: string }) {
  const outcome = OUTCOMES[event.outcome]
  const date = stampDateOf(new Date(event.startsAt * 1000))
  const result = BigInt(event.result)
  const dollars = formatUsdShort(toCents(result < 0n ? -result : result))
  const amount = result > 0n ? `+${dollars}` : result < 0n ? `−${dollars}` : dollars
  return (
    <View
      accessible
      accessibilityLabel={`${event.title}, ${event.city}, ${date}. ${outcome.label}, ${amount}.`}
      className="flex-row items-center border-b border-line"
      style={{ gap: 14, paddingVertical: 14 }}
    >
      <CityStamp city={event.city} date={date} color={event.outcome === 'checked-in' ? color : colors.muted} size={62} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.strong} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          Hosted by {event.hostName}
        </Text>
        <Text style={{ ...type.small, fontFamily: fonts.bold, color: outcome.color }}>{outcome.label}</Text>
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: result > 0n ? colors.tealText : result < 0n ? colors.orangeText : colors.muted }}>{amount}</Text>
    </View>
  )
}

// SKR for reaching each stamp count, then 10 SKR a stamp. Claiming comes later.
const MILESTONES = [
  [1, 25],
  [5, 75],
  [10, 150],
  [15, 250],
  [20, 500],
] as const

function Rewards({ stamps }: { stamps: number }) {
  const next = MILESTONES.find(([at]) => at > stamps)?.[0]
  return (
    <View>
      <Text accessibilityRole="header" style={{ ...type.heading, marginBottom: 4 }}>
        Milestones
      </Text>
      {MILESTONES.map(([at, skr]) => (
        <Milestone
          key={at}
          label={`${at} ${at === 1 ? 'stamp' : 'stamps'}`}
          skr={`${skr} SKR`}
          state={at <= stamps ? 'reached' : at === next ? 'next' : 'locked'}
          note={at === next ? `${at - stamps} more to go` : undefined}
        />
      ))}
      <Milestone label="Every stamp after 20" skr="+10 SKR" state={stamps > 20 ? 'reached' : 'locked'} />
    </View>
  )
}

function Milestone({ label, skr, state, note }: { label: string; skr: string; state: 'reached' | 'next' | 'locked'; note?: string }) {
  const ink = state === 'locked' ? colors.muted : colors.ink
  return (
    <View accessible accessibilityLabel={`${label}: ${skr}${state === 'reached' ? ', reached' : ''}${note ? `, ${note}` : ''}`} className="flex-row items-center border-b border-line" style={{ gap: 14, paddingVertical: 12 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: state === 'reached' ? colors.teal : undefined,
          borderWidth: state === 'reached' ? 0 : 2,
          borderStyle: 'dashed',
          borderColor: state === 'next' ? colors.teal : colors.lineDk,
        }}
      >
        {state === 'reached' ? <Check color={colors.paper} size={18} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...type.strong, fontSize: 15, color: ink }}>{label}</Text>
        {note ? <Text style={{ ...type.small, fontFamily: fonts.bold, color: colors.ink2 }}>{note}</Text> : null}
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: ink }}>{skr}</Text>
    </View>
  )
}
