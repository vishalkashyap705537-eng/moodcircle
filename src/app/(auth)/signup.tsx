// 4. Sign up
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../components/Text';
import { Avatar, Btn, Empty, Field, Screen, T, Title } from '../../components/ui';
import { errMsg, supabase } from '../../lib/supabase';
import { AVATARS, colors } from '../../lib/theme';
import { Icon } from '../../components/Icon';

export default function SignUp() {
  const { dob } = useLocalSearchParams<{ dob: string }>();
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  if (!dob) {
    router.replace('/age');
    return null;
  }

  const submit = async () => {
    setError(null);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setError('Nickname must be 3–20 letters, numbers or _');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (!agree) return setError('Please accept the Terms and Privacy Policy');
    setLoading(true);
    try {
      const { data: free } = await supabase.rpc('username_available', { p_username: username });
      if (free === false) throw new Error('That nickname is taken — try another');
      const { data, error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { dob, username, avatar } },
      });
      if (e) throw e;
      if (!data.session) setCheckEmail(true);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <Screen>
        <Empty icon="inbox" title="Check your email" sub={`We sent a confirmation link to ${email}. Tap it, then log in.`}>
          <Btn title="Go to login" onPress={() => router.replace('/login')} />
        </Empty>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title sub="Your email stays private. Others only see your nickname and avatar.">Create your account</Title>
      <T dim size={13} bold style={{ marginBottom: 8 }}>PICK AN AVATAR</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
        {AVATARS.map((a) => (
          <Pressable key={a} onPress={() => setAvatar(a)} style={{ margin: 4, borderRadius: 30, borderWidth: 2, borderColor: a === avatar ? colors.accent : 'transparent' }}>
            <Avatar emoji={a} size={44} />
          </Pressable>
        ))}
      </View>
      <Field label="Nickname (shown publicly)" placeholder="e.g. MoonGirl23" autoCapitalize="none" value={username} onChangeText={setUsername} maxLength={20} />
      <Field label="Email (private)" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
      <Field label="Password" placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
      <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.accent, backgroundColor: agree ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          {agree ? <Icon name="check" size={15} color="#fff" strokeWidth={3} /> : null}
        </View>
        <T dim size={13} style={{ flex: 1 }}>
          I'm 18+, and I agree to the{' '}
          <Text style={{ color: colors.accent }} onPress={() => router.push('/legal/terms')}>Terms</Text> and{' '}
          <Text style={{ color: colors.accent }} onPress={() => router.push('/legal/privacy-policy')}>Privacy Policy</Text>.
        </T>
      </Pressable>
      {error ? <T style={{ color: colors.danger, marginBottom: 12 }}>{error}</T> : null}
      <Btn title="Create account" loading={loading} onPress={submit} />
    </Screen>
  );
}
