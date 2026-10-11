import { Pressable, Text } from 'react-native'
import { colors, fonts } from '@/lib/theme'

/** One choice in a row of them, filled when selected. */
export function Filter({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: selected ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  )
}
