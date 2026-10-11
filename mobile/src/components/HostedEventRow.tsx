import { Text, View } from 'react-native'
import { stampDateOf, turnoutOf } from '@veni/sdk'
import { EventThumb } from './EventThumb'
import type { HostedEvent } from '@/lib/api'
import { colors, fonts, type } from '@/lib/theme'

/** A hosted event that's over: its poster, or its card's cover, then when, where and how it went. */
export function HostedEventRow({ event }: { event: HostedEvent }) {
  const date = stampDateOf(new Date(event.startsAt * 1000))
  const turnout = turnoutOf(event)
  return (
    <View
      accessible
      accessibilityLabel={`${event.title}, ${date}, ${event.venue}, ${event.city}. ${turnout}.`}
      className="flex-row items-center border-b border-line"
      style={{ gap: 14, paddingVertical: 14 }}
    >
      <EventThumb cover={event.cover} title={event.title} seed={event.address} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.strong} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {date} · {event.venue}, {event.city}
        </Text>
        <Text style={{ ...type.small, fontFamily: fonts.bold, color: event.isCancelled ? colors.muted : colors.tealText }}>{turnout}</Text>
      </View>
    </View>
  )
}
