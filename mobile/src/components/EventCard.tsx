import { Image, Pressable, Text, View } from 'react-native'
import { coverIndexOf, type EventCardData } from '@veni/sdk'
import { Avatar } from './Avatar'
import { Chip } from './Chip'
import { TypeLabels } from './TypeLabels'
import { CityStamp } from './CityStamp'
import { VerifiedBadge } from './VerifiedBadge'
import { colors, fonts, radius, type } from '@/lib/theme'

/** "SB" for "Seoul Builders". */
export function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => [...word][0]?.toUpperCase() ?? '').join('') || '?'
}

export const COVERS = [
  { background: colors.ink, color: colors.paper },
  { background: colors.orange, color: colors.ink },
  { background: colors.tealText, color: colors.paper },
  { background: colors.gold, color: colors.ink },
  { background: colors.sky, color: colors.ink },
  { background: colors.orangeSoft, color: colors.orangeInk },
]

const HOST_LOGOS = {
  monkedao: require('../../assets/hosts/monkedao.png'),
  solana: require('../../assets/hosts/solana.png'),
  'superteam-sg': require('../../assets/hosts/superteam-sg.png'),
  'superteam-ca': require('../../assets/hosts/superteam-ca.png'),
}

export function EventCard({
  event,
  hostPhoto,
  hostVerified,
  onPress,
}: {
  event: EventCardData
  hostPhoto?: string
  hostVerified?: boolean
  onPress?: () => void
}) {
  const cover = COVERS[coverIndexOf(event.seed, { paid: Boolean(event.ticket), approval: event.approval })]
  const stake = event.ticket ? `${event.ticket} + ${event.stake} stake` : `${event.stake} stake`
  const content = (
    <>
      <View style={{ height: 150, padding: 16, justifyContent: 'flex-end', backgroundColor: event.cover ? colors.ink : cover.background }}>
        {event.cover ? (
          <Image source={{ uri: event.cover }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 24, letterSpacing: -0.6, color: cover.color }} numberOfLines={3}>
            {event.title}
          </Text>
        )}
        <TypeLabels ticket={event.ticket} approval={event.approval} />
        <View style={{ position: 'absolute', right: 14, top: 14 }}>
          <CityStamp
            city={event.city}
            date={event.stampDate}
            color={event.cover ? colors.ink : cover.color}
            background={event.cover ? 'rgba(255,255,255,0.92)' : undefined}
          />
        </View>
      </View>
      <View style={{ gap: 4, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}>
        {event.cover ? <Text style={{ ...type.heading, fontSize: 18 }}>{event.title}</Text> : null}
        <View className="flex-row items-center gap-2">
          <Avatar initials={initialsOf(event.hostName)} photo={event.hostLogo ? HOST_LOGOS[event.hostLogo] : hostPhoto} size={28} />
          <Text style={type.strong}>{event.hostName}</Text>
          {event.hostVerified || hostVerified ? <VerifiedBadge /> : null}
        </View>
        <Text style={{ ...type.small, color: colors.ink2 }}>
          {event.when} · {event.place}
        </Text>
        <View className="mt-1 flex-row flex-wrap items-center" style={{ gap: 8 }}>
          {event.stage ? <Chip label={event.stage.label} tone={event.stage.className} /> : null}
          {event.hostRecord ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.tealText }}>{event.hostRecord}</Text> : null}
        </View>
        <View
          className="mt-2 flex-row items-center justify-between pt-3"
          style={{ borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.line }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: event.spotsLeft ? colors.orangeText : colors.ink2 }}>
            {event.spotsLeft ?? event.going}
          </Text>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }}>{stake}</Text>
        </View>
      </View>
    </>
  )
  const frame = { borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' as const, backgroundColor: colors.paper }
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${event.when}, ${event.city}`} onPress={onPress} style={frame} className="active:opacity-90">
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={`${event.title}, an example event`} style={frame}>
      {content}
    </View>
  )
}
