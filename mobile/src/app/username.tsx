import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { getBase64Decoder, getUtf8Encoder } from '@solana/kit'
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  usernameMessage,
  usernameProblem,
} from '@veni/sdk'
import { Button } from '@/components/Button'
import { checkUsername, fetchMyUsername, saveUsername } from '@/lib/api'
import { myUsernameKey, useMyUsername } from '@/lib/username'
import { useWallet } from '@/lib/wallet'
import { colors, fonts, radius, type } from '@/lib/theme'

type Check = { username: string; available: boolean; problem?: string }

export default function PickUsername() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { account, disconnect, signMessages } = useWallet()
  const current = useMyUsername().data?.username
  const [value, setValue] = useState(current ?? '')
  const [check, setCheck] = useState<Check>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const username = normalizeUsername(value)
  const problem = username ? usernameProblem(username) : undefined
  const unchanged = current !== undefined && username === current

  // Asks whether it's free once typing pauses.
  useEffect(() => {
    if (!account || !username || problem || unchanged) return
    let live = true
    const timer = setTimeout(() => {
      checkUsername(username, account.address).then(
        (result) => live && setCheck({ username, ...result }),
        () => live && setCheck(undefined),
      )
    }, 300)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [account, username, problem, unchanged])

  if (!account) return null
  const wallet = account.address
  const checked = check?.username === username ? check : undefined
  const canSave = Boolean(username) && !problem && !unchanged && checked?.available === true && !saving
  const status = !username
    ? { text: `${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} letters, numbers or _, starting with a letter.`, color: colors.muted }
    : problem
      ? { text: problem, color: colors.orangeText }
      : unchanged
        ? { text: "That's your username now.", color: colors.muted }
        : !checked
          ? { text: 'Checking…', color: colors.muted }
          : checked.available
            ? { text: `${username} is free.`, color: colors.tealText }
            : { text: checked.problem ?? 'That username is taken.', color: colors.orangeText }

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError(undefined)
    try {
      const input = { wallet, username, signedAt: new Date().toISOString() }
      let signed: Uint8Array
      try {
        ;[signed] = await signMessages([getUtf8Encoder().encode(usernameMessage(input)) as Uint8Array])
      } catch {
        throw new Error("You didn't sign, so nothing was saved.")
      }
      // The wallet returns the message with its 64-byte signature at the end.
      const signature = getBase64Decoder().decode(signed.slice(-64))
      await saveUsername({ ...input, signature })
      await queryClient.fetchQuery({ queryKey: myUsernameKey(wallet), queryFn: () => fetchMyUsername(wallet) })
      router.replace('/explore')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={type.title}>
            {current ? 'Change your username' : 'Pick a username'}
          </Text>
          <View className="gap-2">
            <Text nativeID="username-label" style={type.label}>
              Username
            </Text>
            <TextInput
              accessibilityLabelledBy="username-label"
              value={value}
              // Shown as it will be saved: lowercase, without an @.
              onChangeText={(text) => setValue(text.replace(/^@/, '').toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              autoFocus
              maxLength={USERNAME_MAX_LENGTH + 1}
              returnKeyType="done"
              onSubmitEditing={save}
              className="min-h-14 border-2 border-line-dk bg-paper px-4"
              style={{ borderRadius: radius.button, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}
            />
            <Text accessibilityLiveRegion="polite" style={{ ...type.small, color: status.color }}>
              {status.text}
            </Text>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ ...type.small, fontFamily: fonts.semibold, color: colors.orangeText }}>
              {error}
            </Text>
          ) : null}
          <View className="gap-3">
            <Button label={saving ? 'Check your wallet…' : 'Save username'} onPress={save} disabled={!canSave} busy={saving} />
            {current ? (
              <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
            ) : (
              <Button
                label="Sign out"
                variant="secondary"
                onPress={async () => {
                  await disconnect()
                  queryClient.clear()
                  router.replace('/')
                }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
