import { Text } from 'react-native'
import { TabScreen } from '@/components/Screen'
import { type } from '@/lib/theme'

export default function Explore() {
  return (
    <TabScreen title="Find events">
      <Text style={type.body}>Events load here next.</Text>
    </TabScreen>
  )
}
