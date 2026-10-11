import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { colors, radius, type } from '@/lib/theme'

/** A dashed card at the end of a list that starts something new. */
export function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineDk, padding: 28 }}
      className="items-center gap-3 active:bg-sky"
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange }} className="items-center justify-center">
        <Plus color={colors.ink} size={26} strokeWidth={2.6} />
      </View>
      <Text style={type.heading}>{label}</Text>
    </Pressable>
  )
}
