// Design tokens — a calm, airy "sky" palette (soft periwinkle blues on near-white),
// matched to the MoodCircle reference design.
export const colors = {
  bg: '#EEF3FC',          // page background (pale sky)
  bgDeep: '#E3ECFB',      // gradient end / pressed backgrounds
  surface: '#FFFFFF',     // cards, grouped lists
  surface2: '#E4ECFB',    // tinted cards (profile card, inputs, secondary buttons)
  border: '#DCE5F6',
  text: '#2A2D3E',        // primary text (near-black ink)
  heading: '#4A62BF',     // big screen titles & section headings
  textDim: '#6C7BAE',     // secondary text
  textFaint: '#9DAED6',   // hints, timestamps
  accent: '#4F67C4',      // primary actions, active toggles, progress fill
  accentDark: '#3F55AE',
  accentLight: '#A9C3F3', // soft blue (nav buttons, rings)
  accentSoft: '#DCE6FB',  // subtle selected states
  lavender: '#B7C0F0',    // inactive toggle track
  onAccent: '#FFFFFF',
  danger: '#E2627A',
  dangerSoft: '#FCE8EC',
  success: '#3FAE8E',
  gold: '#E8B04B',        // premium ring / PLUS badge
  goldSoft: '#FBF1DC',
  shadow: '#4F67C4',
};

// Gradients for premium surfaces (used with expo-linear-gradient)
export const gradients = {
  primary: ['#6A84DD', '#4F67C4'] as const,
  sky: ['#F6F9FF', '#E6EEFC'] as const,
  orb: ['#B9D0F7', '#86A6EC'] as const,
  gold: ['#F3CB75', '#E2A33C'] as const,
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = {
  soft: { shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  lift: { shadowColor: colors.shadow, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

// Fonts (loaded in src/app/_layout.tsx). Outfit = display, Manrope = UI/body.
export const fonts = {
  display: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  displayMedium: 'Outfit_500Medium',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Reaction kinds are stored in the database; `icon` is the SVG icon used to show them.
export const REACTIONS = [
  { kind: 'hug', icon: 'hug', label: 'Hug' },
  { kind: 'same', icon: 'hand', label: 'Same' },
  { kind: 'support', icon: 'heart', label: 'Support' },
  { kind: 'strong', icon: 'zap', label: 'Stay strong' },
] as const;

// Avatar keys stored on the profile. Older accounts may still hold emoji values —
// those are mapped to matching icons by <Glyph>, so nothing breaks.
export const AVATARS = [
  'moon', 'star', 'flower', 'butterfly', 'cat', 'leaf', 'feather', 'bird',
  'waves', 'flame', 'clover', 'headphones', 'rainbow', 'planet', 'cloud', 'owl',
];

export const REPORT_REASONS = [
  'Harassment or bullying',
  'Hate speech',
  'Sexual content',
  'Spam or scam',
  'Self-harm concern',
  'Sharing personal information',
  'Underage user',
  'Something else',
];

// Soft tint of any hex colour, e.g. tint('#7C8CF8', 0.15)
export function tint(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return colors.accentSoft;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `#${h}${a}`;
}
