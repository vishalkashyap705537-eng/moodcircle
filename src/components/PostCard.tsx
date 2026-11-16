import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { supabase } from '../lib/supabase';
import { colors, REACTIONS } from '../lib/theme';
import { timeAgo } from '../lib/format';
import type { FeedPost } from '../lib/types';
import { Avatar, Badge, Card, T } from './ui';
import { Icon } from './Icon';

export async function toggleReaction(post: FeedPost, kind: string, uid: string) {
  if (post.my_reaction === kind) {
    await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', uid);
    return { ...post, my_reaction: null, reaction_count: Math.max(0, post.reaction_count - 1) };
  }
  if (post.my_reaction) {
    await supabase.from('reactions').update({ kind }).eq('post_id', post.id).eq('user_id', uid);
    return { ...post, my_reaction: kind };
  }
  await supabase.from('reactions').insert({ post_id: post.id, user_id: uid, kind });
  return { ...post, my_reaction: kind, reaction_count: post.reaction_count + 1 };
}

export function PostCard({ post, uid, onChange, showCommunity = true, full }: {
  post: FeedPost; uid: string; onChange: (p: FeedPost) => void; showCommunity?: boolean; full?: boolean;
}) {
  const openAuthor = () => {
    if (post.author_id && !post.is_mine) router.push(`/user/${post.author_id}`);
  };
  return (
    <Card onPress={full ? undefined : () => router.push(`/post/${post.id}`)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Pressable onPress={openAuthor}>
          <Avatar emoji={post.author_avatar} size={36} premium={post.author_premium} />
        </Pressable>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T bold>{post.author_name}</T>
            {post.is_mine && post.is_anonymous ? <Badge text="YOU · HIDDEN" color={colors.textDim} /> : null}
            {post.author_premium ? <Badge text="PLUS" /> : null}
          </View>
          <T faint size={12}>
            {showCommunity ? `${post.community_name} · ` : ''}
            {timeAgo(post.created_at)}
          </T>
        </View>
        <Pressable hitSlop={12} onPress={() => router.push({ pathname: '/report', params: { type: 'post', id: post.id } })}>
          <Icon name="more" size={20} color={colors.textFaint} />
        </Pressable>
      </View>
      <T size={16} numberOfLines={full ? undefined : 6}>{post.body}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        {REACTIONS.map((r) => {
          const active = post.my_reaction === r.kind;
          return (
            <Pressable
              key={r.kind}
              onPress={async () => onChange(await toggleReaction(post, r.kind, uid))}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 6, backgroundColor: active ? colors.accent : colors.surface2, borderWidth: 1, borderColor: active ? colors.accent : 'transparent' }}
            >
              <Icon name={r.icon} size={15} color={active ? colors.onAccent : colors.accent} />
              {full ? <Text style={{ color: active ? colors.onAccent : colors.textDim, fontSize: 12, marginLeft: 5, fontWeight: '600' }}>{r.label}</Text> : null}
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Icon name="heart" size={13} color={colors.textFaint} />
        <T faint size={12} style={{ marginLeft: 3, marginRight: 10 }}>{post.reaction_count}</T>
        <Icon name="message" size={13} color={colors.textFaint} />
        <T faint size={12} style={{ marginLeft: 3 }}>{post.comment_count}</T>
      </View>
    </Card>
  );
}
