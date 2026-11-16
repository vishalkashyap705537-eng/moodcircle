import { Alert } from 'react-native';
import { errMsg, supabase } from './supabase';

export type Stats = {
  users: number; new_users_7d: number; premium: number; communities: number; posts: number; posts_7d: number;
  comments: number; messages_7d: number; open_reports: number; flagged: number; banned: number;
  daily: { day: string; signups: number; posts: number; messages: number }[] | null;
  moods: { mood: string; n: number }[] | null;
};

export async function loadStats(): Promise<Stats | null> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) {
    Alert.alert('Error', errMsg(error));
    return null;
  }
  return data as Stats;
}

export const TABLE: Record<string, string> = { post: 'posts', comment: 'comments', message: 'messages' };
const AUTHOR_COL: Record<string, string> = { posts: 'author_id', comments: 'author_id', messages: 'user_id' };

export async function setHidden(type: string, id: string, hidden: boolean) {
  const table = TABLE[type];
  if (!table) return;
  const { error } = await supabase.from(table).update({ is_hidden: hidden, is_flagged: false }).eq('id', id);
  if (error) Alert.alert('Error', errMsg(error));
}

export async function authorOf(type: string, id: string): Promise<string | null> {
  if (type === 'user') return id;
  const table = TABLE[type];
  if (!table) return null;
  const col = AUTHOR_COL[table];
  const { data } = await supabase.from(table).select(col).eq('id', id).maybeSingle();
  return (data as Record<string, string> | null)?.[col] ?? null;
}

export async function setUserStatus(userId: string, status: 'active' | 'suspended' | 'banned', days = 7) {
  const { error } = await supabase.from('profiles').update({
    status,
    suspended_until: status === 'suspended' ? new Date(Date.now() + days * 86400000).toISOString() : null,
  }).eq('id', userId);
  if (error) return Alert.alert('Error', errMsg(error));
  if (status !== 'active') {
    await supabase.from('notifications').insert({
      user_id: userId, type: 'moderation',
      title: status === 'banned' ? 'Your account was banned' : `Your account is suspended for ${days} days`,
      body: 'This was due to a breach of the MoodCircle community rules.',
    });
  }
}

export function moderateUser(userId: string, name: string, after?: () => void) {
  Alert.alert(`Action on ${name}`, undefined, [
    { text: 'Suspend 7 days', onPress: async () => { await setUserStatus(userId, 'suspended', 7); after?.(); } },
    { text: 'Ban permanently', style: 'destructive', onPress: async () => { await setUserStatus(userId, 'banned'); after?.(); } },
    { text: 'Restore to active', onPress: async () => { await setUserStatus(userId, 'active'); after?.(); } },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
