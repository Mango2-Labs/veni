import { Text } from 'react-native'
import { TabScreen } from '@/components/Screen'
import { type } from '@/lib/theme'

export default function Going() {
  return (
    <TabScreen title="Going">
      <Text style={type.body}>Nothing yet. Find an event.</Text>
    </TabScreen>
  )
}
