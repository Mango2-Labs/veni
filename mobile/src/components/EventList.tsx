import { useRouter } from 'expo-router'
import type { Address } from '@solana/kit'
import type { EventCardData } from '@veni/sdk'
import { EventCard } from './EventCard'
import { photoUrl, usePeople } from '@/lib/people'

/** Event cards with their hosts' faces; live events open their page. */
export function EventList({ cards }: { cards: EventCardData[] }) {
  const router = useRouter()
  const hosts = usePeople(cards.flatMap((card) => (card.organizer ? [card.organizer as Address] : [])))
  return cards.map((card) => (
    <EventCard
      key={card.key}
      event={card}
      hostPhoto={card.organizer ? photoUrl(card.organizer, hosts.data?.photos?.[card.organizer]) : undefined}
      onPress={card.href ? () => router.push(card.href as `/e/${string}`) : undefined}
    />
  ))
}
