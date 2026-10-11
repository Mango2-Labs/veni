import { useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'
import { mapImageUrl, mapsLink, type MapPoint } from '@veni/sdk'
import { VENI_URL } from '@/lib/config'
import { colors, radius, type } from '@/lib/theme'

// OpenStreetMap's own tiles, as images, when Google's map isn't there. Its policy asks apps to name themselves.
const TILE = 256
const ZOOM = 16
const tile = (x: number, y: number) => ({ uri: `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`, headers: { 'User-Agent': 'Veni (https://veni-phi.vercel.app)' } })

/** Where a point falls on the zoomed world map, in pixels. */
function worldPixels({ latitude, longitude }: MapPoint) {
  const size = TILE * 2 ** ZOOM
  const sin = Math.sin((latitude * Math.PI) / 180)
  return { x: ((longitude + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size }
}

/** A small map centered on the pin: Google's, through Veni's site, or OpenStreetMap's. Tapping it opens Google Maps there. */
export function MapPreview({ point, height = 160 }: { point: MapPoint; height?: number }) {
  const [width, setWidth] = useState(0)
  const [googleFailed, setGoogleFailed] = useState(false)
  const center = worldPixels(point)
  const left = center.x - width / 2
  const top = center.y - height / 2
  const tiles: { x: number; y: number }[] = []
  for (let x = Math.floor(left / TILE); x * TILE < left + width; x++) {
    for (let y = Math.floor(top / TILE); y * TILE < top + height; y++) tiles.push({ x, y })
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Open the map"
      onPress={() => Linking.openURL(mapsLink(point))}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.sky }}
    >
      {width > 0 && !googleFailed ? (
        <Image source={{ uri: mapImageUrl(VENI_URL, point, width, height) }} onError={() => setGoogleFailed(true)} style={{ width, height }} />
      ) : null}
      {googleFailed ? (
        <>
          {tiles.map(({ x, y }) => (
            <Image
              key={`${x}-${y}`}
              source={tile(x, y)}
              style={{ position: 'absolute', left: x * TILE - left, top: y * TILE - top, width: TILE, height: TILE }}
            />
          ))}
          <View
            style={{ position: 'absolute', left: width / 2 - 11, top: height / 2 - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 4, borderColor: colors.paper, backgroundColor: colors.orange }}
          />
          <Text style={{ ...type.small, fontSize: 10, position: 'absolute', right: 6, bottom: 4, color: colors.ink2 }}>© OpenStreetMap</Text>
        </>
      ) : null}
    </Pressable>
  )
}
