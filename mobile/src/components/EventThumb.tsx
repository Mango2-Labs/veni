import { Image, Text, View } from 'react-native'
import { coverIndexOf, isCoverUrl } from '@veni/sdk'
import { COVERS, initialsOf } from './EventCard'
import { fonts } from '@/lib/theme'

const SIZE = 62

/** An event's poster, or its card's colored cover with the title's initials. Faded for one the viewer missed. */
export function EventThumb({ cover, title, seed, faded = false }: { cover?: string; title: string; seed: string; faded?: boolean }) {
  const color = COVERS[coverIndexOf(seed)]
  return (
    <View
      style={{ width: SIZE, height: SIZE, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: color.background, opacity: faded ? 0.45 : 1 }}
    >
      {isCoverUrl(cover) ? (
        <Image source={{ uri: cover }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: color.color }}>{initialsOf(title)}</Text>
      )}
    </View>
  )
}
