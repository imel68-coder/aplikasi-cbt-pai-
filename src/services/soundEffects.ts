/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Audio synthesis for CBT Exam countdown and sound effects using Web Audio API
class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check saved mute preference from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cbt_sound_muted');
        if (saved !== null) {
          this.isMuted = saved === 'true';
        }
      } catch (e) {
        // ignore
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('cbt_sound_muted', String(this.isMuted));
    } catch (e) {}
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('cbt_sound_muted', String(muted));
    } catch (e) {}
  }

  /**
   * Suara musik / denyut hitung mundur 10 detik terakhir
   * @param secondsRemaining sisa waktu dalam detik (10 down to 1)
   */
  public playCountdownTick(secondsRemaining: number) {
    if (this.isMuted || secondsRemaining <= 0 || secondsRemaining > 10) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. BASE TENSION SUB-PULSE (Memberikan rasa tegang/musik debar jantung)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      
      // Frekuensi bass meningkat sedikit saat mendekati 1 detik
      const bassFreq = 80 + (10 - secondsRemaining) * 8; // 80Hz -> 152Hz
      subOsc.frequency.setValueAtTime(bassFreq, now);
      subOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.5, now + 0.15);

      subGain.gain.setValueAtTime(0.22, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.2);

      // 2. CRISP COUNTDOWN METRONOME / RADAR BEEP
      // Nada semakin tinggi dan tajam saat waktu semakin mendekati 0
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();
      
      // Escalate pitch: detik 10 (620Hz) hingga detik 1 (1350Hz)
      const baseFreq = 600 + (10 - secondsRemaining) * 75; // 600Hz -> 1275Hz
      const isCritical = secondsRemaining <= 3; // 3, 2, 1 detik terakhir lebih intens

      tickOsc.type = isCritical ? 'sawtooth' : 'sine';
      tickOsc.frequency.setValueAtTime(baseFreq, now);
      if (isCritical) {
        // Nada naik cepat (urgent beep)
        tickOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.1);
      }

      const volume = isCritical ? 0.35 : 0.25;
      const duration = isCritical ? 0.18 : 0.12;

      tickGain.gain.setValueAtTime(volume, now);
      tickGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      tickOsc.connect(tickGain);
      tickGain.connect(ctx.destination);
      tickOsc.start(now);
      tickOsc.stop(now + duration + 0.02);

      // 3. JIKA DETIK 3, 2, 1: Tambahkan double ping kedua (urgent alarm pulse)
      if (isCritical) {
        const ping2Time = now + 0.08;
        const ping2Osc = ctx.createOscillator();
        const ping2Gain = ctx.createGain();
        ping2Osc.type = 'sine';
        ping2Osc.frequency.setValueAtTime(baseFreq * 1.5, ping2Time);

        ping2Gain.gain.setValueAtTime(0.25, ping2Time);
        ping2Gain.gain.exponentialRampToValueAtTime(0.001, ping2Time + 0.1);

        ping2Osc.connect(ping2Gain);
        ping2Gain.connect(ctx.destination);
        ping2Osc.start(ping2Time);
        ping2Osc.stop(ping2Time + 0.12);
      }
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  /**
   * Suara bel / lonceng ketika waktu habis (0 detik)
   * Menandakan bahwa waktu 3 menit selesai dan soal berikutnya telah terbuka
   */
  public playTimeUpSound() {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Akor harmonis (G4, C5, E5, G5) yang menandakan waktu selesai
      const notes = [392.00, 523.25, 659.25, 783.99];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.65);
      });
    } catch (e) {
      console.warn('Audio time-up error:', e);
    }
  }

  /**
   * Suara klik / interaksi opsi soal
   */
  public playClickSound() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}

export const soundEffects = new SoundEffectsService();
