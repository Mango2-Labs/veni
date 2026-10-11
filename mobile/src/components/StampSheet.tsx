import { Text, View } from 'react-native'
import type { PastEvent } from '@/lib/api'
import { colors, fonts, type } from '@/lib/theme'

/** Each event the guest came to, as a stamp: a turned, dashed ring with the city and date. */
export function StampSheet({ events }: { events: PastEvent[] }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 14 }}>
      {events.map((event) => {
        const date = new Date(event.startsAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        return (
          <View key={event.address} accessible accessibilityLabel={`Checked in at ${event.city} on ${date}: ${event.title}`} style={{ width: '47%', gap: 6 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                borderWidth: 2.5,
                borderStyle: 'dashed',
                borderColor: colors.tealText,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: '-8deg' }],
              }}
            >
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 9, color: colors.tealText }}>Checked in</Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 14, color: colors.tealText, textAlign: 'center', maxWidth: 92 }}>
                {event.city}
              </Text>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 9, color: colors.tealText }}>{date}</Text>
            </View>
            <Text style={type.strong} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              Hosted by {event.hostName}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
