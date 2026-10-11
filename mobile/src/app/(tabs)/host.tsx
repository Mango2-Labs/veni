import { Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { EventList } from '@/components/EventList'
import { TabScreen } from '@/components/Screen'
import { useEventCards } from '@/lib/events'
import { useWallet } from '@/lib/wallet'
import { type } from '@/lib/theme'

export default function Host() {
  const router = useRouter()
  const { account } = useWallet()
  const events = useEventCards()
  const hosting = events.data?.filter((card) => card.organizer === account?.address)
  return (
    <TabScreen
      title="Hosting"
      action={hosting?.length ? <Button label="New event" variant="secondary" compact onPress={() => router.push('/new')} /> : undefined}
      refreshing={events.isRefetching}
      onRefresh={() => events.refetch()}
    >
      {events.isPending ? <Text style={type.body}>Loading your events…</Text> : null}
      {hosting?.length === 0 ? <EmptyState title="No events yet" action="New event" onPress={() => router.push('/new')} /> : null}
      {hosting?.length ? <EventList cards={hosting} /> : null}
    </TabScreen>
  )
}
