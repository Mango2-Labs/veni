import { useState, type ReactNode } from 'react'
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, MapPin, UsersRound } from 'lucide-react-native'
import { isAddress, type Address } from '@solana/kit'
import { TEST_USD_MINT, type Event as EventAccount } from '@veni/client'
import {
  coverIndexOf,
  coverOf,
  decodeCheckInCode,
  describeError,
  fetchTokenBalance,
  formatUsd,
  formatUsdShort,
  getCheckInWithCodeInstructions,
  locationOf,
  lumaLinkOf,
  mapsLink,
  relativeTime,
  STAGE_LABEL,
  stageOf,
  stampDateOf,
} from '@veni/sdk'
import { shortAddress } from '@/components/AccountMenu'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Chip } from '@/components/Chip'
import { TypeLabels } from '@/components/TypeLabels'
import { CityStamp } from '@/components/CityStamp'
import { COVERS, initialsOf } from '@/components/EventCard'
import { DoorScanner } from '@/components/DoorScanner'
import { hasDismissedStakeNotice, StakeNotice } from '@/components/StakeNotice'
import { requestTestFunds } from '@/lib/api'
import { reader, tokenLabel } from '@/lib/balances'
import { eventKey, useDescription, useEventSnapshot, useHostPage } from '@/lib/event'
import { photoUrl, usePeople } from '@/lib/people'
import { useVeniClient, useWallet } from '@/lib/wallet'
import { colors, fonts, radius, type } from '@/lib/theme'

type Snapshot = NonNullable<ReturnType<typeof useEventSnapshot>['data']>

export default function EventPage() {
  const { address } = useLocalSearchParams<{ address: string }>()
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <BackBar />
      {isAddress(address) ? <EventScreen address={address} /> : <Notice title="This isn't a Veni event" text="Check the link you were sent." />}
    </SafeAreaView>
  )
}

function BackBar() {
  const router = useRouter()
  return (
    <View className="px-3 pb-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
        style={{ width: 44, height: 44, borderRadius: 22 }}
        className="items-center justify-center active:bg-sky"
      >
        <ChevronLeft color={colors.ink} size={26} />
      </Pressable>
    </View>
  )
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <View className="gap-3 px-6 pt-10">
      <Text style={type.title}>{title}</Text>
      <Text style={type.body}>{text}</Text>
      {children}
    </View>
  )
}

function EventScreen({ address }: { address: Address }) {
  const snapshot = useEventSnapshot(address)
  if (snapshot.isPending) return <Text style={{ ...type.body, padding: 24 }}>Loading the event…</Text>
  if (snapshot.isError) {
    return (
      <Notice title="Couldn't load the event" text={describeError(snapshot.error)}>
        <Button label="Try again" variant="secondary" onPress={() => snapshot.refetch()} />
      </Notice>
    )
  }
  if (!snapshot.data) return <Notice title="This event is over" text="Everyone has been paid." />
  return <EventView address={address} snapshot={snapshot.data} />
}

function EventView({ address, snapshot }: { address: Address; snapshot: Snapshot }) {
  const { event, now } = snapshot
  const { terms, details } = event
  const stage = stageOf(event, now)
  const cover = coverOf(event)
  const tone = COVERS[coverIndexOf(address, { paid: terms.ticketPrice > 0n, approval: terms.requiresApproval })]
  const location = locationOf(event)
  const luma = lumaLinkOf(event)
  const description = useDescription(address, event)
  const startsAt = new Date(Number(terms.rsvpEndsAt) * 1000)
  const doorOpen = stage === 'open' || stage === 'running'

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 18 }}>
      <View style={{ borderRadius: radius.cover, overflow: 'hidden', height: 210, padding: 20, justifyContent: 'flex-end', backgroundColor: cover ? colors.ink : tone.background }}>
        {cover ? (
          <Image source={{ uri: cover }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
        ) : (
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.8, color: tone.color }}>
            {terms.title}
          </Text>
        )}
        <TypeLabels ticket={terms.ticketPrice > 0n ? formatUsdShort(terms.ticketPrice) : undefined} approval={terms.requiresApproval} inset={16} />
        <View style={{ position: 'absolute', right: 16, top: 16 }}>
          <CityStamp city={details.city} date={stampDateOf(startsAt)} color={cover ? colors.ink : tone.color} background={cover ? 'rgba(255,255,255,0.92)' : undefined} />
        </View>
      </View>
      {cover ? (
        <Text accessibilityRole="header" style={type.title}>
          {terms.title}
        </Text>
      ) : null}
      <View className="flex-row">
        <Chip label={STAGE_LABEL[stage]} tone={`stage-${stage}`} />
      </View>

      <HostRow event={event} />

      <View style={{ gap: 14 }}>
        <Detail icon={<CalendarDays color={colors.ink} size={22} />} title={formatWhen(startsAt)}>
          {stage === 'open' ? `Starts ${relativeTime(terms.rsvpEndsAt, now)}` : `Started ${relativeTime(terms.rsvpEndsAt, now)}`}
          {doorOpen ? ` · check-in closes ${relativeTime(terms.checkInEndsAt, now)}` : ''}
        </Detail>
        <Detail icon={<MapPin color={colors.ink} size={22} />} title={details.venue}>
          {details.city}
          {location ? (
            <Text style={{ fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(mapsLink(location))}>
              {' · Open in Maps'}
            </Text>
          ) : null}
        </Detail>
        <Detail icon={<UsersRound color={colors.ink} size={22} />} title={`${event.guestCount} of ${terms.capacity} going`}>
          {event.attendedCount} checked in
          {terms.requiresApproval ? ` · ${event.applicantCount} waiting for approval` : ''}
        </Detail>
      </View>

      {description.data ? <Text style={type.body}>{description.data}</Text> : null}
      {luma ? (
        <Text accessibilityRole="link" style={{ ...type.label, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(luma)}>
          Full details on Luma →
        </Text>
      ) : null}

      <StakeCard event={event} />
      <GuestActions address={address} snapshot={snapshot} />
      <Guests snapshot={snapshot} />
    </ScrollView>
  )
}

function Detail({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <View className="flex-row gap-3">
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.sky }} className="items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text style={type.strong}>{title}</Text>
        <Text style={type.small}>{children}</Text>
      </View>
    </View>
  )
}

function HostRow({ event }: { event: EventAccount }) {
  const host = useHostPage(event.organizer)
  const people = usePeople([event.organizer])
  let record = ''
  if (host.data) {
    const { profile, record: past } = host.data
    const turnout = past.guestCount > 0 ? ` · ${Math.round((past.attendedCount / past.guestCount) * 100)}% of guests show up` : ''
    record = !profile
      ? 'Not registered on Veni yet'
      : past.eventCount === 0
        ? 'Registered host · first event on Veni'
        : `${past.eventCount} ${past.eventCount === 1 ? 'event' : 'events'} hosted${turnout}`
  }
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: colors.ink, padding: 16 }} className="flex-row items-center gap-3">
      <Avatar initials={initialsOf(event.details.hostName)} photo={photoUrl(event.organizer, people.data?.photos?.[event.organizer])} size={48} />
      <View className="flex-1">
        <Text style={{ ...type.strong, color: colors.paper }}>{event.details.hostName}</Text>
        <Text style={{ ...type.small, color: colors.sky }}>{record || ' '}</Text>
      </View>
    </View>
  )
}

function Guests({ snapshot }: { snapshot: Snapshot }) {
  const { event, guests, now } = snapshot
  const { account } = useWallet()
  const approved = guests.filter((guest) => guest.data.isApproved)
  const people = usePeople(approved.map((guest) => guest.data.wallet))
  const stage = stageOf(event, now)
  return (
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={type.heading}>
        Guests
      </Text>
      {approved.length === 0 ? (
        <Text style={type.small}>{event.terms.requiresApproval ? 'Nobody is approved yet.' : 'Nobody has signed up yet.'}</Text>
      ) : null}
      {approved.map(({ address: key, data: { wallet, hasAttended } }) => {
        const username = people.data?.usernames?.[wallet]
        const [label, tone] = hasAttended
          ? ['Checked in', 'stage-running']
          : stage === 'open' || stage === 'running'
            ? ['Going', 'stage-open']
            : refundsEveryone(event, stage)
              ? ['Refund due', 'stage-open']
              : ['Missed', 'stage-cancelled']
        return (
          <View key={key} className="flex-row items-center gap-3" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 10 }}>
            <Avatar username={username} photo={photoUrl(wallet, people.data?.photos?.[wallet])} size={32} />
            <Text style={{ ...type.strong, flex: 1 }} numberOfLines={1}>
              {username ?? shortAddress(wallet)}
              {wallet === account?.address ? <Text style={type.small}> (you)</Text> : null}
            </Text>
            <Chip label={label} tone={tone} />
          </View>
        )
      })}
    </View>
  )
}

/** Cancelled, or nobody checked in: every guest gets their whole stake back. */
function refundsEveryone(event: EventAccount, stage: ReturnType<typeof stageOf>) {
  return stage === 'cancelled' || stage === 'refunding' || (stage === 'ended' && event.attendedCount === 0)
}

function totalOf(event: EventAccount) {
  return event.terms.stakeAmount + event.terms.ticketPrice
}

/** Both outcomes of the stake, and Veni's 10%, before any button that moves money. */
function StakeCard({ event }: { event: EventAccount }) {
  const stake = formatUsdShort(event.terms.stakeAmount)
  const paid = event.terms.ticketPrice > 0n
  const applying = event.terms.requiresApproval
  const verb = applying ? 'apply' : 'sign up'
  const outcomes = [
    { lead: 'You come', text: `${stake} back + a share of no-shows`, color: colors.tealText, background: colors.tealSoft },
    { lead: "You don't", text: `${stake} goes to those who came`, color: colors.orangeText, background: colors.orangeSoft },
    ...(applying ? [{ lead: 'Not picked', text: `${formatUsdShort(totalOf(event))} back`, color: colors.ink, background: colors.sky }] : []),
  ]
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12 }}>
      <View className="flex-row items-baseline justify-between">
        <Text style={type.strong}>{paid ? `To ${verb}` : `Stake to ${verb}`}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>
          {formatUsdShort(totalOf(event))} <Text style={{ ...type.small, fontFamily: fonts.bold }}>{tokenLabel(event.stakeMint)}</Text>
        </Text>
      </View>
      {paid ? (
        <Text style={type.small}>
          {formatUsdShort(event.terms.ticketPrice)} ticket + {stake} stake
        </Text>
      ) : null}
      <View style={{ gap: 8 }}>
        {outcomes.map(({ lead, text, color, background }) => (
          <View key={lead} style={{ borderRadius: 12, backgroundColor: background, padding: 12 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color }}>{lead}</Text>
            <Text style={{ ...type.small, color: colors.ink2 }}>{text}</Text>
          </View>
        ))}
      </View>
      <Text style={type.small}>Veni keeps 10% of no-show stakes{paid ? ', and nothing from tickets' : ''}.</Text>
    </View>
  )
}

function GuestActions({ address, snapshot }: { address: Address; snapshot: Snapshot }) {
  const { event, guests, now } = snapshot
  const { terms } = event
  const queryClient = useQueryClient()
  const { account } = useWallet()
  const client = useVeniClient()
  const wallet = account?.address
  const balance = useQuery({
    queryKey: ['token', wallet, event.stakeMint],
    queryFn: () => fetchTokenBalance(reader, wallet!, event.stakeMint),
    enabled: Boolean(wallet),
  })
  const [busy, setBusy] = useState<string>()
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  if (!wallet || !client) return null

  const stage = stageOf(event, now)
  const total = totalOf(event)
  const me = guests.find((guest) => guest.data.wallet === wallet)
  const isHost = wallet === event.organizer
  const applying = terms.requiresApproval
  const myApplication = me && !me.data.isApproved ? me : undefined
  const myGuest = me?.data.isApproved ? me : undefined
  const canSignUp = stage === 'open' && !isHost && !me && event.guestCount < terms.capacity
  const full = stage === 'open' && !isHost && !me && event.guestCount >= terms.capacity
  const going = (stage === 'open' || stage === 'running') && myGuest && !myGuest.data.hasAttended
  const refundsAll = refundsEveryone(event, stage)
  const missed = (stage === 'ended' || stage === 'settled') && !refundsAll && myGuest && !myGuest.data.hasAttended
  const notEnough = balance.data !== undefined && balance.data < total
  const signUpLabel = `${terms.ticketPrice > 0n ? 'Pay' : 'Stake'} ${formatUsdShort(total)} and ${applying ? 'apply' : 'sign up'}`

  // A message only when the page doesn't already show the result.
  async function run(action: string, work: () => Promise<string | void>) {
    setBusy(action)
    setMessage(undefined)
    try {
      const text = await work()
      if (text) setMessage({ ok: true, text })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (error) {
      setMessage({ ok: false, text: describeError(error) })
    } finally {
      setBusy(undefined)
      queryClient.invalidateQueries({ queryKey: eventKey(address) })
      queryClient.invalidateQueries({ queryKey: ['token', wallet] })
      queryClient.invalidateQueries({ queryKey: ['balances', wallet] })
    }
  }

  const signUp = () =>
    run('signUp', async () => {
      await client.veni.instructions.signUp({ wallet: client.identity, event: address, stakeMint: event.stakeMint }).sendTransaction()
    })

  return (
    <View style={{ gap: 12 }}>
      {isHost ? <Text style={type.strong}>You're hosting this event.</Text> : null}

      {canSignUp ? (
        <>
          <Text style={type.body}>
            You have{' '}
            <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{balance.data === undefined ? '…' : formatUsd(balance.data)}</Text>{' '}
            {tokenLabel(event.stakeMint)}
          </Text>
          <Button
            label={signUpLabel}
            busy={busy === 'signUp'}
            disabled={busy !== undefined || notEnough}
            onPress={async () => ((await hasDismissedStakeNotice()) ? signUp() : setNoticeOpen(true))}
          />
          {notEnough && event.stakeMint === TEST_USD_MINT ? (
            <Button
              label="Get test funds"
              variant="secondary"
              busy={busy === 'funds'}
              disabled={busy !== undefined}
              onPress={() =>
                run('funds', async () => {
                  await requestTestFunds(wallet)
                  return 'Sent 50 Test USD.'
                })
              }
            />
          ) : notEnough ? (
            <Text style={type.small}>Not enough {tokenLabel(event.stakeMint)}.</Text>
          ) : null}
          <StakeNotice
            open={noticeOpen}
            stake={formatUsdShort(terms.stakeAmount)}
            ticket={terms.ticketPrice > 0n ? formatUsdShort(terms.ticketPrice) : undefined}
            isApplying={applying}
            confirmLabel={signUpLabel}
            onConfirm={() => {
              setNoticeOpen(false)
              signUp()
            }}
            onCancel={() => setNoticeOpen(false)}
          />
        </>
      ) : null}

      {full ? <Text style={type.body}>This event is full.</Text> : null}

      {myApplication && stage === 'open' ? (
        <>
          <Note>
            <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>Waiting for the host.</Text> Not picked? Your {formatUsd(total)} comes back.
          </Note>
          <Button
            label="Withdraw my application"
            variant="secondary"
            busy={busy === 'withdraw'}
            disabled={busy !== undefined}
            onPress={() =>
              run('withdraw', async () => {
                await client.veni.instructions
                  .removeApplication({ remover: client.identity, event: address, wallet, stakeMint: event.stakeMint })
                  .sendTransaction()
              })
            }
          />
        </>
      ) : null}
      {myApplication && stage !== 'open' ? <Note>Not picked. Your {formatUsd(total)} is on its way back.</Note> : null}

      {going ? (
        <>
          <Note>
            <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>You're going.</Text> At the door, scan the code to check in.
          </Note>
          <Button label="Scan the door code" busy={busy === 'checkIn'} disabled={busy !== undefined} onPress={() => setScanning(true)} />
          <DoorScanner
            open={scanning}
            onCancel={() => setScanning(false)}
            onRead={(text) => {
              setScanning(false)
              run('checkIn', async () => {
                const code = decodeCheckInCode(text)
                if (code.event !== address) throw new Error('That code is for another event. Scan the code at this door.')
                if (code.signer !== terms.doorKey && code.signer !== event.organizer) {
                  throw new Error("That code wasn't made by this event's door. Scan the code on the door screen.")
                }
                await client.sendTransaction(await getCheckInWithCodeInstructions(code, client.identity))
              })
            }}
          />
        </>
      ) : null}
      {myGuest?.data.hasAttended && !refundsAll ? <Note>You're checked in. Your stake comes back after the event.</Note> : null}
      {missed ? <Note bad>You missed it. Your stake goes to those who came.</Note> : null}
      {myGuest && refundsAll ? (
        <Note>
          {event.isCancelled ? 'Cancelled' : 'Nobody checked in'}. Your {formatUsd(total)} comes back.
        </Note>
      ) : null}

      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ ...type.body, fontFamily: fonts.semibold, color: message.ok ? colors.tealText : colors.orangeText }}>
          {message.text}
        </Text>
      ) : null}
    </View>
  )
}

function Note({ children, bad = false }: { children: ReactNode; bad?: boolean }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: bad ? colors.orangeSoft : colors.tealSoft, padding: 14 }}>
      <Text style={{ ...type.body, color: bad ? colors.orangeText : colors.ink2 }}>{children}</Text>
    </View>
  )
}

function formatWhen(date: Date) {
  return date.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
