// Store billing (Google Play Billing + Apple In-App Purchase) through RevenueCat.
// RevenueCat talks to both stores for you and calls our Supabase webhook,
// which marks the user as Premium on the server.
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) ?? '';

export const ENTITLEMENT = 'premium';
export const billingAvailable = Platform.OS !== 'web' && KEY.length > 0;

let configured = false;

export function identifyPurchaser(userId: string) {
  if (!billingAvailable) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: KEY, appUserID: userId });
      configured = true;
    } else {
      Purchases.logIn(userId).catch(() => {});
    }
  } catch {
    // Billing is unavailable in Expo Go; it works in real builds.
  }
}

export async function logoutPurchaser() {
  if (!billingAvailable || !configured) return;
  try {
    await Purchases.logOut();
  } catch {}
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!billingAvailable || !configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT];
}

export async function restore(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[ENTITLEMENT];
}

export async function manageUrl(): Promise<string | null> {
  if (!billingAvailable || !configured) return null;
  const info = await Purchases.getCustomerInfo();
  return info.managementURL ?? null;
}
