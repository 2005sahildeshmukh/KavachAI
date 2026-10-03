import { useEffect, useState } from 'react';
import { buildMessage, type MessageContext } from '../domain/messages';
import type { Lang } from '../domain/types';
import { useStore } from '../state/store';

const SPEECH_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN' };

export function MessagePreview({ borrowerId, context }: { borrowerId: string; context: MessageContext }) {
  const { dispatch, scenario } = useStore();
  const [lang, setLang] = useState<Lang>('en');
  const [speechNote, setSpeechNote] = useState('');
  const text = buildMessage(lang, context);
  const previewed = scenario.cases[borrowerId]?.messagePreviewedAt;

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechNote('Speech preview is not available in this browser. Please read the text above.');
      return;
    }
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voices.length > 0 && !voice) {
      setSpeechNote(`This browser has no ${lang === 'hi' ? 'Hindi' : 'English'} voice installed. Please read the text above.`);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG[lang];
    if (voice) utterance.voice = voice;
    utterance.rate = 0.9;
    utterance.onerror = () => setSpeechNote('Speech preview could not play. Please read the text above.');
    setSpeechNote('Playing a browser speech preview. Voice quality depends on your device.');
    synth.speak(utterance);
  };

  return (
    <div className="message">
      <div className="segmented" role="group" aria-label="Message language">
        {(['en', 'hi'] as Lang[]).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); setSpeechNote(''); }}>
            {l === 'en' ? 'English' : 'हिन्दी'}
          </button>
        ))}
      </div>
      <blockquote className="bubble" lang={lang}>
        {text}
      </blockquote>
      <p className="hint">Preview only. No message is sent in this demo. A message preview does not mean the loan has changed.</p>
      <div className="actions">
        <button type="button" className="btn" onClick={speak}>
          <span aria-hidden="true">▶</span> Speech preview
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'MESSAGE_PREVIEWED', borrowerId })}>
          Record that the preview was shown
        </button>
      </div>
      <p className="hint" role="status">
        {speechNote || (previewed ? 'Preview recorded in the activity history.' : '')}
      </p>
    </div>
  );
}
