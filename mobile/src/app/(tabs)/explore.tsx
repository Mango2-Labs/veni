import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { describeError } from '@veni/sdk'
import { Button } from '@/components/Button'
import { EventCard } from '@/components/EventCard'
import { TabScreen } from '@/components/Screen'
import { useEventCards } from '@/lib/events'
import { colors, fonts, radius, type } from '@/lib/theme'

export default function Explore() {
  const router = useRouter()
  const events = useEventCards()
  const [city, setCity] = useState<string>()
  const cards = useMemo(() => events.data ?? [], [events.data])
  const cities = useMemo(() => [...new Set(cards.map((card) => card.city))], [cards])
  const shown = city ? cards.filter((card) => card.city === city) : cards

  return (
    <TabScreen title="Find events" refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
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
