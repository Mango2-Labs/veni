import { Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/Button'
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
      action={<Button label="New event" variant="secondary" compact onPress={() => router.push('/new')} />}
      refreshing={events.isRefetching}
      onRefresh={() => events.refetch()}
    >
      {events.isPending ? <Text style={type.body}>Loading your events…</Text> : null}
      {hosting?.length === 0 ? <Text style={type.body}>Events you host show here.</Text> : null}
      {hosting?.length ? <EventList cards={hosting} /> : null}
    </TabScreen>
  )
}
