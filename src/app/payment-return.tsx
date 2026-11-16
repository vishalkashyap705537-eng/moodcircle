// Deep link target after a Razorpay / PayPal checkout (moodcircle://payment-return).
// The checkout screen already confirms the payment with the server; this screen only makes
// sure the link never lands on a "page not found" and sends the user back to where they were.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Loading } from '../components/ui';

export default function PaymentReturn() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/subscription');
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return <Loading />;
}
