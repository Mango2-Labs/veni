import { Text, View } from 'react-native'
import { colors, fonts, radius } from '@/lib/theme'

const TONES: Record<string, { background: string; color: string }> = {
  'stage-open': { background: colors.sky, color: colors.ink },
  'stage-running': { background: colors.tealSoft, color: colors.tealText },
  'stage-ended': { background: colors.sky, color: colors.ink2 },
  'stage-settled': { background: colors.tealSoft, color: colors.tealText },
  'stage-refunding': { background: colors.orangeSoft, color: colors.orangeText },
  'stage-cancelled': { background: colors.orangeSoft, color: colors.orangeText },
  'stage-example': { background: colors.goldSoft, color: colors.goldInk },
}

export function Chip({ label, tone }: { label: string; tone: string }) {
  const { background, color } = TONES[tone] ?? TONES['stage-open']
  return (
    <View style={{ backgroundColor: background, borderRadius: radius.chip, paddingHorizontal: 11, paddingVertical: 5 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color }}>{label}</Text>
    </View>
  )
}
