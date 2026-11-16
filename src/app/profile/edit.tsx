// 19. Edit profile
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Btn, Field, Screen, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errMsg, supabase } from '../../lib/supabase';
import { AVATARS, colors } from '../../lib/theme';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const save = async () => {
    setError(null);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setError('Nickname must be 3–20 letters, numbers or _');
    setBusy(true);
    const { error: e } = await supabase.from('profiles').update({ username, bio: bio.trim(), avatar }).eq('id', profile.id);
    setBusy(false);
    if (e) return setError(e.code === '23505' ? 'That nickname is taken' : errMsg(e));
    await refreshProfile();
    router.back();
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Avatar emoji={avatar} size={88} premium={profile.is_premium} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
        {AVATARS.map((a) => (
          <Pressable key={a} onPress={() => setAvatar(a)} style={{ margin: 4, borderRadius: 30, borderWidth: 2, borderColor: a === avatar ? colors.accent : 'transparent' }}>
            <Avatar emoji={a} size={42} />
          </Pressable>
        ))}
      </View>
      <Field label="Nickname" autoCapitalize="none" value={username} onChangeText={setUsername} maxLength={20} />
      <Field label="Short bio (optional)" placeholder="Night owl. Music helps." value={bio} onChangeText={setBio} maxLength={160} multiline />
      <T faint size={12} style={{ marginBottom: 16 }}>
        Don't put your real name, phone, school, workplace or social handles here — keep yourself safe.
      </T>
      {error ? <T style={{ color: colors.danger, marginBottom: 12 }}>{error}</T> : null}
      <Btn title="Save" loading={busy} onPress={save} />
    </Screen>
  );
}
