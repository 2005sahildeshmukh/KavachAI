import type { Lang } from './types';

/** Fixed simulation date for the whole demo. */
export const SIM_DATE = '2026-05-12';

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
};

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

function toIso(t: Date): string {
  return t.toISOString().slice(0, 10);
}

function utc(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  return toIso(new Date(utc(iso) + n * 86_400_000));
}

/** Same day-of-month n months later, clamped to the month's last day. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, lastDay))));
}

export function formatDate(iso: string, lang: Lang = 'en'): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[lang][m - 1]} ${y}`;
}

export function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
