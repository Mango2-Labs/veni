import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AccountMenu } from './AccountMenu'
import { colors, type } from '@/lib/theme'

export function TabScreen({
  title,
  children,
  action,
  refreshing,
  onRefresh,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
}) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Text accessibilityRole="header" style={type.title}>
          {title}
        </Text>
        <View className="flex-row items-center gap-2">
          {action}
          <AccountMenu />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.ink} colors={[colors.ink]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
