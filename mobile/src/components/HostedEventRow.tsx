import { Image, Text, View } from 'react-native'
import { coverIndexOf, isCoverUrl, stampDateOf, turnoutOf } from '@veni/sdk'
import { COVERS, initialsOf } from './EventCard'
import type { HostedEvent } from '@/lib/api'
import { colors, fonts, type } from '@/lib/theme'

const THUMB = 62

/** A hosted event that's over: its poster, or its card's cover, then when, where and how it went. */
export function HostedEventRow({ event }: { event: HostedEvent }) {
  const date = stampDateOf(new Date(event.startsAt * 1000))
  const turnout = turnoutOf(event)
  const cover = COVERS[coverIndexOf(event.address)]
  return (
    <View
      accessible
      accessibilityLabel={`${event.title}, ${date}, ${event.venue}, ${event.city}. ${turnout}.`}
      className="flex-row items-center border-b border-line"
      style={{ gap: 14, paddingVertical: 14 }}
    >
      <View style={{ width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: cover.background }}>
        {isCoverUrl(event.cover) ? (
          <Image source={{ uri: event.cover }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" />
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: cover.color }}>{initialsOf(event.title)}</Text>
        )}
      </View>
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
