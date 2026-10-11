import { ActivityIndicator, Pressable, Text } from 'react-native'
import { colors, fonts, radius } from '@/lib/theme'

type Props = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  busy?: boolean
  disabled?: boolean
}

export function Button({ label, onPress, variant = 'primary', busy = false, disabled = false }: Props) {
  const primary = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ borderRadius: radius.button }}
      className={`min-h-14 flex-row items-center justify-center px-6 ${primary ? 'bg-orange active:bg-orange-dk' : 'border-2 border-ink bg-paper active:bg-sky'} ${disabled ? 'opacity-50' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{label}</Text>
      )}
    </Pressable>
  )
}
