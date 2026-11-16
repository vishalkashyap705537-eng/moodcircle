// 24. Premium — pay with Razorpay or PayPal (and Google Play / App Store when store billing is set up)
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Glyph, Icon, Orb, type IconName } from '../components/Icon';
import { Text } from '../components/Text';
import { Btn, Card, Screen, T } from '../components/ui';
import { useAuth } from '../lib/auth';
import { checkout, formatPrice, GATEWAY_INFO, getGatewayConfig, warmUpBrowser, type Gateway, type GatewayConfig, type PlanId } from '../lib/payments';
import { billingAvailable, buy, getPackages, restore } from '../lib/purchases';
import { errMsg } from '../lib/supabase';
import { colors, gradients, radius, shadow } from '../lib/theme';

const PERKS: [IconName, string, string][] = [
  ['send', '50 message requests a day', 'Free accounts get 3 a day.'],
  ['crown', 'PLUS badge & golden avatar ring', 'Stand out in chats and comments.'],
  ['target', 'Priority in message requests', 'Your requests appear at the top.'],
  ['heart', 'Support a safe, ad-light space', 'Premium keeps moderation running.'],
];

type Method = Gateway | 'store';

const METHOD_ICON: Record<Method, IconName> = { razorpay: 'razorpay', paypal: 'paypal', store: 'wallet' };

export default function Premium() {
  const { profile, refreshProfile } = useAuth();
  const [gateways, setGateways] = useState<GatewayConfig[] | null>(null);
  const [pkgs, setPkgs] = useState<PurchasesPackage[]>([]);
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => warmUpBrowser(), []);

  useEffect(() => {
    Promise.all([getGatewayConfig(), getPackages().catch(() => [] as PurchasesPackage[])]).then(([g, p]) => {
      setGateways(g);
      setPkgs(p);
      setMethod(g[0]?.id ?? (p.length ? 'store' : null));
    });
  }, []);

  const storePkg = useMemo(
    () => pkgs.find((p) => p.packageType === (plan === 'yearly' ? 'ANNUAL' : 'MONTHLY')) ?? null,
    [pkgs, plan],
  );

  const priceFor = (m: Method): string | null => {
    if (m === 'store') return storePkg?.product.priceString ?? null;
    const p = gateways?.find((g) => g.id === m)?.plans.find((x) => x.id === plan);
    return p ? formatPrice(p) : null;
  };

  const methods: Method[] = [
    ...(gateways ?? []).map((g) => g.id),
    ...(pkgs.length ? (['store'] as Method[]) : []),
  ];

  // Wait for the server to confirm Premium (webhooks can take a few seconds)
  const syncPremium = async () => {
    for (let i = 0; i < 4; i++) {
      await refreshProfile();
      await new Promise((r) => setTimeout(r, 1200));
    }
  };

  const subscribe = async () => {
    if (!method) return;
    setBusy(true);
    try {
      if (method === 'store') {
        if (!storePkg) return;
        const ok = await buy(storePkg);
        if (ok) {
          Alert.alert('Welcome to Plus', 'Your premium features are now active.');
          await syncPremium();
          router.back();
        }
        return;
      }
      const r = await checkout(method, plan);
      await refreshProfile();
      if (r.is_premium || r.status === 'active') {
        Alert.alert('Welcome to Plus', 'Your payment was successful and your premium features are now active.');
        await syncPremium();
        router.back();
      } else if (r.status === 'pending') {
        Alert.alert(
          'Payment not completed',
          "We haven't received a confirmed payment yet. If you completed it, Plus will switch on automatically within a minute — check Subscription & payment.",
        );
      } else {
        Alert.alert('Payment not completed', `Subscription status: ${r.status}. You have not been charged for Plus.`);
      }
    } catch (e) {
      const cancelled = (e as { userCancelled?: boolean }).userCancelled;
      if (!cancelled) Alert.alert('Payment failed', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Your Plus subscription is active again.' : 'We couldn’t find an active subscription for this store account.');
      if (ok) await syncPremium();
    } catch (e) {
      Alert.alert('Error', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (profile?.is_premium) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', borderColor: colors.gold, paddingVertical: 28 }}>
          <Orb name="crown" size={88} colorsPair={gradients.gold} />
          <Text style={{ color: colors.heading, fontSize: 24, fontWeight: '700', marginTop: 16 }}>You're on MoodCircle Plus</Text>
          {profile.premium_until ? <T dim style={{ marginTop: 4 }}>Renews / ends {new Date(profile.premium_until).toLocaleDateString()}</T> : null}
        </Card>
        <Btn title="Manage subscription" icon="card" kind="secondary" onPress={() => router.push('/subscription')} />
      </Screen>
    );
  }

  const isStore = method === 'store';
  const price = method ? priceFor(method) : null;

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Orb name="crown" size={92} colorsPair={gradients.gold} />
        <Text style={{ color: colors.heading, fontSize: 30, fontWeight: '700', marginTop: 16 }}>MoodCircle Plus</Text>
        <T dim style={{ textAlign: 'center', marginTop: 6 }}>Groups and posts are always free. Plus is for people who want more 1-to-1 conversations.</T>
      </View>

      <Card style={{ paddingVertical: 6 }}>
        {PERKS.map(([icon, t, d], i) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Glyph value={icon} size={40} rounded="square" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <T bold>{t}</T>
              <T dim size={13}>{d}</T>
            </View>
          </View>
        ))}
      </Card>

      {/* Plan */}
      <Text style={{ color: colors.heading, fontSize: 20, fontWeight: '600', marginTop: 10, marginBottom: 10 }}>Choose a plan</Text>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 4, marginBottom: 18 }}>
        {(['monthly', 'yearly'] as PlanId[]).map((p) => {
          const active = plan === p;
          return (
            <Pressable key={p} onPress={() => setPlan(p)} style={{ flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: active ? colors.surface : 'transparent', ...(active ? shadow.soft : {}) }}>
              <Text style={{ color: active ? colors.accent : colors.textDim, fontWeight: '700', fontSize: 15 }}>{p === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
              {p === 'yearly' ? (
                <View style={{ backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 }}>
                  <Text style={{ color: '#B07A1A', fontSize: 10, fontWeight: '800' }}>BEST VALUE</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Payment method */}
      <Text style={{ color: colors.heading, fontSize: 20, fontWeight: '600', marginBottom: 10 }}>Pay with</Text>
      {gateways === null ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} /> : null}
      {methods.map((m) => {
        const active = method === m;
        const info = m === 'store'
          ? { name: Platform.OS === 'ios' ? 'App Store' : 'Google Play', blurb: `Billed to your ${Platform.OS === 'ios' ? 'Apple ID' : 'Google account'}` }
          : GATEWAY_INFO[m];
        const p = priceFor(m);
        return (
          <Pressable key={m} onPress={() => setMethod(m)} style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10,
            borderWidth: 2, borderColor: active ? colors.accent : colors.border, opacity: pressed ? 0.9 : 1,
          }, shadow.soft]}>
            <Glyph value={METHOD_ICON[m]} size={44} rounded="square" color={active ? colors.accent : colors.textDim} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <T bold size={16}>{info.name}</T>
              <T dim size={12}>{info.blurb}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T bold size={16}>{p ?? '—'}</T>
              <T faint size={11}>{plan === 'yearly' ? 'per year' : 'per month'}</T>
            </View>
            <View style={{ marginLeft: 10, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: active ? colors.accent : colors.accentLight, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.accent : 'transparent' }}>
              {active ? <Icon name="check" size={13} color="#fff" strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
      {gateways !== null && methods.length === 0 ? (
        <Card>
          <T dim size={14}>
            Payments aren't switched on yet. (Add your Razorpay / PayPal keys and plan IDs as Supabase secrets — see README.)
          </T>
        </Card>
      ) : null}

      <Btn
        title={price ? `Subscribe · ${price}` : 'Subscribe'}
        icon="lock"
        loading={busy}
        disabled={!method || !price}
        onPress={subscribe}
        style={{ marginTop: 10 }}
      />
      {billingAvailable && pkgs.length ? (
        <Btn title="Restore store purchases" kind="ghost" style={{ marginTop: 10 }} onPress={doRestore} />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
        <Icon name="shield" size={14} color={colors.textFaint} style={{ marginRight: 6 }} />
        <T faint size={12}>Secure checkout · MoodCircle never sees your card details</T>
      </View>
      <T faint size={11} style={{ textAlign: 'center', marginTop: 10 }}>
        {isStore
          ? `Payment is charged to your ${Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account. The subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel anytime in your ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} subscriptions.`
          : `Your ${method ? GATEWAY_INFO[method as Gateway]?.name ?? '' : ''} subscription renews automatically each ${plan === 'yearly' ? 'year' : 'month'} until you cancel. Cancel anytime in Settings → Subscription & payment; you keep Plus until the end of the paid period.`}
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }} onPress={() => router.push('/legal/terms')}>Terms of Use</Text>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>  ·  </Text>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }} onPress={() => router.push('/legal/privacy-policy')}>Privacy Policy</Text>
        {Platform.OS === 'ios' && isStore ? (
          <>
            <Text style={{ color: colors.textFaint, fontSize: 12 }}>  ·  </Text>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>Apple EULA</Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
