// 20. Settings
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Group, Row, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errMsg, supabase } from '../../lib/supabase';
import Constants from 'expo-constants';

export default function Settings() {
  const { profile, signOut } = useAuth();

  const deleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, posts, comments, messages and chats. This cannot be undone. If you have a subscription, cancel it in your app store too.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: async () => {
          const { error } = await supabase.rpc('delete_my_account');
          if (error) return Alert.alert('Error', errMsg(error));
          await signOut();
        } },
      ],
    );
  };

  return (
    <Screen>
      <Group title="Account">
        <Row icon="pencil" label="Edit profile" onPress={() => router.push('/profile/edit')} />
        <Row icon="smile" label="Change mood" onPress={() => router.push('/mood')} />
        <Row icon="star" label="Premium" value={profile?.is_premium ? 'Active' : undefined} onPress={() => router.push('/premium')} />
        <Row icon="card" label="Subscription & payment" onPress={() => router.push('/subscription')} />
      </Group>
      <Group title="Privacy & safety">
        <Row icon="lock" label="Privacy" onPress={() => router.push('/settings/privacy')} />
        <Row icon="ban" label="Blocked users" onPress={() => router.push('/settings/blocked')} />
        <Row icon="lifebuoy" label="Help & safety" onPress={() => router.push('/settings/help')} />
      </Group>
      <Group title="About">
        <Row icon="file" label="Terms of service" onPress={() => router.push('/legal/terms')} />
        <Row icon="shield" label="Privacy policy" onPress={() => router.push('/legal/privacy-policy')} />
      </Group>
      <Group>
        <Row icon="logout" label="Log out" onPress={signOut} />
        <Row icon="trash" label="Delete account" danger onPress={deleteAccount} />
      </Group>
      <T faint size={12} style={{ textAlign: 'center' }}>MoodCircle v{Constants.expoConfig?.version ?? '1.0.0'}</T>
    </Screen>
  );
}
