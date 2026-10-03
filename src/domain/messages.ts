import { formatDate, inr } from './dates';
import type { CaseStatus, Hazard, Lang } from './types';

export interface MessageContext {
  name: string;
  area: string;
  hazard: Hazard;
  status: CaseStatus;
  /** Next amount and date the borrower currently owes, from the mock loan system. */
  nextAmount?: number;
  nextDueDate?: string;
  /** Proposal details, when one exists. */
  amount?: number;
  fromDate?: string;
  toDate?: string;
  total?: number;
}

const HAZARD_WORD: Record<Lang, Record<Hazard, string>> = {
  en: { heat: 'extreme heat', flood: 'flooding', drought: 'drought' },
  hi: { heat: 'तेज़ गर्मी', flood: 'बाढ़', drought: 'सूखे' },
};

/**
 * Borrower message preview for the current case state. Nothing is sent in the demo.
 * The message always reflects the official schedule: a change is described as
 * done only once the case is applied and confirmed.
 */
export function buildMessage(lang: Lang, c: MessageContext): string {
  const hz = HAZARD_WORD[lang][c.hazard];
  const d = (iso?: string) => (iso ? formatDate(iso, lang) : '');
  const amt = (n?: number) => (n === undefined ? '' : inr(n));
  const next = c.nextAmount !== undefined && c.nextDueDate !== undefined;

  if (lang === 'hi') {
    const hello = `नमस्ते ${c.name} जी।`;
    const unchanged = next
      ? `आपकी किस्तों में कोई बदलाव नहीं हुआ है। अगली किस्त ${amt(c.nextAmount)}, ${d(c.nextDueDate)} को देय है।`
      : 'आपकी किस्तों में कोई बदलाव नहीं हुआ है।';
    switch (c.status) {
      case 'warning_only':
        return `${hello} ${c.area} के लिए ${hz} की चेतावनी है। कृपया सावधानी रखें। यह केवल जानकारी है। ${unchanged}`;
      case 'proposal_ready':
        return `${hello} ${c.area} में ${hz} के कारण आपके लिए किस्त में राहत का प्रस्ताव है। ${d(c.fromDate)} की ${amt(c.amount)} की किस्त ${d(c.toDate)} को देनी होगी। बाकी किस्तें पहले जैसी रहेंगी। कुल बकाया ${amt(c.total)} ही रहेगा। यह किस्त आगे बढ़ाई गई है, माफ़ नहीं की गई है। कोई अतिरिक्त शुल्क नहीं है। आप इसे स्वीकार या अस्वीकार कर सकती हैं।`;
      case 'accepted':
      case 'approved':
      case 'applying':
      case 'failed':
      case 'unknown':
        return `${hello} आपकी सहमति दर्ज हो गई है। बदलाव की पुष्टि अभी बाकी है। पुष्टि होने तक ${unchanged}`;
      case 'applied':
        return `${hello} बदलाव की पुष्टि हो गई है। ${d(c.fromDate)} को आपको कुछ नहीं देना है। ${amt(c.amount)} की वह किस्त अब ${d(c.toDate)} को देय है। कुल बकाया ${amt(c.total)} ही है।${next ? ` अगली किस्त ${amt(c.nextAmount)}, ${d(c.nextDueDate)} को देय है।` : ''}`;
      case 'declined':
        return `${hello} आपने प्रस्ताव अस्वीकार किया है। ${unchanged}`;
      case 'rejected':
        return `${hello} इस बार राहत का प्रस्ताव मंज़ूर नहीं हुआ। ${unchanged} सहायता के लिए अपने फ़ील्ड अधिकारी से बात करें।`;
      case 'review_required':
        return `${hello} हमारी टीम आपके मामले की समीक्षा कर रही है। ${unchanged}`;
      default:
        return `${hello} ${unchanged}`;
    }
  }

  const hello = `Hello ${c.name}.`;
  const unchanged = next
    ? `Your instalments have not changed. Your next instalment of ${amt(c.nextAmount)} is due on ${d(c.nextDueDate)}.`
    : 'Your instalments have not changed.';
  switch (c.status) {
    case 'warning_only':
      return `${hello} There is a warning of ${hz} for ${c.area}. Please take care. This is for information only. ${unchanged}`;
    case 'proposal_ready':
      return `${hello} Because of ${hz} in ${c.area}, we can offer to delay one instalment. Your ${amt(c.amount)} instalment due on ${d(c.fromDate)} would move to ${d(c.toDate)}. Your other instalments stay the same. The total you owe stays at ${amt(c.total)}. The instalment is postponed, not cancelled. There is no extra charge. You can accept or decline.`;
    case 'accepted':
    case 'approved':
    case 'applying':
    case 'failed':
    case 'unknown':
      return `${hello} Your acceptance is recorded. The change is not confirmed yet. Until it is confirmed: ${unchanged}`;
    case 'applied':
      return `${hello} The change is confirmed. You pay nothing on ${d(c.fromDate)}. That ${amt(c.amount)} instalment is now due on ${d(c.toDate)}. The total you owe is still ${amt(c.total)}.${next ? ` Your next instalment of ${amt(c.nextAmount)} is due on ${d(c.nextDueDate)}.` : ''}`;
    case 'declined':
      return `${hello} You declined the offer. ${unchanged}`;
    case 'rejected':
      return `${hello} The offer to delay an instalment was not approved this time. ${unchanged} Please speak to your field officer if you need help.`;
    case 'review_required':
      return `${hello} Our team is reviewing your case. ${unchanged}`;
    default:
      return `${hello} ${unchanged}`;
  }
}
