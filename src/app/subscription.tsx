// 25. Subscription & payment
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { Glyph } from '../components/Icon';
import { Text } from '../components/Text';
import { Badge, Btn, Card, Group, Row, Screen, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { cancelSubscription, GATEWAY_INFO, verifySubscription, type Gateway } from '../lib/payments';
import { billingAvailable, manageUrl, restore } from '../lib/purchases';
import { errMsg, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type Sub = {
  product_id: string | null; store: string | null; status: string; expires_at: string | null;
  plan?: string | null; gateway_subscription_id?: string | null; cancel_at_period_end?: boolean;
};

const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/account/subscriptions'
  : 'https://play.google.com/store/account/subscriptions';

const STATUS_COLOR: Record<string, string> = {
  active: colors.success, pending: colors.gold, past_due: colors.gold, cancelled: colors.textDim,
  suspended: colors.danger, expired: colors.textFaint,
};

export default function Subscription() {
  const { profile, refreshProfile } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('subscriptions').select('*').eq('user_id', profile.id).maybeSingle();
    setSub(data as Sub);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const gateway: Gateway | null = sub?.store === 'RAZORPAY' ? 'razorpay' : sub?.store === 'PAYPAL' ? 'paypal' : null;
  const isGateway = !!gateway;

  const refresh = async () => {
    setBusy('refresh');
    try {
      if (isGateway) await verifySubscription();
      await refreshProfile();
      await load();
    } catch (e) {
      Alert.alert('Error', errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    if (!gateway) return;
    Alert.alert(
      'Cancel MoodCircle Plus?',
      `Your ${GATEWAY_INFO[gateway].name} subscription won't renew. You keep Plus until ${sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'the end of the paid period'}.`,
      [
        { text: 'Keep Plus', style: 'cancel' },
        {
          text: 'Cancel subscription', style: 'destructive', onPress: async () => {
            setBusy('cancel');
            try {
              await cancelSubscription();
              await refreshProfile();
              await load();
              Alert.alert('Subscription cancelled', 'It will not renew. Thanks for supporting MoodCircle.');
            } catch (e) {
              Alert.alert('Could not cancel', errMsg(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const manageStore = async () => {
    const url = (await manageUrl().catch(() => null)) ?? STORE_URL;
    Linking.openURL(url);
  };

  const doRestore = async () => {
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore');
      refreshProfile();
    } catch (e) {
      Alert.alert('Error', errMsg(e));
    }
  };

  const billedBy = gateway ? GATEWAY_INFO[gateway].name : sub?.store ? sub.store.replace('_', ' ').toLowerCase() : null;
  const canCancel = isGateway && sub?.status === 'active' && !sub.cancel_at_period_end;

  return (
    <Screen>
      <Card style={profile?.is_premium ? { borderColor: colors.gold } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Glyph value={profile?.is_premium ? 'crown' : 'user'} size={50} color={profile?.is_premium ? colors.gold : colors.accent} style={{ marginRight: 14 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.heading, fontSize: 20, fontWeight: '600' }}>{profile?.is_premium ? 'MoodCircle Plus' : 'Free plan'}</Text>
              {sub?.status ? <Badge text={sub.status.replace('_', ' ').toUpperCase()} color={STATUS_COLOR[sub.status] ?? colors.textDim} /> : null}
            </View>
            <T dim size={13} style={{ marginTop: 2 }}>
              {profile?.is_premium
                ? `${sub?.plan ? `${sub.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan · ` : ''}${sub?.cancel_at_period_end || sub?.status === 'cancelled' ? 'ends' : 'renews'} ${sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : profile.premium_until ? new Date(profile.premium_until).toLocaleDateString() : ''}`
                : 'Groups, posts, comments and 3 message requests a day — free forever.'}
            </T>
            {billedBy ? <T faint size={12} style={{ marginTop: 2 }}>Billed through {billedBy}</T> : null}
          </View>
        </View>
      </Card>

      {!profile?.is_premium ? <Btn title="See Plus plans" icon="crown" onPress={() => router.push('/premium')} style={{ marginBottom: 18 }} /> : null}

      <Group title="Payment">
        <Row icon="refresh" label={busy === 'refresh' ? 'Refreshing…' : 'Refresh subscription status'} onPress={busy ? undefined : refresh} />
        {canCancel ? <Row icon="x" label={busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'} danger onPress={busy ? undefined : cancel} /> : null}
        {!isGateway && billingAvailable ? (
          <>
            <Row icon="card" label={`Manage in ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}`} onPress={manageStore} />
            <Row icon="refresh" label="Restore store purchases" onPress={doRestore} />
          </>
        ) : null}
      </Group>

      <T faint size={12}>
        {isGateway
          ? `Payments and receipts are handled securely by ${billedBy}. MoodCircle never sees your card or bank details. Cancelling stops future renewals; you keep Plus until the end of the period you've paid for. Deleting the app does not cancel a subscription.`
          : 'Payments are handled securely by Razorpay, PayPal or your app store. MoodCircle never sees your card details. Deleting the app does not cancel a subscription.'}
      </T>
    </Screen>
  );
}
