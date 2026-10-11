import { useMemo, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Code, Mic, Music, Rocket, Search, Users, Wrench, X, type LucideIcon } from 'lucide-react-native'
import { describeError, EVENT_CATEGORIES, type EventCardData, type EventCategory } from '@veni/sdk'
import { Button } from '@/components/Button'
import { EventList } from '@/components/EventList'
import { EventRow } from '@/components/EventRow'
import { Filter } from '@/components/Filter'
import { TabScreen } from '@/components/Screen'
import { useEventCards } from '@/lib/events'
import { colors, fonts, radius, type } from '@/lib/theme'

const COMING_UP = 3

const CATEGORY_LOOK: Record<EventCategory, { icon: LucideIcon; background: string; color: string }> = {
  Meetup: { icon: Users, background: colors.orange, color: colors.ink },
  Workshop: { icon: Wrench, background: colors.gold, color: colors.ink },
  Hackathon: { icon: Code, background: colors.ink, color: colors.paper },
  Conference: { icon: Mic, background: colors.tealText, color: colors.paper },
  Party: { icon: Music, background: colors.orangeSoft, color: colors.orangeInk },
  'Demo day': { icon: Rocket, background: colors.sky, color: colors.ink },
}

export default function Explore() {
  const events = useEventCards()
  const [query, setQuery] = useState('')
  const words = searchWords(query)
  return (
    <TabScreen title="Find events" refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <View
        className="flex-row items-center"
        style={{ minHeight: 48, borderRadius: radius.button, borderWidth: 2, borderColor: colors.lineDk, paddingLeft: 14 }}
      >
        <Search color={colors.muted} size={18} />
        <TextInput
          accessibilityLabel="Search events"
          value={query}
          onChangeText={setQuery}
          placeholder="Events, hosts, cities"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            style={{ width: 44, height: 44 }}
            className="items-center justify-center"
          >
            <X color={colors.ink2} size={20} />
          </Pressable>
        ) : null}
      </View>

      {events.isPending ? (
        <>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </>
      ) : null}

      {events.isError && !events.data ? (
        <View className="gap-3" style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 20 }}>
          <Text style={type.heading}>Couldn&apos;t load events</Text>
          <Text style={type.body}>{describeError(events.error)}</Text>
          <Button label="Try again" variant="secondary" onPress={() => events.refetch()} />
        </View>
      ) : null}

      {events.data ? words.length > 0 ? <Results cards={events.data} words={words} query={query} /> : <Browse cards={events.data} /> : null}
    </TabScreen>
  )
}

function Results({ cards, words, query }: { cards: EventCardData[]; words: string[]; query: string }) {
  const shown = cards.filter((card) => matches(card, words))
  if (shown.length === 0) return <Text style={{ ...type.body, textAlign: 'center', paddingVertical: 24 }}>No events match &quot;{query.trim()}&quot;.</Text>
  return <EventList cards={shown} />
}

function Browse({ cards }: { cards: EventCardData[] }) {
  const router = useRouter()
  const comingUp = useMemo(() => cards.filter(isUpcoming).sort((a, b) => a.startsAt - b.startsAt).slice(0, COMING_UP), [cards])
  const cities = useMemo(() => countBy(cards, (card) => card.city), [cards])
  const categories = useMemo(() => countBy(cards, (card) => card.category), [cards])
  return (
    <>
      <View>
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" style={type.heading}>
            Coming up
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/events')} style={{ minHeight: 44 }} className="justify-center">
            <Text style={{ ...type.label, color: colors.orangeText }}>See all {cards.length}</Text>
          </Pressable>
        </View>
        {comingUp.map((card) => (
          <EventRow key={card.key} event={card} />
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={type.heading}>
          Categories
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {EVENT_CATEGORIES.map((name) => (
            <CategoryTile key={name} name={name} count={categories.get(name) ?? 0} onPress={() => router.push({ pathname: '/events', params: { category: name } })} />
          ))}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={type.heading}>
          Cities
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {[...cities].map(([city, count]) => (
            <Filter key={city} label={city} count={count} onPress={() => router.push({ pathname: '/events', params: { city } })} />
          ))}
        </View>
      </View>
    </>
  )
}

function CategoryTile({ name, count, onPress }: { name: EventCategory; count: number; onPress: () => void }) {
  const { icon: Icon, background, color } = CATEGORY_LOOK[name]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${count} event${count === 1 ? '' : 's'}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: '30%', minHeight: 92, padding: 12, borderRadius: 18, justifyContent: 'space-between', gap: 12, backgroundColor: background, opacity: pressed ? 0.85 : 1 })}
    >
      <Icon color={color} size={22} strokeWidth={2.2} />
      <View>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize: 12, color }}>
          {name}
        </Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color }}>{count}</Text>
      </View>
    </Pressable>
  )
}

/** Live events still taking sign-ups or check-ins, and the examples. */
function isUpcoming(card: EventCardData) {
  return ['stage-open', 'stage-running', 'stage-example'].includes(card.stage?.className ?? '')
}

/** How many cards share each value, most first. */
function countBy<T>(cards: EventCardData[], valueOf: (card: EventCardData) => T | undefined) {
  const counts = new Map<T, number>()
  for (const card of cards) {
    const value = valueOf(card)
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1]))
}

/** Lowercase words without accents, so "sao paulo" finds São Paulo. */
function searchWords(text: string) {
  return fold(text).split(/\s+/).filter(Boolean)
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function matches(card: EventCardData, words: string[]) {
  const haystack = fold([card.title, card.hostName, card.city, card.place, card.category].join(' '))
  return words.every((word) => haystack.includes(word))
}

function RowSkeleton() {
  return (
    <View accessibilityLabel="Loading events" className="flex-row items-center" style={{ gap: 14 }}>
      <View style={{ width: 62, height: 62, borderRadius: 14, backgroundColor: colors.sky }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, width: '70%', borderRadius: 6, backgroundColor: colors.sky }} />
        <View style={{ height: 12, width: '45%', borderRadius: 6, backgroundColor: colors.sky }} />
      </View>
    </View>
  )
}
