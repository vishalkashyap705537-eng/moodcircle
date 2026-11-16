// 9. Community detail (feed)
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { PostCard } from '../../../components/PostCard';
import { Btn, Empty, Loading, T } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { errMsg, supabase } from '../../../lib/supabase';
import { colors, radius, shadow } from '../../../lib/theme';
import type { Community, FeedPost } from '../../../lib/types';
import { Glyph } from '../../../components/Icon';

export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, moods } = useAuth();
  const [c, setC] = useState<Community | null>(null);
  const [member, setMember] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: com }, { data: mem }, { data: ps }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', id).maybeSingle(),
      supabase.from('community_members').select('user_id').eq('community_id', id).eq('user_id', profile.id).maybeSingle(),
      supabase.from('feed_posts').select('*').eq('community_id', id).order('created_at', { ascending: false }).limit(50),
    ]);
    setC(com as Community);
    setMember(!!mem);
    setPosts((ps as FeedPost[]) ?? []);
  }, [id, profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    if (!profile || !c) return;
    if (member) {
      Alert.alert('Leave circle?', `You'll stop seeing ${c.name} on your home feed.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          await supabase.from('community_members').delete().eq('community_id', c.id).eq('user_id', profile.id);
          load();
        } },
      ]);
    } else {
      const { error } = await supabase.from('community_members').insert({ community_id: c.id, user_id: profile.id });
      if (error) Alert.alert('Could not join', errMsg(error));
      load();
    }
  };

  if (!c || !profile) return <Loading />;
  const mood = moods.find((m) => m.id === c.mood_id);

  return (
    <>
      <Stack.Screen options={{ title: c.name }} />
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={member ? posts : []}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: colors.border, ...shadow.soft }}>
            <Glyph value={c.emoji} size={64} rounded="square" color={mood?.color ?? colors.accent} />
            <T bold size={22} style={{ marginTop: 8 }}>{c.name}</T>
            <T dim style={{ marginTop: 4 }}>{c.description}</T>
            <T faint size={13} style={{ marginTop: 8 }}>
              {mood ? `${mood.label} · ` : ''}{c.member_count} members · Free to join
            </T>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Btn small title={member ? 'Joined' : 'Join circle'} icon={member ? 'check' : 'plus'} kind={member ? 'secondary' : 'primary'} onPress={toggle} style={{ flex: 1 }} />
              {member ? (
                <>
                  <View style={{ width: 8 }} />
                  <Btn small title="Group chat" icon="message" onPress={() => router.push({ pathname: '/community/[id]/chat', params: { id: c.id, name: c.name } })} style={{ flex: 1 }} />
                </>
              ) : null}
            </View>
            {member ? (
              <Btn small kind="ghost" title="Share something here" icon="pencil" style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/post/create', params: { community: c.id } })} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard post={item} uid={profile.id} showCommunity={false} onChange={(p) => setPosts((ps) => ps.map((x) => (x.id === p.id ? p : x)))} />
        )}
        ListEmptyComponent={
          member
            ? <Empty icon="sprout" title="No posts yet" sub="Start the conversation — you can post anonymously." />
            : <Empty icon="lock" title="Join to see posts and chat" sub="Joining is free and you can leave any time." />
        }
      />
    </>
  );
}
