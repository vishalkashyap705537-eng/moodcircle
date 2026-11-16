# MoodCircle

A mood-based peer-support community for **Android and iPhone**, built from one codebase
(Expo / React Native + Supabase).

**How it works:** pick your mood → join matching circles → group chat, anonymous posts, reactions and comments → 18+ private DMs that the other person has to accept.
Admins get a full moderation panel inside the app.

---

## What's inside

| # | User screens | File |
|---|---|---|
| 1 | Splash | `src/app/index.tsx` |
| 2 | Welcome | `src/app/(auth)/welcome.tsx` |
| 3 | Age / DOB (18+ gate, also enforced on the server) | `src/app/(auth)/age.tsx` |
| 4 | Sign up | `src/app/(auth)/signup.tsx` |
| 5 | Login (+ forgot password) | `src/app/(auth)/login.tsx` |
| 6 | Mood selection → recommended circles | `src/app/mood.tsx` |
| 7 | Home | `src/app/(tabs)/home.tsx` |
| 8 | Community discovery | `src/app/(tabs)/discover.tsx` |
| 9 | Community detail | `src/app/community/[id]/index.tsx` |
| 10 | Group chat (real-time) | `src/app/community/[id]/chat.tsx` |
| 11–12 | Create post + anonymous option | `src/app/post/create.tsx` |
| 13–14 | Post detail + comments | `src/app/post/[id].tsx` |
| 15 | Notifications | `src/app/(tabs)/notifications.tsx` |
| 16 | DM requests | `src/app/dm/requests.tsx` |
| 17 | DM chat (real-time) | `src/app/dm/[id].tsx` |
| 18 | Profile (own) / public profile | `src/app/(tabs)/profile.tsx`, `src/app/user/[id].tsx` |
| 19 | Edit profile | `src/app/profile/edit.tsx` |
| 20 | Settings (+ delete account) | `src/app/settings/index.tsx` |
| 21 | Privacy | `src/app/settings/privacy.tsx` |
| 22 | Blocked users | `src/app/settings/blocked.tsx` |
| 23 | Report | `src/app/report.tsx` |
| 24 | Premium | `src/app/premium.tsx` |
| 25 | Subscription / payment | `src/app/subscription.tsx` |
| 26 | Help & safety (helplines) | `src/app/settings/help.tsx` |
| 27 | Terms | `src/app/legal/terms.tsx` |
| 28 | Privacy policy | `src/app/legal/privacy-policy.tsx` |

**Admin** (only visible to admin accounts, under Me → Admin panel): Dashboard, Users, Communities,
Posts, Comments, Reports, Moderation queue (+ bad-word list editor), Banned/suspended users,
Premium/subscriptions, Analytics — all in `src/app/admin/`.

**Safety rules are enforced on the server** (`supabase/migrations/001_init.sql`), not just in the app:
- Sign-up is rejected if the date of birth is under 18.
- Email and date of birth are never readable by other users.
- Anonymous posts/comments never expose the author to other users (admins can still see them).
- Bad language: "block" words are rejected, "flag" words go to the moderation queue (both lists editable by admins).
- DMs only after the other person accepts. Free: 3 requests/day, Premium: 50/day.
- Blocked users disappear from each other's feeds, comments and chats.
- Banned/suspended users can't post, chat, comment or message.
- Users can't make themselves admin or premium.

---

## Step 1 — Supabase (backend, free tier is fine)

1. Create a project at **supabase.com**.
2. **SQL Editor → New query**, paste the whole of `supabase/migrations/001_init.sql`, click **Run**.
3. **Authentication → Sign In / Providers → Email**: keep it enabled. "Confirm email" ON is recommended.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key. You'll need them in Step 3.
5. Sign up in the app once, then make yourself admin in the SQL Editor:
   ```sql
   update profiles set is_admin = true where username = 'YourNickname';
   ```

## Step 2 — Premium payments: Razorpay + PayPal

The Premium screen offers **Razorpay** (UPI, cards, net banking, wallets — India) and **PayPal**
(international). The app never holds a secret key: it asks the `payments` Edge Function to create
the subscription, opens the gateway's secure checkout in an in-app browser, and the server confirms
the result. Webhooks keep Premium in sync for renewals, failed payments and cancellations.
Users can cancel from **Settings → Subscription & payment** and keep Plus until the paid period ends.

> **Store policy, please read:** Google Play and the Apple App Store require their own billing for
> digital subscriptions sold inside apps they distribute. A sideloaded APK (installed directly) is
> fine. Before publishing on Google Play, check Google's Payments policy / alternative billing
> programs for India, or switch the store build back to Play Billing (Step 2b). The App Store
> rejects external payment buttons for digital goods in most regions.

**2.1 Database** — in the Supabase SQL Editor, run `supabase/migrations/002_payments.sql`
(after `001_init.sql`). It only adds columns/tables; nothing existing changes.

**2.2 Razorpay** (dashboard.razorpay.com — start in **Test mode**)
1. **Account & Settings → API Keys** → generate a key → copy *Key ID* and *Key Secret*.
2. **Subscriptions → Plans** → create a *Monthly* plan and a *Yearly* plan (e.g. ₹99 / ₹799) → copy both `plan_…` IDs.
3. **Account & Settings → Webhooks → Add new webhook**
   - URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/payments-webhook?gateway=razorpay`
   - Secret: make up a long random string (this is `RAZORPAY_WEBHOOK_SECRET`)
   - Events: tick all **subscription.\*** events (activated, charged, pending, halted, cancelled, completed, paused, resumed, updated).

**2.3 PayPal** (developer.paypal.com — start in **Sandbox**)
1. **Apps & Credentials → Create App** (Merchant) → copy *Client ID* and *Secret*.
2. Create a **Product** and two **Subscription plans** (monthly + yearly), e.g. in the PayPal
   business dashboard → *Pay & Get Paid → Subscriptions*, or via the Plans API → copy both `P-…` IDs.
3. In your app → **Webhooks → Add Webhook**
   - URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/payments-webhook?gateway=paypal`
   - Events: all **Billing subscription** events + **Payment sale completed**
   - Copy the **Webhook ID**.

**2.4 Add the secrets to Supabase and deploy the functions**
```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in the values from 2.2 and 2.3
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy payments
npx supabase functions deploy payments-webhook --no-verify-jwt
```
That's it. No app rebuild is needed to switch gateways, change prices or move from test to live:
update the secrets (e.g. `rzp_live_…` keys, `PAYPAL_ENV=live`, live plan IDs) and the app picks
them up. Prices shown in the app are read live from your Razorpay/PayPal plans.

**Testing:** use Razorpay test mode (test UPI `success@razorpay` or test cards) and a PayPal
sandbox *personal* account. The server logic has automated tests you can run without any keys:
`deno test -A supabase/functions/tests/payments_e2e_test.ts`

### Step 2b — Optional: Google Play Billing + Apple In-App Purchase (RevenueCat)

Still supported and unchanged. If you set the RevenueCat keys below, the store option appears on
the Premium screen next to Razorpay and PayPal.

Both stores require their own billing for digital subscriptions, so the app uses
**RevenueCat** (free until $2.5k/month revenue). It handles both stores with one integration.

1. **Google Play Console → your app → Monetize → Subscriptions**: create `plus_monthly` and `plus_yearly`.
   (You need to upload one build to a testing track before you can create products. Use the `.aab` from Step 3.)
2. **App Store Connect → your app → Subscriptions**: make a group called "MoodCircle Plus" with `plus_monthly` and `plus_yearly`.
3. **RevenueCat** (app.revenuecat.com):
   - Add an Android app (package `com.moodcircle.app`, plus a Google service-account JSON) and an iOS app (bundle `com.moodcircle.app`, plus an App Store Connect API key).
   - **Products**: import the 4 products. **Entitlements**: create one called exactly **`premium`** and attach all products.
   - **Offerings**: make the `default` offering current, with a Monthly package and an Annual package.
   - **API keys**: copy the **Google** public key (`goog_…`) and the **Apple** public key (`appl_…`).
4. Connect RevenueCat to Supabase so the server knows who is premium:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=make-up-a-long-random-string
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```
   In RevenueCat → **Integrations → Webhooks**, set the URL to
   `https://YOUR-PROJECT-REF.supabase.co/functions/v1/revenuecat-webhook`
   and the Authorization header to `Bearer make-up-a-long-random-string`.

## Step 3 — Build the Android APK with GitHub (free)

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | from Step 1 |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | from Step 1 |
   | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `goog_…` from Step 2b (optional, can be blank) |
   | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `appl_…` from Step 2b (optional, can be blank) |

   Razorpay/PayPal keys are **not** GitHub secrets — they live only in Supabase (Step 2.4).

3. Go to **Actions → Build Android → Run workflow**. It takes about 15–25 minutes.
4. Open the finished run → **Artifacts → moodcircle-android**. Inside:
   - `MoodCircle.apk` — install this directly on any Android phone (allow "Install unknown apps").
   - `MoodCircle-playstore.aab` — upload this to Google Play.

### Signing for Google Play (do this once, before your first Play upload)
Without these secrets the APK is signed with a debug key. That's fine for testing on your own phone, but Google Play needs your own key.
```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.keystore     # macOS: base64 -i upload.keystore
```
Add these secrets: `ANDROID_KEYSTORE_BASE64` (the base64 output), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`.
**Back up `upload.keystore` and its passwords.** If you lose them you can't update the app.

## Step 4 — iPhone build

An `.apk` only runs on Android. iPhones install apps through **TestFlight** (for testing) or the **App Store**.

1. Join the **Apple Developer Program** ($99/year) and create the app in App Store Connect (bundle ID `com.moodcircle.app`).
2. Create a free **Expo** account at expo.dev, then run this once from any computer (Windows is fine, because the build runs in the cloud):
   ```bash
   npm install
   npx eas-cli login
   npx eas-cli init                                   # links the project; commit the app.json change
   npx eas-cli build -p ios --profile production      # signs in to Apple and creates certificates
   npx eas-cli submit -p ios --latest                 # sends it to TestFlight
   ```
3. Install **TestFlight** on your iPhone. The build shows up there within about 30 minutes of submitting.
4. After that, you can build again from GitHub: create an Expo access token (expo.dev → Account → Access tokens), add it as the secret
   `EXPO_TOKEN`, then run **Actions → Build iOS**.

## Step 5 — Before publishing to the stores

- **Change the identifiers** if you want your own: `app.json` → `name`, `ios.bundleIdentifier`, `android.package`.
- **Support email**: replace `support@moodcircle.app` in `src/app/settings/help.tsx` and both legal screens.
- **Privacy policy URL**: both stores require a public web link. Paste the text of `src/app/legal/privacy-policy.tsx` into a free page (Google Sites, Notion, etc.).
- **Icons and splash**: replace the files in `assets/` (icon 1024×1024).
- **Have the Terms and Privacy Policy reviewed by a lawyer.** The included text is a solid starting draft, not legal advice.
- **Google Play**: Content rating questionnaire (user interaction and user-generated content → Yes), Data safety form (email and user content collected, not shared/sold), target audience **18+**, and the account-deletion URL (in-app deletion is included under Settings).
- **App Store**: age rating 18+, mark "User-Generated Content" as Yes. The app already has the reporting, blocking, filtering and contact features Apple requires (guideline 1.2). Give the reviewer a demo login.

## Running it on your computer (optional)

```bash
npm install
cp .env.example .env        # fill in your keys
npx expo start              # scan the QR with the Expo Go app
```
Everything except purchases works in Expo Go. Store purchases (RevenueCat) only work in a real build from Step 3 or 4; Razorpay/PayPal checkout works in both.

## Project layout

```
src/app/          screens (every file is a route)
src/components/   shared UI (buttons, cards, post card, admin list), SVG icon set, font-aware Text
src/lib/          Supabase client, auth, billing, theme, helpers
supabase/         database schema, payments + webhook functions (Razorpay, PayPal, RevenueCat), tests
.github/workflows Android (APK/AAB) and iOS build pipelines
```

## Design system

- **Colours:** calm "sky" palette — `src/lib/theme.ts` (`colors`, `gradients`). Change a value there and it updates everywhere.
- **Fonts:** Outfit (headings/numbers) + Manrope (UI text), both free Google Fonts bundled in the app. Use `Text`/`TextInput` from `src/components/Text.tsx` so weights map to the right font file.
- **Icons:** Lucide line icons rendered with `react-native-svg` — `<Icon name="…" />` from `src/components/Icon.tsx`. No emoji are used in the interface. Mood, circle and avatar values already stored in your database (including old emoji values) are shown as matching icons automatically.
