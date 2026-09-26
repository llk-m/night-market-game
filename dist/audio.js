/* Original pentatonic night-market loop. Synthesized locally; no audio downloads. */
(() => {
  "use strict";
  class NightMarketAudio {
    constructor() {
      this.context = null;
      this.music = true;
      this.effects = true;
      this.volume = .55;
      this.timer = null;
      this.step = 0;
      this.voices = new Set();
    }
    init() {
      if (this.context) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.context = new Audio();
      this.musicGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.effectsGain.connect(this.context.destination);
      this.applyVolume();
    }
    applyVolume() {
      if (!this.context) return;
      this.musicGain.gain.setTargetAtTime(this.music ? this.volume : 0, this.context.currentTime, .04);
      this.effectsGain.gain.setTargetAtTime(this.effects ? .55 : 0, this.context.currentTime, .02);
    }
    configure({ music, effects, volume }) {
      this.music = music;
      this.effects = effects;
      this.volume = Math.max(0, Math.min(1, volume));
      this.applyVolume();
      if (!music) this.stop();
    }
    async unlock() {
      try {
        this.init();
        if (!this.context) return false;
        if (this.context.state === "suspended") await this.context.resume();
        return this.context.state === "running";
      } catch (_) { return false; }
    }
    tone(freq, time, duration, level, type, bus) {
      if (!this.context || this.context.state !== "running") return;
      const osc = this.context.createOscillator();
      const envelope = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(level, time + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
      osc.connect(envelope).connect(bus);
      const voice = { osc, envelope, music: bus === this.musicGain };
      this.voices.add(voice);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
      osc.start(time);
      osc.stop(time + duration + .025);
    }
    schedule() {
      if (!this.context || this.context.state !== "running" || !this.music) return;
      const now = this.context.currentTime;
      if (this.nextTime < now) this.nextTime = now + .03;
      // Four original phrases, 96 BPM, eight-note subdivisions.
      const melody = [76,79,81,0,79,76,74,0,72,74,76,79,76,0,74,0,
        76,79,84,81,79,0,76,74,72,76,74,0,72,0,0,0,
        81,84,86,84,81,79,76,0,79,81,79,76,74,0,76,0,
        72,74,76,79,81,79,76,74,72,0,74,76,72,0,0,0];
      const roots = [48,45,53,43];
      const hz = n => 440 * 2 ** ((n - 69) / 12);
      while (this.nextTime < now + .18) {
        const n = this.step % melody.length;
        const t = this.nextTime;
        if (melody[n]) {
          this.tone(hz(melody[n]), t, .48, .11, "triangle", this.musicGain);
          this.tone(hz(melody[n] + 12), t, .16, .018, "sine", this.musicGain);
        }
        const root = roots[Math.floor(n / 16)];
        if (n % 4 === 0) this.tone(hz(root), t, .5, .12, "sine", this.musicGain);
        if (n % 8 === 2) [12,19,24].forEach((interval, i) =>
          this.tone(hz(root + interval), t + i * .035, .7, .028, "triangle", this.musicGain));
        // Soft woodblock-like beat, deliberately quieter than the melody.
        if (n % 2 === 0) this.tone(n % 4 ? 740 : 160, t, .055, .035, "sine", this.musicGain);
        this.step++;
        this.nextTime += .3125;
      }
    }
    async start() {
      if (!await this.unlock()) return false;
      if (!this.music || this.timer !== null) return true;
      this.nextTime = this.context.currentTime + .04;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 80);
      return true;
    }
    stop() {
      clearInterval(this.timer);
      this.timer = null;
      for (const voice of this.voices) if (voice.music) {
        try { voice.osc.stop(); } catch (_) {}
      }
    }
    effect(freq) {
      if (!this.effects || this.context?.state !== "running") return;
      this.tone(freq, this.context.currentTime, .13, .09, "sine", this.effectsGain);
      if (freq >= 600) this.tone(freq * 1.25, this.context.currentTime + .075, .17, .05, "triangle", this.effectsGain);
    }
    get playing() { return this.music && this.timer !== null && this.context?.state === "running"; }
  }
  window.NightMarketAudio = NightMarketAudio;
})();
