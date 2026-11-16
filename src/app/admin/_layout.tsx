import { Stack } from 'expo-router';
import { colors, fonts } from '../../lib/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: colors.heading },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="communities" options={{ title: 'Communities' }} />
      <Stack.Screen name="posts" options={{ title: 'Posts' }} />
      <Stack.Screen name="comments" options={{ title: 'Comments' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
      <Stack.Screen name="moderation" options={{ title: 'Moderation queue' }} />
      <Stack.Screen name="banned" options={{ title: 'Banned / suspended' }} />
      <Stack.Screen name="subscriptions" options={{ title: 'Premium / subscriptions' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
    </Stack>
  );
}
