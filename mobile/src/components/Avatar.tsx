import { Image, Text, View } from 'react-native'
import { usernameInitials } from '@veni/sdk'
import { colors, fonts } from '@/lib/theme'

export function Avatar({ username, initials, photo, size = 40 }: { username?: string; initials?: string; photo?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.orange, overflow: 'hidden' }} className="items-center justify-center">
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontFamily: fonts.display, fontSize: size * 0.36, color: colors.ink }}>
          {initials ?? (username ? usernameInitials(username) : '?')}
        </Text>
      )}
    </View>
  )
}
