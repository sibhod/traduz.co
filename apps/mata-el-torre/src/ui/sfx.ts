/** Tiny WebAudio synth — zero assets. Each call is a short shaped oscillator blip. */
let ctx: AudioContext | null = null;
function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume(); // unlocks on first user gesture
  return ctx;
}

function blip(freq: number, ms: number, type: OscillatorType, toFreq?: number, gainPeak = 0.15): void {
  const ac = audio();
  if (ac.state === 'suspended') return; // pre-gesture (e.g. opening deal) — resume() was kicked, sound resumes on first tap
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, ac.currentTime + ms / 1000);
  gain.gain.setValueAtTime(gainPeak, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + ms / 1000);
}

export const sfx = {
  hit: () => blip(220, 160, 'square', 110),
  fizzle: () => blip(330, 350, 'sawtooth', 82),
  draw: () => blip(660, 60, 'triangle'),
  enemyAttack: () => blip(140, 250, 'square', 70),
  victory: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 180, 'triangle'), i * 110)),
  defeat: () => [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 260, 'sawtooth'), i * 160)),
};

let cachedVoices: SpeechSynthesisVoice[] | null = null;
function spanishVoice(): SpeechSynthesisVoice | null {
  if (!cachedVoices || cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => { cachedVoices = window.speechSynthesis.getVoices(); },
      { once: true },
    );
  }
  return (
    cachedVoices.find((v) => v.lang === 'es-MX') ??
    cachedVoices.find((v) => v.lang.startsWith('es')) ??
    null
  );
}

/** Speak a Spanish word via the browser's TTS — free listening reinforcement. */
export function speakSpanish(word: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.voice = spanishVoice();
  u.lang = u.voice?.lang ?? 'es-MX';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
