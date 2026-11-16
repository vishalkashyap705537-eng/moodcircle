// 18. Profile (your own)
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { PostCard } from '../../components/PostCard';
import { Avatar, Badge, Btn, Chip, Group, Row, Screen, T } from '../../components/ui';
import { useAuth, useMood } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Community, FeedPost } from '../../lib/types';

export default function MyProfile() {
  const { profile } = useAuth();
  const mood = useMood(profile?.current_mood);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useFocusEffect(useCallback(() => {
    if (!profile) return;
    supabase.from('community_members').select('communities(*)').eq('user_id', profile.id)
      .then(({ data }) => setCommunities(((data ?? []).map((m) => m.communities).filter(Boolean) as unknown as Community[])));
    supabase.from('feed_posts').select('*').eq('is_mine', true).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setPosts((data as FeedPost[]) ?? []));
  }, [profile]));

  if (!profile) return null;

  return (
    <Screen edges={[]}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Avatar emoji={profile.avatar} size={88} premium={profile.is_premium} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Text style={{ color: colors.heading, fontSize: 26, fontWeight: '700' }}>{profile.username}</Text>
          {profile.is_premium ? <Badge text="PLUS" /> : null}
        </View>
        {mood ? <T dim style={{ marginTop: 4 }}>Feeling {mood.label.toLowerCase()}</T> : null}
        {profile.bio ? <T style={{ textAlign: 'center', marginTop: 8 }}>{profile.bio}</T> : null}
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <Btn small kind="secondary" title="Edit profile" onPress={() => router.push('/profile/edit')} />
          <View style={{ width: 10 }} />
          <Btn small kind="secondary" title="Settings" icon="settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {!profile.is_premium ? (
        <Group>
          <Row icon="crown" label="Get MoodCircle Plus" value="More DMs" onPress={() => router.push('/premium')} />
        </Group>
      ) : null}
      {profile.is_admin ? (
        <Group>
          <Row icon="wrench" label="Admin panel" onPress={() => router.push('/admin')} />
        </Group>
      ) : null}

      <T bold size={17} style={{ marginBottom: 10 }}>Circles</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
        {communities.map((c) => <Chip key={c.id} label={c.name} iconValue={c.emoji} onPress={() => router.push(`/community/${c.id}`)} />)}
        {communities.length === 0 ? <T dim>No circles yet.</T> : null}
      </View>

      <T bold size={17} style={{ marginBottom: 10 }}>Your posts</T>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} uid={profile.id} onChange={(n) => setPosts((ps) => ps.map((x) => (x.id === n.id ? n : x)))} />
      ))}
      {posts.length === 0 ? <T dim>You haven't posted yet. Anonymous posts appear here only for you.</T> : null}
    </Screen>
  );
}
