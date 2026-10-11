import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { describeError, findPlaceAt, findPlaces, pointFromText, type Place, type PlaceSource } from '@veni/sdk'
import { VENI_URL } from '@/lib/config'
import { colors, fonts, radius, type } from '@/lib/theme'

// Google through Veni's site, or OpenStreetMap, which asks apps to name themselves and search at most once a second.
const USER_AGENT = 'Veni (https://veni-phi.vercel.app)'
const WAIT_MS = 800

/** Short Google Maps links redirect to a full one, which holds the pin. */
async function pointFromShortLink(text: string, signal: AbortSignal) {
  const link = /https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/\S+/.exec(text)?.[0]
  return link ? pointFromText((await fetch(link, { signal })).url) : undefined
}

/** Finds a place by name, or from a pasted Google Maps link or coordinates. */
export function PlaceSearch({ onPick }: { onPick: (place: Place) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>()
  const [source, setSource] = useState<PlaceSource>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const text = query.trim()
    setError(undefined)
    if (text.length < 3) return setResults(undefined)
    const controller = new AbortController()
    const options = { signal: controller.signal, language: Intl.DateTimeFormat().resolvedOptions().locale, userAgent: USER_AGENT }
    const timer = setTimeout(async () => {
      try {
        const point = pointFromText(text) ?? (await pointFromShortLink(text, controller.signal))
        const found = point ? await findPlaceAt(VENI_URL, point, options) : await findPlaces(VENI_URL, text, options)
        if (controller.signal.aborted) return
        setResults(found.places)
        setSource(found.source)
      } catch (caught) {
        if (!controller.signal.aborted) setError(describeError(caught))
      }
    }, WAIT_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <View style={{ gap: 8 }}>
      <Text style={type.label}>Where</Text>
      <TextInput
        accessibilityLabel="Where"
        value={query}
        onChangeText={setQuery}
        placeholder="Search, or paste a Google Maps link"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        className="min-h-14 border-2 border-line-dk bg-paper px-4"
        style={{ borderRadius: radius.button, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }}
      />
      {error ? <Text style={{ ...type.small, color: colors.orangeText }}>{error}</Text> : null}
      {results?.length === 0 ? <Text style={type.small}>Nothing found. Type the city and venue below.</Text> : null}
      {results?.map((place) => (
        <Pressable
          key={`${place.latitude},${place.longitude}`}
          accessibilityRole="button"
          onPress={() => {
            onPick(place)
            setQuery('')
            setResults(undefined)
          }}
          className="border-b border-line active:bg-sky"
          style={{ paddingVertical: 10, gap: 2 }}
        >
          <Text style={type.strong}>{place.name || 'Pinned place'}</Text>
          {place.address ? <Text style={type.small}>{place.address}</Text> : null}
        </Pressable>
      ))}
      {results?.length ? <Text style={{ ...type.small, fontSize: 12 }}>{source === 'Google Maps' ? 'Google Maps' : '© OpenStreetMap'}</Text> : null}
    </View>
  )
}
