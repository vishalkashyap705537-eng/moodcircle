import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from '../../components/Icon';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors, fonts, gradients } from '../../lib/theme';

// Round "pill" nav buttons, as in the reference design: soft blue circles with white
// line icons; the active tab is a deeper gradient orb with a white halo.
const icon = (name: IconName) => ({ focused }: { focused: boolean }) => (
  <View style={{
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: focused ? '#FFFFFF' : 'transparent',
    shadowColor: colors.shadow, shadowOpacity: focused ? 0.18 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: focused ? 4 : 0,
  }}>
    <LinearGradient
      colors={(focused ? gradients.primary : gradients.orb) as unknown as [string, string]}
      start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
      style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={name} size={20} color="#FFFFFF" strokeWidth={2} />
    </LinearGradient>
  </View>
);

export default function TabLayout() {
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const load = () =>
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).eq('is_read', false)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase
      .channel(`notif-badge-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 26, color: colors.heading },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg, borderTopWidth: 0, height: 84, paddingTop: 14,
          elevation: 0, shadowOpacity: 0,
        },
        tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
        tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#fff', fontFamily: fonts.bold, fontSize: 11 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.accentLight,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('message') }} />
      <Tabs.Screen name="notifications" options={{ title: 'Activity', tabBarIcon: icon('bell'), tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
