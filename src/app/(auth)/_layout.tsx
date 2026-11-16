import { Stack } from 'expo-router';
import { colors, fonts } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: colors.heading },
        headerShadowVisible: false,
        headerTitle: '',
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
