import { Text, View } from 'react-native'
import { fonts } from '@/lib/theme'

export function CityStamp({ city, date, color, background, size = 72 }: { city: string; date: string; color: string; background?: string; size?: number }) {
  const long = city.length > 6
  const scale = size / 72
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: color,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-10deg' }],
      }}
    >
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 8 * scale, color }}>{date}</Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.display, fontSize: (long ? 8.5 : 11) * scale, color, maxWidth: 62 * scale, textAlign: 'center' }}
      >
        {city}
      </Text>
    </View>
  )
}
