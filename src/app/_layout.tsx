import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Per-weight imports so only the font files we use are bundled into the app
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors, fonts } from '../lib/theme';
import { isConfigured } from '../lib/supabase';
import { Empty, Loading, Screen } from '../components/ui';

const PUBLIC_ROOTS = ['index', '(auth)', 'legal'];

function Gate() {
  const { ready, session, profile } = useAuth();
  const segments = useSegments();
  const root = (segments[0] as string | undefined) ?? 'index';

  useEffect(() => {
    if (!ready || root === 'index') return;
    if (!session) {
      if (!PUBLIC_ROOTS.includes(root)) router.replace('/welcome');
      return;
    }
    if (!profile) return;
    if (profile.status === 'banned') {
      if (root !== 'banned') router.replace('/banned');
      return;
    }
    if (root === '(auth)') router.replace(profile.current_mood ? '/home' : '/mood');
    else if (!profile.current_mood && root !== 'mood' && root !== 'legal') router.replace('/mood');
    else if (root.startsWith('admin') && !profile.is_admin) router.replace('/home');
  }, [ready, session, profile, root]);

  if (!isConfigured) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Empty icon="wrench" title="Almost there" sub="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file (see README), then restart the app." />
      </Screen>
    );
  }
  if (!ready) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 19, color: colors.heading },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="mood" options={{ title: 'How are you feeling?' }} />
      <Stack.Screen name="banned" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="report" options={{ title: 'Report', presentation: 'modal' }} />
      <Stack.Screen name="post/create" options={{ title: 'New post', presentation: 'modal' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="community/[id]/index" options={{ title: '' }} />
      <Stack.Screen name="community/[id]/chat" options={{ title: 'Group chat' }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="dm/requests" options={{ title: 'Message requests' }} />
      <Stack.Screen name="dm/[id]" options={{ title: 'Chat' }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Stack.Screen name="settings/privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="settings/blocked" options={{ title: 'Blocked users' }} />
      <Stack.Screen name="settings/help" options={{ title: 'Help & safety' }} />
      <Stack.Screen name="premium" options={{ title: 'Premium', presentation: 'modal' }} />
      <Stack.Screen name="subscription" options={{ title: 'Subscription & payment' }} />
      <Stack.Screen name="payment-return" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="legal/terms" options={{ title: 'Terms' }} />
      <Stack.Screen name="legal/privacy-policy" options={{ title: 'Privacy policy' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  // If fonts fail to load (very rare), continue with system fonts rather than blocking the app.
  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
