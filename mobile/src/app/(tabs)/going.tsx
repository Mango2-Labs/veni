import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { describeError } from '@veni/sdk'
import { Button } from '@/components/Button'
import { EventList } from '@/components/EventList'
import { TabScreen } from '@/components/Screen'
import { useMyEventCards } from '@/lib/events'
import { type } from '@/lib/theme'

export default function Going() {
  const router = useRouter()
  const events = useMyEventCards()
  return (
    <TabScreen title="Going" refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      {events.isPending ? <Text style={type.body}>Loading your events…</Text> : null}
      {events.isError ? (
        <View className="gap-3">
          <Text style={type.body}>{describeError(events.error)}</Text>
          <Button label="Try again" variant="secondary" onPress={() => events.refetch()} />
        </View>
      ) : null}
      {events.data?.length === 0 ? (
        <View className="gap-3">
          <Text style={type.body}>Nothing yet.</Text>
          <Button label="Find an event" onPress={() => router.navigate('/explore')} />
        </View>
      ) : null}
      {events.data ? <EventList cards={events.data} /> : null}
    </TabScreen>
  )
}
