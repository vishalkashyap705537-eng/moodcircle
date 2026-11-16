// Admin 2. Users
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { Avatar, Badge, Btn, Card, Field, T } from '../../components/ui';
import { moderateUser } from '../../lib/admin';
import { ageFrom, timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import type { Profile } from '../../lib/types';

type U = Profile & { profile_private: { dob: string } | null };

export default function Users() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<U[]>([]);

  const load = useCallback(async () => {
    let query = supabase.from('profiles').select('*, profile_private(dob)').order('created_at', { ascending: false }).limit(100);
    if (q.trim()) query = query.ilike('username', `%${q.trim()}%`);
    const { data } = await query;
    setItems((data as U[]) ?? []);
  }, [q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAdmin = (u: U) => {
    Alert.alert(u.is_admin ? 'Remove admin?' : 'Make admin?', `${u.username} will ${u.is_admin ? 'lose' : 'get'} full admin access.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => { await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id); load(); } },
    ]);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(u) => u.id}
      ListHeaderComponent={<Field placeholder="Search nickname" icon="search" value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" autoCapitalize="none" />}
      renderItem={({ item: u }) => (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar emoji={u.avatar} premium={u.is_premium} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <T bold>{u.username}</T>
                {u.is_admin ? <Badge text="ADMIN" color={colors.accent} /> : null}
                {u.is_premium ? <Badge text="PLUS" /> : null}
                {u.status !== 'active' ? <Badge text={u.status.toUpperCase()} color={colors.danger} /> : null}
              </View>
              <T faint size={12}>
                Joined {timeAgo(u.created_at)}{u.profile_private?.dob ? ` · age ${ageFrom(new Date(u.profile_private.dob))}` : ''}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Btn small kind="secondary" title="Moderate" style={{ flex: 1 }} onPress={() => moderateUser(u.id, u.username, load)} />
            <View style={{ width: 8 }} />
            <Btn small kind="ghost" title={u.is_admin ? 'Remove admin' : 'Make admin'} style={{ flex: 1 }} onPress={() => toggleAdmin(u)} />
          </View>
        </Card>
      )}
    />
  );
}
