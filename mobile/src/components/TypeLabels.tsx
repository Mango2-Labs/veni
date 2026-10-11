import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Check, ShieldCheck, Ticket } from 'lucide-react-native'
import { colors, fonts, radius } from '@/lib/theme'

/** Free or paid, and whether the host approves guests, on the cover's top-left. */
export function TypeLabels({ ticket, approval, inset = 14 }: { ticket?: string; approval?: boolean; inset?: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ position: 'absolute', left: inset, top: inset, right: 100, gap: 6 }}>
      {ticket ? (
        <Label icon={<Ticket color={colors.ink} size={14} strokeWidth={2.4} />} text={`Paid · ${ticket}`} />
      ) : (
        <Label icon={<Check color={colors.ink} size={14} strokeWidth={2.6} />} text="Free" />
      )}
      {approval ? <Label icon={<ShieldCheck color={colors.ink} size={14} strokeWidth={2.4} />} text="Approval required" /> : null}
    </View>
  )
}

function Label({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View
      className="flex-row items-center gap-1"
      style={{ backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 4 }}
    >
      {icon}
      <Text style={{ fontFamily: fonts.heavy, fontSize: 13, color: colors.ink }}>{text}</Text>
    </View>
  )
}
