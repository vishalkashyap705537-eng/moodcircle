// Admin 6. Reports
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Badge, Btn, Card, Chip, Empty, T } from '../../components/ui';
import { authorOf, moderateUser, setHidden, TABLE } from '../../lib/admin';
import { useAuth } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

type R = {
  id: string; target_type: string; target_id: string; reason: string; details: string; status: string; created_at: string;
  reporter: { username: string } | null;
  preview?: string; authorId?: string | null; authorName?: string;
};

export default function Reports() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [items, setItems] = useState<R[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(username)')
      .eq('status', status).order('created_at', { ascending: false }).limit(100);
    const rows = (data as unknown as R[]) ?? [];
    // Attach a preview of the reported content
    await Promise.all(rows.map(async (r) => {
      const table = TABLE[r.target_type];
      if (table) {
        const { data: t } = await supabase.from(table).select('body').eq('id', r.target_id).maybeSingle();
        r.preview = t?.body ?? '(deleted)';
      } else if (r.target_type === 'dm') {
        const { data: m } = await supabase.from('dm_messages').select('body, sender_id').eq('thread_id', r.target_id).order('created_at', { ascending: false }).limit(5);
        r.preview = (m ?? []).map((x) => `• ${x.body}`).reverse().join('\n') || '(empty)';
      }
      r.authorId = r.target_type === 'dm' ? null : await authorOf(r.target_type, r.target_id);
      if (r.authorId) {
        const { data: p } = await supabase.from('profiles').select('username').eq('id', r.authorId).maybeSingle();
        r.authorName = p?.username;
      }
    }));
    setItems(rows);
  }, [status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const close = async (r: R, s: 'resolved' | 'dismissed') => {
    await supabase.from('reports').update({ status: s, resolved_by: profile?.id }).eq('id', r.id);
    load();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          {(['open', 'resolved', 'dismissed'] as const).map((s) => <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} active={status === s} onPress={() => setStatus(s)} />)}
        </View>
      }
      renderItem={({ item: r }) => (
        <Card style={{ borderColor: status === 'open' ? colors.danger : colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Badge text={r.target_type.toUpperCase()} color={colors.accent} />
            <T bold size={14} style={{ marginLeft: 8, flex: 1 }}>{r.reason}</T>
            <T faint size={12}>{timeAgo(r.created_at)}</T>
          </View>
          <T faint size={12}>Reported by {r.reporter?.username ?? '?'}{r.authorName ? ` · against ${r.authorName}` : ''}</T>
          {r.details ? <T dim size={13} style={{ marginTop: 6 }}>"{r.details}"</T> : null}
          {r.preview ? (
            <View style={{ backgroundColor: colors.surface2, borderRadius: 10, padding: 10, marginTop: 8 }}>
              <T size={14}>{r.preview}</T>
            </View>
          ) : null}
          {status === 'open' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {TABLE[r.target_type] ? <Btn small kind="secondary" title="Hide content" onPress={async () => { await setHidden(r.target_type, r.target_id, true); close(r, 'resolved'); }} /> : null}
              {r.authorId ? <Btn small kind="secondary" title="Suspend/ban…" onPress={() => moderateUser(r.authorId!, r.authorName ?? 'user', () => close(r, 'resolved'))} /> : null}
              <Btn small title="Resolved" onPress={() => close(r, 'resolved')} />
              <Btn small kind="ghost" title="Dismiss" onPress={() => close(r, 'dismissed')} />
            </View>
          ) : null}
        </Card>
      )}
      ListEmptyComponent={<Empty icon="check-circle" title={`No ${status} reports`} />}
    />
  );
}
