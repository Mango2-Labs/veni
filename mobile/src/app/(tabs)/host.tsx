import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { EventList } from '@/components/EventList'
import { HostedEventRow } from '@/components/HostedEventRow'
import { TabScreen } from '@/components/Screen'
import { useHostPage } from '@/lib/event'
import { useEventCards } from '@/lib/events'
import { useWallet } from '@/lib/wallet'
import { type } from '@/lib/theme'

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
