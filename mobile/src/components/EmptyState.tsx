import { Text, View } from 'react-native'
import { Button } from './Button'
import { type } from '@/lib/theme'

/** A screen with nothing to list yet: one line and its next step, in the middle. */
export function EmptyState({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    // The bottom padding lifts it to where the eye reads as the middle.
    <View style={{ flex: 1, justifyContent: 'center', gap: 16, paddingBottom: 64 }}>
      <Text style={{ ...type.heading, textAlign: 'center' }}>{title}</Text>
      <Button label={action} onPress={onPress} />
    </View>
  )
}
