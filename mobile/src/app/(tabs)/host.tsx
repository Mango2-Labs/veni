import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { stampDateOf, turnoutOf } from '@veni/sdk'
import { Button } from '@/components/Button'
import { CityStamp } from '@/components/CityStamp'
import { EmptyState } from '@/components/EmptyState'
import { EventList } from '@/components/EventList'
import { TabScreen } from '@/components/Screen'
import type { HostedEvent } from '@/lib/api'
import { useHostPage } from '@/lib/event'
import { useEventCards } from '@/lib/events'
import { useWallet } from '@/lib/wallet'
import { colors, fonts, type } from '@/lib/theme'

export default function Host() {
  const router = useRouter()
  const { account } = useWallet()
  const events = useEventCards()
  const hostPage = useHostPage(account?.address)
  const hosting = events.data?.filter((card) => card.organizer === account?.address)
  const past = hostPage.data?.pastEvents ?? []
  const hasEvents = Boolean(hosting?.length || past.length)
  return (
    <TabScreen
      title="Hosting"
      action={hasEvents ? <Button label="New event" variant="secondary" compact onPress={() => router.push('/new')} /> : undefined}
      refreshing={events.isRefetching || hostPage.isRefetching}
      onRefresh={() => {
        events.refetch()
        hostPage.refetch()
      }}
    >
      {events.isPending ? <Text style={type.body}>Loading your events…</Text> : null}
      {hosting && !hostPage.isPending && !hasEvents ? <EmptyState title="No events yet" action="New event" onPress={() => router.push('/new')} /> : null}
      {hosting?.length ? <EventList cards={hosting} /> : null}
      {past.length ? (
        <View>
          <Text accessibilityRole="header" style={{ ...type.heading, marginTop: 8 }}>
            Past
          </Text>
          {past.map((event) => (
            <HostedEventRow key={event.address} event={event} />
          ))}
        </View>
      ) : null}
    </TabScreen>
  )
}

function HostedEventRow({ event }: { event: HostedEvent }) {
  const date = stampDateOf(new Date(event.startsAt * 1000))
  const turnout = turnoutOf(event)
  return (
    <View
      accessible
      accessibilityLabel={`${event.title}, ${event.city}, ${date}. ${turnout}.`}
      className="flex-row items-center border-b border-line"
      style={{ gap: 14, paddingVertical: 14 }}
    >
      <CityStamp city={event.city} date={date} color={event.isCancelled ? colors.muted : colors.ink} size={62} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.strong} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {event.venue}
        </Text>
        <Text style={{ ...type.small, fontFamily: fonts.bold, color: event.isCancelled ? colors.muted : colors.tealText }}>{turnout}</Text>
      </View>
    </View>
  )
}
