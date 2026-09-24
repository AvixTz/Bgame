let ctx: AudioContext | null = null;
let muted = false;

export const setMuted = (m: boolean) => { muted = m; };
export const isMuted = () => muted;

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, vol = 0.12) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  correct: () => { tone(660, 0.12, 'triangle'); tone(880, 0.18, 'triangle', 0.1); },
  wrong: () => tone(220, 0.25, 'sine', 0, 0.08),
  coin: () => { tone(1320, 0.08, 'square', 0, 0.05); tone(1760, 0.12, 'square', 0.07, 0.05); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.12)),
  tap: () => tone(440, 0.05, 'sine', 0, 0.05),
};

/** Hebrew text-to-speech. Uses a he-IL voice when the device has one. */
export function speak(text: string) {
  if (muted || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[☐]/g, 'כמה').replace(/\n.*/s, ''));
    u.lang = 'he-IL';
    const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('he'));
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch { /* speech unavailable */ }
}
