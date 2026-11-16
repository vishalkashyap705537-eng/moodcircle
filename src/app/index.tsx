// 1. Splash
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from '../components/Text';
import { Orb } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Splash() {
  const { ready, session, profile } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (!ready) return;
    if (session && !profile) return;
    const t = setTimeout(() => {
      if (!session) router.replace('/welcome');
      else if (profile?.status === 'banned') router.replace('/banned');
      else if (!profile?.current_mood) router.replace('/mood');
      else router.replace('/home');
    }, 1100);
    return () => clearTimeout(t);
  }, [ready, session, profile]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', opacity: fade }}>
        <Orb name="moon" size={104} />
        <Text style={{ color: colors.heading, fontSize: 38, fontWeight: '700', marginTop: 22, letterSpacing: -0.6 }}>MoodCircle</Text>
        <Text style={{ color: colors.textDim, fontSize: 15, marginTop: 8 }}>Talk to people who feel the same</Text>
      </Animated.View>
    </View>
  );
}
