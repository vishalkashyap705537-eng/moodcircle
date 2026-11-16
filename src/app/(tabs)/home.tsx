// 7. Home
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostCard } from '../../components/PostCard';
import { Btn, Empty, T } from '../../components/ui';
import { useAuth, useMood } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors, gradients, radius, shadow } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Glyph, Icon } from '../../components/Icon';
import type { Community, FeedPost } from '../../lib/types';

export default function Home() {
  const { profile } = useAuth();
  const mood = useMood(profile?.current_mood);
  const [mine, setMine] = useState<Community[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data: mem } = await supabase.from('community_members').select('communities(*)').eq('user_id', profile.id);
    const cs = ((mem ?? []).map((m) => m.communities).filter(Boolean) as unknown as Community[]);
    setMine(cs);
    if (cs.length === 0) return setPosts([]);
    const { data } = await supabase.from('feed_posts').select('*')
      .in('community_id', cs.map((c) => c.id))
      .order('created_at', { ascending: false }).limit(50);
    setPosts((data as FeedPost[]) ?? []);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!profile) return null;

  const header = (
    <View>
      <Pressable
        onPress={() => router.push('/mood')}
        style={({ pressed }) => [{ backgroundColor: colors.surface2, borderRadius: radius.xl, padding: 18, marginBottom: 22, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.9 : 1 }]}
      >
        <Glyph value={mood?.emoji ?? 'moon'} moodId={mood?.id} size={58} color={mood?.color ?? colors.accent} bg="#FFFFFF" style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textDim, fontWeight: '600', fontSize: 13 }}>You're feeling</Text>
          <Text style={{ color: colors.heading, fontWeight: '700', fontSize: 24 }}>{mood?.label ?? 'Pick a mood'}</Text>
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pencil" size={17} color={colors.accentLight} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, color: colors.heading, fontSize: 20, fontWeight: '600' }}>Your circles</Text>
        <T dim size={13} style={{ color: colors.accent }}>
          <Text onPress={() => router.push('/discover')}>Find more</Text>
        </T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {mine.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/community/${c.id}`)} style={{ width: 128, marginRight: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.soft }}>
            <Glyph value={c.emoji} size={42} rounded="square" />
            <T bold size={13} numberOfLines={2} style={{ marginTop: 6 }}>{c.name}</T>
          </Pressable>
        ))}
        <Pressable onPress={() => router.push('/discover')} style={{ width: 128, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.accentLight, borderStyle: 'dashed' }}>
          <Icon name="plus" size={26} color={colors.accent} />
          <T bold size={13} style={{ marginTop: 6, color: colors.accent }}>Join more</T>
        </Pressable>
      </ScrollView>
      <Text style={{ color: colors.heading, fontSize: 20, fontWeight: '600', marginBottom: 12 }}>From your circles</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={[]}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <PostCard post={item} uid={profile.id} onChange={(p) => setPosts((ps) => ps.map((x) => (x.id === p.id ? p : x)))} />
        )}
        ListEmptyComponent={
          <Empty icon="sprout" title="It's quiet here" sub={mine.length ? 'Be the first to share how you feel.' : 'Join a circle to see posts.'}>
            <Btn title={mine.length ? 'Write a post' : 'Find circles'} onPress={() => router.push(mine.length ? '/post/create' : '/discover')} />
          </Empty>
        }
      />
      {mine.length > 0 ? (
        <Pressable
          onPress={() => router.push('/post/create')}
          style={{ position: 'absolute', right: 20, bottom: 24, borderRadius: 30, ...shadow.lift }}
        >
          <LinearGradient colors={gradients.primary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 30, paddingHorizontal: 22, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pencil" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Share</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
