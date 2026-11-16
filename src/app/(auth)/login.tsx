// 5. Login
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Btn, Field, Screen, T, Title } from '../../components/ui';
import { errMsg, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (e) setError(errMsg(e));
  };

  const forgot = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Type your email above first');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (e) setError(errMsg(e));
    else Alert.alert('Check your email', 'We sent you a link to reset your password.');
  };

  return (
    <Screen>
      <Title sub="Good to see you again.">Welcome back</Title>
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
      <Field label="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} />
      {error ? <T style={{ color: colors.danger, marginBottom: 12 }}>{error}</T> : null}
      <Btn title="Log in" loading={loading} onPress={submit} />
      <Btn title="Forgot password?" kind="ghost" style={{ marginTop: 12 }} onPress={forgot} />
      <Btn title="New here? Create an account" kind="ghost" style={{ marginTop: 12 }} onPress={() => router.replace('/age')} />
    </Screen>
  );
}
