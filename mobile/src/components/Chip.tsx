import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Check, ShieldCheck, Ticket } from 'lucide-react-native'
import { colors, fonts, radius } from '@/lib/theme'

const TONES: Record<string, { background: string; color: string; border?: string }> = {
  'stage-open': { background: colors.sky, color: colors.ink },
  'stage-running': { background: colors.tealSoft, color: colors.tealText },
  'stage-ended': { background: colors.sky, color: colors.ink2 },
  'stage-settled': { background: colors.tealSoft, color: colors.tealText },
  'stage-refunding': { background: colors.orangeSoft, color: colors.orangeText },
  'stage-cancelled': { background: colors.orangeSoft, color: colors.orangeText },
  'stage-example': { background: colors.goldSoft, color: colors.goldInk },
  'stage-free': { background: colors.tealSoft, color: colors.tealText },
  'stage-paid': { background: colors.paper, color: colors.ink, border: colors.ink },
  'stage-approval': { background: colors.ink, color: colors.paper },
}

export function Chip({ label, tone, icon }: { label: string; tone: string; icon?: (color: string) => ReactNode }) {
  const { background, color, border } = TONES[tone] ?? TONES['stage-open']
  return (
    <View
      className="flex-row items-center gap-1"
      style={{ backgroundColor: background, borderRadius: radius.chip, borderWidth: border ? 1.5 : 0, borderColor: border, paddingHorizontal: 10, paddingVertical: 4 }}
    >
      {icon?.(color)}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color }}>{label}</Text>
    </View>
  )
}

export function TypeChips({ ticket, approval }: { ticket?: string; approval?: boolean }) {
  return (
    <>
      {ticket ? (
        <Chip label={`Paid · ${ticket}`} tone="stage-paid" icon={(color) => <Ticket color={color} size={14} strokeWidth={2.4} />} />
      ) : (
        <Chip label="Free" tone="stage-free" icon={(color) => <Check color={color} size={14} strokeWidth={2.6} />} />
      )}
      {approval ? <Chip label="Host approves" tone="stage-approval" icon={(color) => <ShieldCheck color={color} size={14} strokeWidth={2.4} />} /> : null}
    </>
  )
}
