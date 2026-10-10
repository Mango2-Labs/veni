import { useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Redirect } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/Button'
import { LogoMark } from '@/components/Logo'
import { useMyUsername } from '@/lib/username'
import { useWallet } from '@/lib/wallet'
import { colors, fonts, type } from '@/lib/theme'

/** Welcome until a wallet connects; then the username step, or the app. */
export default function Start() {
  const { account } = useWallet()
  const username = useMyUsername()

  if (!account) return <Welcome />
  if (username.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={colors.ink} />
      </View>
    )
  }
  if (username.isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View className="flex-1 justify-center gap-4 px-6">
          <Text style={type.title}>Couldn't load your account</Text>
          <Text style={type.body}>{username.error.message}</Text>
          <Button label="Try again" onPress={() => username.refetch()} />
        </View>
      </SafeAreaView>
    )
  }
  return <Redirect href={username.data.username ? '/explore' : '/username'} />
}

function Welcome() {
  const { connect } = useWallet()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string>()

  async function onConnect() {
    setConnecting(true)
    setError(undefined)
    try {
      await connect()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />
      <View className="flex-1 justify-between px-6 pb-6 pt-10">
        <View className="flex-row items-center gap-3">
          <LogoMark size={36} color={colors.paper} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 28, color: colors.paper }}>veni</Text>
        </View>
        <View className="gap-4">
          <Text style={{ ...type.hero, color: colors.paper }}>Find crypto events near you</Text>
          <Text style={{ ...type.body, fontSize: 17, lineHeight: 25, color: colors.sky }}>
            Stake a few dollars to sign up. Show up, scan the door, and get it back with a share of what the no-shows staked.
          </Text>
        </View>
        <View className="gap-3">
          {error ? (
            <Text accessibilityRole="alert" style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.gold }}>
              {error}
            </Text>
          ) : null}
          <Button label="Connect wallet" onPress={onConnect} busy={connecting} />
          <Text style={{ ...type.small, fontSize: 13, color: colors.sky, textAlign: 'center' }}>
            Test mode: the money isn't real.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
