import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useKeepAwake } from 'expo-keep-awake'
import { ChevronLeft } from 'lucide-react-native'
import { address as toAddress, isAddress, type KeyPairSigner } from '@solana/kit'
import { decodeEvent, type Event } from '@veni/client'
import { describeError, encodeCheckInCode, EVENT_ACCOUNT_SIZE, fetchWithChainTime, signCheckInCode } from '@veni/sdk'
import { QrCode } from '@/components/QrCode'
import { reader } from '@/lib/balances'
import { findDoorKey } from '@/lib/door-key'
import { colors, fonts, radius, type } from '@/lib/theme'

// Codes last a minute, so each is re-signed after 30 seconds and a scanned one has at least 30 left.
const REFRESH_SECONDS = 30n
const POLL_EVERY_MS = 1000

type Door = { event: Event; now: bigint; hasDoorKey: boolean; shown?: { code: bigint; shownAt: bigint; text: string }; problem?: string }

/** The door: a QR code guests scan with Veni to check in, signed by this phone's door key. */
export default function DoorScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ address: string }>()
  const eventAddress = isAddress(params.address) ? toAddress(params.address) : undefined
  const [door, setDoor] = useState<Door>()
  const [error, setError] = useState<string>()
  // The door stays lit while guests arrive.
  useKeepAwake()

  useEffect(() => {
    if (!eventAddress) return
    const address = eventAddress
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let doorKey: KeyPairSigner | undefined
    let looked = false
    let shown: Door['shown']
    async function poll() {
      try {
        const { account, now } = await fetchWithChainTime(reader, address)
        if (!account.exists || account.data.length !== EVENT_ACCOUNT_SIZE) {
          setError('This event has closed.')
          stopped = true
          return
        }
        const event = decodeEvent(account).data
        if (!looked) {
          doorKey = await findDoorKey(event.organizer, event.terms.doorKey)
          looked = true
        }
        // Only codes above the last one used work, so show the next.
        const next = event.lastCheckInCode + 1n
        const isOpen = !event.isCancelled && now < event.terms.checkInEndsAt
        if (doorKey && isOpen && (!shown || shown.code !== next || now - shown.shownAt >= REFRESH_SECONDS)) {
          shown = { code: next, shownAt: now, text: encodeCheckInCode(await signCheckInCode(doorKey, address, next, now)) }
        }
        if (!stopped) setDoor({ event, now, hasDoorKey: doorKey !== undefined, shown: isOpen ? shown : undefined })
      } catch (caught) {
        if (!stopped) setDoor((current) => current && { ...current, problem: describeError(caught) })
      } finally {
        if (!stopped) timer = setTimeout(poll, POLL_EVERY_MS)
      }
    }
    poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [eventAddress])

  const secondsLeft = door?.shown ? Math.max(0, Number(REFRESH_SECONDS - (door.now - door.shown.shownAt))) : 0
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.ink }}>
      <View className="flex-row items-center px-3" style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/host'))}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)' }}
          className="items-center justify-center"
        >
          <ChevronLeft color={colors.paper} size={26} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.small, fontFamily: fonts.bold, color: colors.skyDk }}>Door</Text>
          <Text numberOfLines={1} style={{ ...type.strong, color: colors.paper }}>
            {door?.event.terms.title ?? '…'}
          </Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center" style={{ gap: 24, padding: 24 }}>
        {error || !eventAddress ? (
          <Text style={{ ...type.body, color: colors.paper }}>{error ?? "This isn't a Veni event."}</Text>
        ) : !door ? (
          <Text style={{ ...type.body, color: colors.skyDk }}>Opening the door…</Text>
        ) : !door.hasDoorKey ? (
          <Text style={{ ...type.body, color: colors.paper, textAlign: 'center' }}>{"This phone doesn't hold this event's door key. Open the door from the phone that created it."}</Text>
        ) : !door.shown ? (
          <Text style={{ ...type.body, color: colors.paper }}>Check-in has closed.</Text>
        ) : (
          <>
            <View style={{ padding: 18, borderRadius: radius.cover, backgroundColor: colors.paper }}>
              <QrCode text={door.shown.text} size={250} />
            </View>
            <View style={{ width: 286, gap: 8 }}>
              <View className="flex-row justify-between">
                <Text style={{ ...type.small, color: colors.skyDk }}>New code in</Text>
                <Text style={{ ...type.small, fontFamily: fonts.bold, color: colors.paper }}>{secondsLeft} s</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <View style={{ width: `${(secondsLeft / Number(REFRESH_SECONDS)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.orange }} />
              </View>
            </View>
          </>
        )}
        {door ? (
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 56, color: colors.tealOnInk }}>{door.event.attendedCount}</Text>
            <View>
              <Text style={{ ...type.strong, color: colors.paper }}>checked in</Text>
              <Text style={{ ...type.small, color: colors.skyDk }}>of {door.event.guestCount} going</Text>
            </View>
          </View>
        ) : null}
        {door?.problem ? <Text style={{ ...type.small, color: colors.skyDk }}>{door.problem}</Text> : null}
      </View>
      <Text style={{ ...type.small, color: colors.skyDk, textAlign: 'center', paddingBottom: 16 }}>Guests scan this with Veni.</Text>
    </SafeAreaView>
  )
}
