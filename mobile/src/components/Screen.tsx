import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AccountMenu } from './AccountMenu'
import { colors, type } from '@/lib/theme'

/** A tab's page: its title and the account menu, then scrolling content. */
export function TabScreen({
  title,
  children,
  refreshing,
  onRefresh,
}: {
  title: string
  children: ReactNode
  /** Pull to refresh, when the page can reload. */
  refreshing?: boolean
  onRefresh?: () => void
}) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.paper }}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Text accessibilityRole="header" style={type.title}>
          {title}
        </Text>
        <AccountMenu />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.ink} colors={[colors.ink]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
