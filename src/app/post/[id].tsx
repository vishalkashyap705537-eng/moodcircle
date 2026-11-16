// 13. Post detail  +  14. Comments
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Switch, View } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostCard } from '../../components/PostCard';
import { Avatar, Empty, Loading, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { quickModerate, timeAgo } from '../../lib/format';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { FeedComment, FeedPost } from '../../lib/types';
import { Icon } from '../../components/Icon';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: cs }] = await Promise.all([
      supabase.from('feed_posts').select('*').eq('id', id).maybeSingle(),
      supabase.from('feed_comments').select('*').eq('post_id', id).order('created_at'),
    ]);
    setPost((p as FeedPost) ?? null);
    setComments((cs as FeedComment[]) ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !profile) return;
    const warn = quickModerate(body);
    if (warn) return Alert.alert('Hold on', warn);
    setSending(true);
    const { error } = await supabase.from('comments').insert({ post_id: id, author_id: profile.id, body, is_anonymous: anon });
    setSending(false);
    if (error) return Alert.alert('Not posted', errMsg(error));
    setText('');
    load();
  };

  const commentMenu = (c: FeedComment) => {
    Alert.alert(c.author_name, undefined, [
      ...(c.is_mine
        ? [{ text: 'Delete comment', style: 'destructive' as const, onPress: async () => { await supabase.from('comments').delete().eq('id', c.id); load(); } }]
        : [
            ...(c.author_id ? [{ text: 'View profile / message', onPress: () => router.push(`/user/${c.author_id}`) }] : []),
            { text: 'Report comment', style: 'destructive' as const, onPress: () => router.push({ pathname: '/report', params: { type: 'comment', id: c.id } }) },
          ]),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const deletePost = () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('posts').delete().eq('id', id); router.back(); } },
    ]);
  };

  if (post === undefined || !profile) return <Loading />;
  if (post === null) return <Empty icon="eye-off" title="Post not available" sub="It may have been deleted or removed by moderators." />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Stack.Screen options={{
        title: 'Post',
        headerRight: post.is_mine ? () => <Pressable onPress={deletePost}><Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text></Pressable> : undefined,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            <View>
              <PostCard full post={post} uid={profile.id} onChange={setPost} />
              {post.author_id && !post.is_mine ? (
                <Pressable onPress={() => router.push(`/user/${post.author_id}`)} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="send" size={16} color={colors.accent} style={{ marginRight: 8 }} /><Text style={{ color: colors.accent, fontWeight: '600' }}>Send {post.author_name} a message request</Text></View>
                </Pressable>
              ) : null}
              <T bold size={16} style={{ marginBottom: 10 }}>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</T>
            </View>
          }
          renderItem={({ item: c }) => (
            <Pressable onLongPress={() => commentMenu(c)} onPress={() => commentMenu(c)} style={{ flexDirection: 'row', marginBottom: 14 }}>
              <Avatar emoji={c.author_avatar} size={32} />
              <View style={{ flex: 1, marginLeft: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row' }}>
                  <T bold size={13} style={{ flex: 1 }}>{c.author_name}{c.is_mine ? ' (you)' : ''}</T>
                  <T faint size={11}>{timeAgo(c.created_at)}</T>
                </View>
                <T size={14} style={{ marginTop: 2 }}>{c.body}</T>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<T dim style={{ textAlign: 'center', marginTop: 10 }}>Be the first to reply with kindness.</T>}
        />
        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Switch value={anon} onValueChange={setAnon} trackColor={{ true: colors.accent, false: colors.lavender }} thumbColor="#fff" style={{ transform: [{ scale: 0.8 }] }} />
            <Icon name="mask" size={15} color={colors.textDim} style={{ marginRight: 6 }} /><T dim size={12}>Comment anonymously</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a supportive comment…"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={1000}
              style={{ flex: 1, color: colors.text, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 110, fontSize: 15 }}
            />
            <Pressable onPress={send} disabled={sending || !text.trim()} style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.accent : colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={19} color={text.trim() ? '#fff' : colors.textFaint} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
