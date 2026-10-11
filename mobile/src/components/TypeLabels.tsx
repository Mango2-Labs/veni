import { Text, View } from 'react-native'
import { colors, fonts, radius } from '@/lib/theme'

/** Free or paid, and whether the host approves guests, on the cover's top-left. */
export function TypeLabels({ ticket, approval, inset = 14 }: { ticket?: string; approval?: boolean; inset?: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ position: 'absolute', left: inset, top: inset, right: 100, gap: 6 }}>
      {ticket ? <Label text={`Paid · ${ticket}`} background={colors.gold} color={colors.ink} /> : <Label text="Free" background={colors.tealSoft} color={colors.tealText} />}
      {approval ? <Label text="Approval required" background={colors.ink} color={colors.paper} /> : null}
    </View>
  )
}

// The white edge keeps a label visible on a cover of its own color.
function Label({ text, background, color }: { text: string; background: string; color: string }) {
  return (
    <View style={{ backgroundColor: background, borderRadius: radius.chip, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 13, color }}>{text}</Text>
    </View>
  )
}
