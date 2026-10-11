import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Check } from 'lucide-react-native'
import { Button } from './Button'
import { colors, fonts, radius, type } from '@/lib/theme'

const DISMISSED_KEY = 'veni:stake-notice-dismissed'

export async function hasDismissedStakeNotice() {
  return (await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null)) === '1'
}

/** Before a stake, until the guest ticks "Don't show this again": the stake comes back only by showing up. */
export function StakeNotice({
  open,
  stake,
  ticket,
  isApplying,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  stake: string
  ticket?: string
  isApplying: boolean
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [neverAgain, setNeverAgain] = useState(false)
  const points = [
    ['You come:', `${stake} back, plus a share of what no-shows staked.`],
    ["You don't:", `your ${stake} goes to the guests who came. Veni keeps 10%.`],
    ...(ticket ? [['Your ticket:', `${ticket} goes to the host.`]] : []),
    ['', 'You get it all back if the host cancels or nobody checks in.'],
  ]

  async function confirm() {
    if (neverAgain) await AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {})
    onConfirm()
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-ink/50 px-5">
        <View accessibilityViewIsModal style={{ borderRadius: radius.card, backgroundColor: colors.paper, padding: 22, gap: 14 }}>
          <Text accessibilityRole="header" style={type.title}>
            Your stake is locked in
          </Text>
          <Text style={type.body}>
            {isApplying
              ? "You can withdraw your application until the host approves you. After that, you can't take your stake back before the event."
              : "Once you sign up, you can't take your stake back before the event."}
          </Text>
          <View style={{ gap: 8 }}>
            {points.map(([lead, rest]) => (
              <Text key={rest} style={type.body}>
                {lead ? <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{lead} </Text> : null}
                {rest}
              </Text>
            ))}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: neverAgain }}
            onPress={() => setNeverAgain(!neverAgain)}
            className="min-h-11 flex-row items-center gap-3"
          >
            <View
              style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: neverAgain ? colors.ink : colors.paper }}
              className="items-center justify-center"
            >
              {neverAgain ? <Check color={colors.paper} size={16} strokeWidth={3} /> : null}
            </View>
            <Text style={type.label}>Don't show this again</Text>
          </Pressable>
          <Button label={confirmLabel} onPress={confirm} />
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  )
}
