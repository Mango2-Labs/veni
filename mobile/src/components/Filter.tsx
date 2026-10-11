import { Pressable, Text } from 'react-native'
import { colors, fonts } from '@/lib/theme'

/** One choice in a row of them, filled when selected. */
export function Filter({ label, count, selected = false, onPress }: { label: string; count?: number; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: selected ? colors.ink : colors.paper,
        borderWidth: selected ? 0 : 1.5,
        borderColor: colors.line,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: selected ? colors.paper : colors.ink }}>
        {label}
        {count === undefined ? null : <Text style={{ color: colors.muted }}>{`  ${count}`}</Text>}
      </Text>
    </Pressable>
  )
}
