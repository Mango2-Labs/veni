import { Pressable, Text, View } from 'react-native'
import { colors, fonts, radius } from '@/lib/theme'

/** A two-or-more way switch between parts of a screen. A dot marks a tab with something waiting. */
export function Tabs<Key extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: Key; label: string; dot?: string }[]
  value: Key
  onChange: (value: Key) => void
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row bg-sky" style={{ borderRadius: radius.button, padding: 4, gap: 4 }}>
      {tabs.map(({ key, label, dot }) => {
        const selected = value === key
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={{ flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.paper : 'transparent' }}
          >
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Text style={{ fontFamily: selected ? fonts.heavy : fonts.bold, fontSize: 14, color: selected ? colors.ink : colors.ink2 }}>{label}</Text>
              {dot ? <View accessibilityLabel={dot} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange }} /> : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
