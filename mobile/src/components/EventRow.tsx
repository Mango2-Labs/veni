import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { EventCardData } from '@veni/sdk'
import { EventThumb } from './EventThumb'
import { type } from '@/lib/theme'

/** An event in one line: its cover, then when and where. Live events open their page. */
export function EventRow({ event }: { event: EventCardData }) {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole={event.href ? 'button' : undefined}
      accessibilityLabel={`${event.title}, ${event.when}, ${event.city}, ${event.stake} stake`}
      disabled={!event.href}
      onPress={() => router.push(event.href as `/e/${string}`)}
      className="flex-row items-center border-b border-line active:bg-sky"
      style={{ gap: 14, paddingVertical: 12 }}
    >
      <EventThumb cover={event.cover} title={event.title} seed={event.seed} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.strong} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {event.when}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {event.city} · {event.stake} stake
        </Text>
      </View>
    </Pressable>
  )
}
