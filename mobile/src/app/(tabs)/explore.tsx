import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Search, X } from 'lucide-react-native'
import { describeError, type EventCardData } from '@veni/sdk'
import { Button } from '@/components/Button'
import { EventCard } from '@/components/EventCard'
import { TabScreen } from '@/components/Screen'
import { useEventCards } from '@/lib/events'
import { colors, fonts, radius, type } from '@/lib/theme'

export default function Explore() {
  const router = useRouter()
  const events = useEventCards()
  const [city, setCity] = useState<string>()
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const cards = useMemo(() => events.data ?? [], [events.data])
  const cities = useMemo(() => [...new Set(cards.map((card) => card.city))], [cards])
  const words = searchWords(query)
  const shown = cards.filter((card) => (!city || card.city === city) && matches(card, words))

  function closeSearch() {
    setQuery('')
    setSearching(false)
  }

  return (
    <TabScreen
      title="Find events"
      refreshing={events.isRefetching}
      onRefresh={() => events.refetch()}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search events"
          onPress={() => (searching ? closeSearch() : setSearching(true))}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          className="items-center justify-center active:bg-sky"
        >
          <Search color={colors.ink} size={22} />
        </Pressable>
      }
    >
      {searching ? (
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
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, paddingHorizontal: 10, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={closeSearch}
            style={{ width: 44, height: 44 }}
            className="items-center justify-center"
          >
            <X color={colors.ink2} size={20} />
          </Pressable>
        </View>
      ) : null}
      {cities.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 10 }} />
          <Filter label="All cities" selected={!city} onPress={() => setCity(undefined)} />
          {cities.map((name) => (
            <Filter key={name} label={name} selected={city === name} onPress={() => setCity(name)} />
          ))}
          <View style={{ width: 10 }} />
        </ScrollView>
      ) : null}

      {events.isPending ? (
        <>
          <CardSkeleton />
          <CardSkeleton />
        </>
      ) : null}

      {events.isError && !events.data ? (
        <View className="gap-3" style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 20 }}>
          <Text style={type.heading}>Couldn't load events</Text>
          <Text style={type.body}>{describeError(events.error)}</Text>
          <Button label="Try again" variant="secondary" onPress={() => events.refetch()} />
        </View>
      ) : null}

      {events.data && shown.length === 0 ? (
        <Text style={{ ...type.body, textAlign: 'center', paddingVertical: 24 }}>
          {words.length > 0 ? `No events match "${query.trim()}".` : 'No events here yet.'}
        </Text>
      ) : null}

      {shown.map((card) => (
        <EventCard key={card.key} event={card} onPress={card.href ? () => router.push(card.href as `/e/${string}`) : undefined} />
      ))}

      {events.data ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/host')}
          style={{ borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineDk, padding: 28 }}
          className="items-center gap-3 active:bg-sky"
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange }} className="items-center justify-center">
            <Plus color={colors.ink} size={26} strokeWidth={2.6} />
          </View>
          <Text style={{ ...type.heading }}>Host your own</Text>
        </Pressable>
      ) : null}
    </TabScreen>
  )
}

/** Lowercase words without accents, so "sao paulo" finds São Paulo. */
function searchWords(text: string) {
  return fold(text).split(/\s+/).filter(Boolean)
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function matches(card: EventCardData, words: string[]) {
  if (words.length === 0) return true
  const haystack = fold([card.title, card.hostName, card.city, card.place].join(' '))
  return words.every((word) => haystack.includes(word))
}

function Filter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: selected ? colors.ink : colors.paper,
        borderWidth: selected ? 0 : 1.5,
        borderColor: colors.line,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: selected ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  )
}

function CardSkeleton() {
  return (
    <View accessibilityLabel="Loading events" style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      <View style={{ height: 150, backgroundColor: colors.sky }} />
      <View style={{ padding: 18, gap: 10 }}>
        <View style={{ height: 16, width: '50%', borderRadius: 6, backgroundColor: colors.sky }} />
        <View style={{ height: 14, width: '80%', borderRadius: 6, backgroundColor: colors.sky }} />
        <View style={{ height: 14, width: '35%', borderRadius: 6, backgroundColor: colors.sky }} />
      </View>
    </View>
  )
}
