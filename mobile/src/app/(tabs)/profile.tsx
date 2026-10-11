import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react-native'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { TabScreen } from '@/components/Screen'
import { photoUrl } from '@/lib/people'
import { pickAndSavePhoto } from '@/lib/photos'
import { myUsernameKey, useMyUsername } from '@/lib/username'
import { useWallet } from '@/lib/wallet'
import { colors, radius, type } from '@/lib/theme'

export default function Profile() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { account, signMessages } = useWallet()
  const { data } = useMyUsername()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const changeableAt = data?.changeableAt ? new Date(data.changeableAt) : undefined
  const canChange = !changeableAt || changeableAt.getTime() <= Date.now()
  if (!account) return null

  async function changePhoto() {
    setSaving(true)
    setError(undefined)
    try {
      if (await pickAndSavePhoto(account!.address, signMessages)) {
        await queryClient.invalidateQueries({ queryKey: myUsernameKey(account!.address) })
        queryClient.invalidateQueries({ queryKey: ['people'] })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TabScreen title="Profile">
      <View style={{ borderRadius: radius.cover }} className="flex-row items-center gap-4 bg-ink p-5">
        <Pressable accessibilityRole="button" accessibilityLabel="Change your photo" disabled={saving} onPress={changePhoto}>
          <Avatar username={data?.username} photo={photoUrl(account.address, data?.photo)} size={64} />
          <View
            style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink }}
            className="items-center justify-center"
          >
            {saving ? <ActivityIndicator size="small" color={colors.ink} /> : <Camera color={colors.ink} size={13} strokeWidth={2.4} />}
          </View>
        </Pressable>
        <Text style={{ ...type.title, color: colors.paper, flex: 1 }}>{data?.username ?? '…'}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ ...type.small, color: colors.orangeText }}>{error}</Text> : null}
      {canChange ? <Button label="Change username" variant="secondary" onPress={() => router.push('/username')} /> : null}
    </TabScreen>
  )
}
