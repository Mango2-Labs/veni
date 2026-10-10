import { Text, View } from 'react-native'
import { usernameInitials } from '@veni/sdk'
import { colors, fonts } from '@/lib/theme'

/** A person's face until people have photos: their initials on stamp orange. */
export function Avatar({ username, size = 40 }: { username: string | undefined; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.orange }}
      className="items-center justify-center"
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.36, color: colors.ink }}>
        {username ? usernameInitials(username) : '…'}
      </Text>
    </View>
  )
}
