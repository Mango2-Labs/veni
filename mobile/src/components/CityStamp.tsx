import { Text, View } from 'react-native'
import { fonts } from '@/lib/theme'

/** A dashed ring with the city and date, turned like a stamp. */
export function CityStamp({ city, date, color, background }: { city: string; date: string; color: string; background?: string }) {
  const long = city.length > 7
  return (
    <View
      accessible={false}
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: color,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-10deg' }],
      }}
    >
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 8, color }}>{date}</Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.display, fontSize: long ? 8.5 : 11, color, maxWidth: 62, textAlign: 'center' }}
      >
        {city}
      </Text>
    </View>
  )
}
