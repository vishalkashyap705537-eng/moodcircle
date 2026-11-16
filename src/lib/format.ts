export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function ageFrom(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Light client-side checks so users get instant feedback; the server
// enforces the real word list.
const QUICK_BLOCK = /\b(fuck|bitch|cunt|madarchod|behenchod|bhenchod|chutiya|bhosdike|kys)\b/i;
export function quickModerate(text: string): string | null {
  if (QUICK_BLOCK.test(text)) return 'Please keep it kind — that language is not allowed here.';
  if (/(\+?\d[\d\s-]{8,}\d)/.test(text)) return 'For your safety, please don’t share phone numbers.';
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return 'For your safety, please don’t share email addresses.';
  return null;
}
