import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { address as toAddress, isAddress, type Address } from '@solana/kit'
import { Avatar } from '@/components/Avatar'
import { shortAddress } from '@/components/AccountMenu'
import { EventList } from '@/components/EventList'
import { HostedEventRow } from '@/components/HostedEventRow'
import { Tabs } from '@/components/Tabs'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { useHostPage } from '@/lib/event'
import { useEventCards } from '@/lib/events'
import { photoUrl, usePeople } from '@/lib/people'
import { colors, fonts, radius, type } from '@/lib/theme'

/** A host's page: who they are, how their events went, and what's coming up. */
export default function HostPageScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ wallet: string }>()
  const wallet = isAddress(params.wallet) ? toAddress(params.wallet) : undefined
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Cover onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
        {wallet ? <Host wallet={wallet} /> : <Text style={{ ...type.body, padding: 20 }}>This isn&apos;t a Veni host.</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

function Cover({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ height: 172, overflow: 'hidden', backgroundColor: colors.ink }}>
      <View style={{ position: 'absolute', right: -60, top: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: colors.orange }} />
      <View style={{ position: 'absolute', right: 40, top: 18, width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.55)' }} />
      <View style={{ position: 'absolute', left: -40, bottom: -90, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.tealText }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={{ position: 'absolute', left: 16, top: 48, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)' }}
        className="items-center justify-center"
      >
        <ChevronLeft color={colors.paper} size={26} />
      </Pressable>
    </View>
  )
}

function Host({ wallet }: { wallet: Address }) {
  const page = useHostPage(wallet)
  const events = useEventCards()
  const people = usePeople([wallet])
  // Finished events still paying out stay on-chain a while; they belong under Past.
  const upcoming = events.data?.filter((card) => card.organizer === wallet && ['stage-open', 'stage-running'].includes(card.stage?.className ?? '')) ?? []
  const past = page.data?.pastEvents ?? []
  const [tab, setTab] = useState<'upcoming' | 'past'>()
  const shown = tab ?? (upcoming.length || !past.length ? 'upcoming' : 'past')
  const { profile, record } = page.data ?? {}
  const name = profile?.name ?? people.data?.usernames?.[wallet] ?? upcoming[0]?.hostName ?? past[0]?.hostName ?? shortAddress(wallet)
  const since = profile && new Date(profile.registeredAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      <View style={{ marginTop: -38, alignSelf: 'flex-start', borderRadius: 42, borderWidth: 4, borderColor: colors.paper }}>
        <Avatar username={name} photo={photoUrl(wallet, people.data?.photos?.[wallet])} size={76} />
      </View>
      <View style={{ gap: 4 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={type.title}>
            {name}
          </Text>
          {page.data?.isVerified ? <VerifiedBadge size={24} /> : null}
        </View>
        {since ? <Text style={type.small}>Host on Veni since {since}</Text> : null}
        {profile?.lumaCalendar ? (
          <Text accessibilityRole="link" onPress={() => Linking.openURL(`https://luma.com/${profile.lumaCalendar}`)} style={{ ...type.label, textDecorationLine: 'underline' }}>
            luma.com/{profile.lumaCalendar}
          </Text>
        ) : null}
      </View>
      {record ? (
        <View className="flex-row border border-line" style={{ borderRadius: radius.card }}>
          <Stat value={`${record.eventCount + upcoming.length}`} label={record.eventCount + upcoming.length === 1 ? 'event' : 'events'} />
          <Stat value={record.guestCount ? `${Math.round((record.attendedCount / record.guestCount) * 100)}%` : '—'} label="guests show up" tone={colors.tealText} />
          <Stat value={`${record.guestCount}`} label={record.guestCount === 1 ? 'guest' : 'guests'} />
        </View>
      ) : null}
      <Tabs
        tabs={[
          { key: 'upcoming', label: `Upcoming · ${upcoming.length}` },
          { key: 'past', label: `Past · ${past.length}` },
        ]}
        value={shown}
        onChange={setTab}
      />
      {shown === 'upcoming' ? (
        upcoming.length ? <EventList cards={upcoming} /> : <Text style={type.body}>{events.isPending ? 'Loading…' : 'Nothing coming up.'}</Text>
      ) : past.length ? (
        <View>
          {past.map((event) => (
            <HostedEventRow key={event.address} event={event} />
          ))}
        </View>
      ) : (
        <Text style={type.body}>{page.isPending ? 'Loading…' : 'No past events yet.'}</Text>
      )}
    </View>
  )
}

function Stat({ value, label, tone = colors.ink }: { value: string; label: string; tone?: string }) {
  return (
    <View style={{ flex: 1, padding: 14, gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: tone }}>{value}</Text>
      <Text style={{ ...type.small, fontSize: 12 }}>{label}</Text>
    </View>
  )
}
