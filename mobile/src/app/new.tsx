import { useState, type ComponentProps } from 'react'
import { Image, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { ChevronLeft } from 'lucide-react-native'
import { TEST_USD_MINT } from '@veni/client'
import { getBase64Decoder, getUtf8Encoder } from '@solana/kit'
import {
  chainTime,
  describeError,
  EVENT_CATEGORIES,
  eventCategoryMessage,
  fitBytes,
  isLumaSlug,
  toGeoPoint,
  type EventCategory,
  type LumaEvent,
  type MapPoint,
} from '@veni/sdk'
import { Button } from '@/components/Button'
import { Filter } from '@/components/Filter'
import { MapPreview } from '@/components/MapPreview'
import { PlaceSearch } from '@/components/PlaceSearch'
import { reader } from '@/lib/balances'
import { doorKeyFor } from '@/lib/door-key'
import { useMyUsername } from '@/lib/username'
import { fetchLumaEvent, saveCategory } from '@/lib/api'
import { useVeniClient, useWallet } from '@/lib/wallet'
import { colors, fonts, radius, type } from '@/lib/theme'

const HOUR_MS = 3_600_000

/** Two hours from now, on the hour. */
function defaultStart() {
  const start = new Date(Date.now() + 2 * HOUR_MS)
  start.setMinutes(0, 0, 0)
  return start
}

const seconds = (date: Date) => BigInt(Math.floor(date.getTime() / 1000))

export default function NewEvent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const client = useVeniClient()
  const { signMessages } = useWallet()
  const [category, setCategory] = useState<EventCategory>('Meetup')
  const { data: me } = useMyUsername()
  const [form, setForm] = useState({ title: '', city: '', venue: '', stake: '5', spots: '30' })
  const [startsAt, setStartsAt] = useState(defaultStart)
  const [endsAt, setEndsAt] = useState(() => new Date(startsAt.getTime() + 2 * HOUR_MS))
  const [point, setPoint] = useState<MapPoint>()
  const [cover, setCover] = useState<string>()
  const [lumaSlug, setLumaSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }))

  /** Fills the form from the host's Luma event, with Luma's times while they're still ahead. */
  function fillFromLuma(event: LumaEvent) {
    setForm((current) => ({ ...current, title: event.title, city: event.city, venue: event.venue }))
    setPoint(event.location)
    setCover(event.cover)
    setLumaSlug(event.lumaSlug)
    const start = event.startsAt ? new Date(event.startsAt) : undefined
    const end = event.endsAt ? new Date(event.endsAt) : undefined
    if (start && end && start.getTime() > Date.now() && end > start) {
      setStartsAt(start)
      setEndsAt(end)
    }
  }

  /** Moves both times to the picked day, keeping the hours. */
  function pickDay() {
    DateTimePickerAndroid.open({
      value: startsAt,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (event, day) => {
        if (event.type !== 'set' || !day) return
        const onDay = (time: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes())
        const start = onDay(startsAt)
        setStartsAt(start)
        setEndsAt(new Date(start.getTime() + (endsAt.getTime() - startsAt.getTime())))
      },
    })
  }

  /** An end before the start means the next day, for events past midnight. */
  function pickTime(which: 'start' | 'end') {
    DateTimePickerAndroid.open({
      value: which === 'start' ? startsAt : endsAt,
      mode: 'time',
      onChange: (event, time) => {
        if (event.type !== 'set' || !time) return
        const at = (hours: Date) => {
          const date = new Date(startsAt)
          date.setHours(hours.getHours(), hours.getMinutes(), 0, 0)
          return date
        }
        if (which === 'start') {
          const start = at(time)
          setStartsAt(start)
          setEndsAt(new Date(start.getTime() + Math.max(HOUR_MS, endsAt.getTime() - startsAt.getTime())))
        } else {
          const end = at(time)
          setEndsAt(end > startsAt ? end : new Date(end.getTime() + 24 * HOUR_MS))
        }
      },
    })
  }

  async function create() {
    if (!client) return
    setError(undefined)
    try {
      const title = form.title.trim()
      const city = form.city.trim()
      const venue = form.venue.trim()
      if (!title || !city || !venue) throw new Error('Add the name, city and venue.')
      if (endsAt <= startsAt) throw new Error('The event has to end after it starts.')
      const stake = Number(form.stake)
      if (!(stake > 0 && stake <= 100)) throw new Error('The stake has to be between $0.01 and $100.')
      const capacity = Number(form.spots)
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10_000) throw new Error('Spots has to be a whole number from 1 to 10,000.')
      // Sign-ups close at the start, so it has to be ahead of the chain's clock.
      if (seconds(startsAt) <= (await chainTime(reader)) + 60n) throw new Error('That start time has passed. Pick a later one.')

      setBusy(true)
      const doorKey = await doorKeyFor(client.identity.address)
      const eventId = BigInt(Date.now())
      const [event] = await client.veni.pdas.event({ organizer: client.identity.address, eventId })
      await client.veni.instructions
        .createEvent({
          organizer: client.identity,
          stakeMint: TEST_USD_MINT,
          eventId,
          terms: {
            stakeAmount: BigInt(Math.round(stake * 1e6)),
            ticketPrice: 0n,
            rsvpEndsAt: seconds(startsAt),
            checkInEndsAt: seconds(endsAt),
            capacity,
            requiresApproval: false,
            doorKey: doorKey.address,
            title,
          },
          details: {
            hostName: me?.username ?? 'Host',
            city,
            venue,
            cover: cover ?? '',
            lumaSlug: isLumaSlug(lumaSlug) ? lumaSlug : '',
            location: point ? toGeoPoint(point) : null,
          },
        })
        .sendTransaction()
      // A second, free signature saves the category on Veni's site. The event stands either way.
      const signedAt = new Date().toISOString()
      try {
        const [signed] = await signMessages([getUtf8Encoder().encode(eventCategoryMessage({ event, category, signedAt })) as Uint8Array])
        await saveCategory({ event, category, signedAt, signature: getBase64Decoder().decode(signed.slice(-64)) })
      } catch {}
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      router.replace(`/e/${event}`)
    } catch (caught) {
      setError(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View className="flex-row items-center px-3 pb-2" style={{ gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/host'))}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            className="items-center justify-center active:bg-sky"
          >
            <ChevronLeft color={colors.ink} size={26} />
          </Pressable>
          <Text accessibilityRole="header" style={type.title}>
            New event
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <LumaImport onImport={fillFromLuma} />
          {cover ? (
            <View style={{ gap: 10 }}>
              <Image accessibilityLabel="Cover from Luma" source={{ uri: cover }} style={{ height: 160, borderRadius: radius.cover, backgroundColor: colors.sky }} resizeMode="cover" />
              <View style={{ alignSelf: 'flex-start' }}>
                <Button label="Remove cover" variant="secondary" compact onPress={() => setCover(undefined)} />
              </View>
            </View>
          ) : null}
          <Field label="Name" value={form.title} onChangeText={set('title')} maxLength={64} />
          <View style={{ gap: 8 }}>
            <Text style={type.label}>Category</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {EVENT_CATEGORIES.map((name) => (
                <Filter key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
              ))}
            </View>
          </View>
          <Picker label="Date" value={startsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} onPress={pickDay} />
          <View className="flex-row" style={{ gap: 10 }}>
            <Picker label="Starts" value={startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} onPress={() => pickTime('start')} half />
            <Picker
              label="Ends"
              value={`${endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${endsAt.getDate() !== startsAt.getDate() ? ' +1' : ''}`}
              onPress={() => pickTime('end')}
              half
            />
          </View>
          <PlaceSearch
            onPick={(place) => {
              setForm((current) => ({ ...current, venue: fitBytes(place.name, 48), city: place.city ? fitBytes(place.city, 32) : current.city }))
              setPoint({ latitude: place.latitude, longitude: place.longitude })
            }}
          />
          {point ? <MapPreview point={point} /> : null}
          <Field label="City" value={form.city} onChangeText={set('city')} maxLength={32} />
          <Field label="Venue" value={form.venue} onChangeText={set('venue')} maxLength={48} />
          <View className="flex-row" style={{ gap: 10 }}>
            <Field label="Stake ($)" value={form.stake} onChangeText={set('stake')} keyboardType="decimal-pad" half />
            <Field label="Spots" value={form.spots} onChangeText={set('spots')} keyboardType="number-pad" half />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ ...type.small, fontFamily: fonts.semibold, color: colors.orangeText }}>
              {error}
            </Text>
          ) : null}
          <Button label={busy ? 'Check your wallet…' : 'Create event'} onPress={create} busy={busy} disabled={!client} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

/** Fills the form from an event the host already runs on Luma. */
function LumaImport({ onImport }: { onImport: (event: LumaEvent) => void }) {
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<{ busy?: boolean; error?: string; note?: string }>({})

  async function importLink() {
    setStatus({ busy: true })
    try {
      const event = await fetchLumaEvent(link.trim())
      onImport(event)
      setStatus({ note: importNote(event) })
    } catch (caught) {
      setStatus({ error: describeError(caught) })
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={type.label}>Luma event link</Text>
      <View className="flex-row" style={{ gap: 10 }}>
        <TextInput
          accessibilityLabel="Luma event link"
          value={link}
          onChangeText={setLink}
          placeholder="luma.com/abc123"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={importLink}
          className="min-h-14 flex-1 border-2 border-line-dk bg-paper px-4"
          style={{ borderRadius: radius.button, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}
        />
        <Button label="Import" variant="secondary" onPress={importLink} busy={status.busy} disabled={!link.trim()} />
      </View>
      <Text
        accessibilityRole={status.error ? 'alert' : undefined}
        style={status.error ? { ...type.small, fontFamily: fonts.semibold, color: colors.orangeText } : type.small}
      >
        {status.error ?? status.note ?? 'Already on Luma? Import it to fill in the details.'}
      </Text>
    </View>
  )
}

/** What's left to fill in after an import. */
function importNote(event: LumaEvent) {
  const notes = ['Imported.']
  const isAhead = event.startsAt !== undefined && Date.parse(event.startsAt) > Date.now()
  if (event.startsAt && !(isAhead && event.endsAt)) notes.push('Pick new times.')
  if (event.isOnline) notes.push('Add where people meet.')
  else if (!event.location) notes.push('Search for the venue.')
  else if (event.locationIsApproximate) notes.push('Luma hides the address, so check the pin.')
  return notes.join(' ')
}

function Picker({ label, value, onPress, half }: { label: string; value: string; onPress: () => void; half?: boolean }) {
  return (
    <View style={{ gap: 8, flex: half ? 1 : undefined }}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        className="min-h-14 justify-center border-2 border-line-dk bg-paper px-4 active:bg-sky"
        style={{ borderRadius: radius.button }}
      >
        <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}>{value}</Text>
      </Pressable>
    </View>
  )
}

function Field({ label, half, ...input }: { label: string; half?: boolean } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 8, flex: half ? 1 : undefined }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        className="min-h-14 border-2 border-line-dk bg-paper px-4"
        style={{ borderRadius: radius.button, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}
        {...input}
      />
    </View>
  )
}
