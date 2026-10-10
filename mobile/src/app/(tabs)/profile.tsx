import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { TabScreen } from '@/components/Screen'
import { useMyUsername } from '@/lib/username'
import { colors, radius, type } from '@/lib/theme'

export default function Profile() {
  const router = useRouter()
  const { data } = useMyUsername()
  const changeableAt = data?.changeableAt ? new Date(data.changeableAt) : undefined
  const canChange = !changeableAt || changeableAt.getTime() <= Date.now()

  return (
    <TabScreen title="Profile">
      <View style={{ borderRadius: radius.cover }} className="flex-row items-center gap-4 bg-ink p-5">
        <Avatar username={data?.username} size={64} />
        <Text style={{ ...type.title, color: colors.paper, flex: 1 }}>{data?.username ?? '…'}</Text>
      </View>
      {canChange ? <Button label="Change username" variant="secondary" onPress={() => router.push('/username')} /> : null}
    </TabScreen>
  )
}
