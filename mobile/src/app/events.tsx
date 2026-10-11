import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { describeError, isEventCategory, type EventCardData } from '@veni/sdk'
import { Button } from '@/components/Button'
import { EventList } from '@/components/EventList'
import { Filter } from '@/components/Filter'
import { useEventCards } from '@/lib/events'
import { colors, type } from '@/lib/theme'

/** Events in one category or city, or all of them, narrowed by city (or by category, in a city). */
export default function EventsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string; city?: string }>()
  const category = isEventCategory(params.category) ? params.category : undefined
  const city = params.city
  const events = useEventCards()
  const [narrow, setNarrow] = useState<string>()
  const inScope = useMemo(
    () => (events.data ?? []).filter((card) => (!category || card.category === category) && (!city || card.city === city)),
    [events.data, category, city],
  )
  const narrowBy = (card: EventCardData) => (city ? card.category : card.city)
  const options = [...new Set(inScope.flatMap((card) => narrowBy(card) ?? []))]
  const shown = narrow ? inScope.filter((card) => narrowBy(card) === narrow) : inScope

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View className="flex-row items-center px-3 pb-2" style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          className="items-center justify-center active:bg-sky"
        >
          <ChevronLeft color={colors.ink} size={26} />
        </Pressable>
        <View>
          <Text accessibilityRole="header" style={type.title}>
            {category ?? city ?? 'All events'}
          </Text>
          {events.data ? <Text style={type.small}>{inScope.length === 1 ? '1 event' : `${inScope.length} events`}</Text> : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
        {options.length > 1 ? (
          <FilterRow>
            <Filter label={city ? 'All' : 'All cities'} selected={!narrow} onPress={() => setNarrow(undefined)} />
            {options.map((name) => (
              <Filter key={name} label={name} selected={narrow === name} onPress={() => setNarrow(name)} />
            ))}
          </FilterRow>
        ) : null}
        {events.isPending ? <Text style={type.body}>Loading events…</Text> : null}
        {events.isError && !events.data ? (
          <View className="gap-3">
            <Text style={type.body}>{describeError(events.error)}</Text>
            <Button label="Try again" variant="secondary" onPress={() => events.refetch()} />
          </View>
        ) : null}
        {events.data && shown.length === 0 ? <Text style={{ ...type.body, textAlign: 'center', paddingVertical: 24 }}>No events here yet.</Text> : null}
        <EventList cards={shown} />
      </ScrollView>
    </SafeAreaView>
  )
}

/** A row of filters that scrolls sideways, edge to edge. */
function FilterRow({ children }: { children: ReactNode }) {
  return (
    // Grows no taller than its chips, however much room the screen has.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, flexGrow: 0 }}>
      {children}
    </ScrollView>
  )
}
