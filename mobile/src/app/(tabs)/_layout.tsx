import { Redirect, Tabs } from 'expo-router'
import { CalendarCheck, Compass, Megaphone, UserRound } from 'lucide-react-native'
import { useWallet } from '@/lib/wallet'
import { colors, fonts } from '@/lib/theme'

export default function TabsLayout() {
  const { account } = useWallet()
  if (!account) return <Redirect href="/" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12 },
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.paper },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Compass color={color} size={24} /> }} />
      <Tabs.Screen name="going" options={{ title: 'Going', tabBarIcon: ({ color }) => <CalendarCheck color={color} size={24} /> }} />
      <Tabs.Screen name="host" options={{ title: 'Host', tabBarIcon: ({ color }) => <Megaphone color={color} size={24} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound color={color} size={24} /> }} />
    </Tabs>
  )
}
