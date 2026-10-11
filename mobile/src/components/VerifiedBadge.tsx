import { View } from 'react-native'
import { BadgeCheck } from 'lucide-react-native'
import { colors } from '@/lib/theme'

/** The check beside a host Veni verified. */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <View accessible accessibilityLabel="Verified host">
      <BadgeCheck color={colors.paper} fill={colors.teal} size={size} strokeWidth={2.2} />
    </View>
  )
}
