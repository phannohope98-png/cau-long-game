// Âm thanh tổng hợp bằng WebAudio (không cần file): tiếng vợt, đập, lưới, còi, khán giả.
(function (G) {
  const BL = G.BL;
  const S = (BL.Sound = { on: true });
  let ac = null, noiseBuf = null;

  function ensure() {
    if (ac) return ac;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  S.unlock = function () { const a = ensure(); if (a && a.state === 'suspended') a.resume(); };

  function noise(t0, dur, freq, q, gain, type) {
    const a = ac, src = a.createBufferSource();
    src.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  function tone(t0, dur, f0, f1, gain, type) {
    const a = ac, o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  S.play = function (name, k) {
    if (!S.on || !ensure() || ac.state !== 'running') return;
    const t = ac.currentTime + 0.005;
    k = k || 1;
    switch (name) {
      case 'hit': noise(t, 0.07, 2600, 3, 0.35 * k); tone(t, 0.05, 1400, 700, 0.08 * k, 'triangle'); break;
      case 'smash': noise(t, 0.12, 1800, 1.5, 0.7); tone(t, 0.09, 900, 300, 0.2, 'triangle'); noise(t + 0.02, 0.25, 600, 0.8, 0.12, 'lowpass'); break;
      case 'soft': noise(t, 0.05, 3200, 4, 0.18); break;
      case 'net': noise(t, 0.18, 400, 1, 0.25, 'lowpass'); break;
      case 'land': noise(t, 0.06, 1200, 2, 0.12); break;
      case 'whistle': tone(t, 0.35, 2900, 2700, 0.12, 'square'); tone(t + 0.05, 0.3, 2950, 2750, 0.05, 'sine'); break;
      case 'squeak': tone(t, 0.07, 1800 + Math.random() * 900, 2600, 0.03, 'sine'); break;
      case 'cheer': noise(t, 1.4, 900, 0.5, 0.18 * k, 'bandpass'); noise(t + 0.1, 1.2, 1800, 0.6, 0.09 * k); break;
      case 'aww': tone(t, 0.6, 320, 200, 0.05, 'sawtooth'); noise(t, 0.7, 500, 0.6, 0.06); break;
      case 'click': tone(t, 0.04, 900, 1200, 0.05, 'triangle'); break;
      case 'up': tone(t, 0.12, 600, 1200, 0.08, 'triangle'); break;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
