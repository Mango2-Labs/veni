import { Text } from 'react-native'
import { TabScreen } from '@/components/Screen'
import { type } from '@/lib/theme'

export default function Host() {
  return (
    <TabScreen title="Host">
      <Text style={type.body}>Your events show here.</Text>
    </TabScreen>
  )
}
