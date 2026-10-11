import { ActivityIndicator, Pressable, Text } from 'react-native'
import { colors, fonts, radius } from '@/lib/theme'

type Props = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  busy?: boolean
  disabled?: boolean
  compact?: boolean
}

export function Button({ label, onPress, variant = 'primary', busy = false, disabled = false, compact = false }: Props) {
  const primary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ borderRadius: radius.button }}
      className={`${compact ? 'min-h-10 px-4' : 'min-h-14 px-6'} flex-row items-center justify-center ${primary ? 'bg-orange active:bg-orange-dk' : 'border-2 border-ink bg-paper active:bg-sky'} ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={{ fontFamily: fonts.heavy, fontSize: compact ? 14 : 16, color: colors.ink }}>{label}</Text>
      )}
    </Pressable>
  )
}
