export type SoundCue = 'ui' | 'start' | 'model' | 'action' | 'success' | 'warning' | 'reward'

type AudioContextWithWebkit = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

class AudioDirector {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private music: GainNode | null = null
  private effects: GainNode | null = null
  private musicTimer: number | null = null
  private musicStep = 0
  private enabled = false

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.stopMusic()
      if (this.context && this.master) {
        this.master.gain.cancelScheduledValues(this.context.currentTime)
        this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.035)
      }
      return
    }

    const context = this.ensureContext()
    if (!context || !this.master) return
    this.master.gain.cancelScheduledValues(context.currentTime)
    this.master.gain.setTargetAtTime(0.72, context.currentTime, 0.025)
    if (context.state === 'running') {
      this.startMusic()
    } else {
      void context.resume().then(() => {
        if (this.enabled) this.startMusic()
      }).catch(() => undefined)
    }
  }

  play(cue: SoundCue) {
    if (!this.enabled) return
    const context = this.ensureContext()
    if (!context || !this.effects) return
    const trigger = () => {
      if (!this.enabled) return
      this.startMusic()
      this.synthesize(cue)
    }
    if (context.state === 'running') {
      trigger()
    } else {
      void context.resume().then(trigger).catch(() => undefined)
    }
  }

  private synthesize(cue: SoundCue) {
    switch (cue) {
      case 'ui':
        this.tone(520, 0.055, 0.055, 'sine')
        this.tone(760, 0.07, 0.035, 'sine', 0.035)
        break
      case 'start':
        this.noise(0.18, 0.075)
        this.tone(110, 0.22, 0.1, 'sawtooth', 0, 220)
        this.tone(440, 0.22, 0.055, 'triangle', 0.12)
        this.tone(660, 0.28, 0.05, 'triangle', 0.19)
        break
      case 'model':
        this.tone(170, 0.13, 0.075, 'square', 0, 245)
        this.tone(740, 0.15, 0.06, 'sine', 0.075)
        this.tone(980, 0.1, 0.035, 'sine', 0.13)
        break
      case 'action':
        this.noise(0.095, 0.09)
        this.tone(125, 0.12, 0.09, 'square', 0, 95)
        this.tone(390, 0.08, 0.045, 'triangle', 0.055)
        break
      case 'success':
        this.tone(392, 0.16, 0.055, 'triangle')
        this.tone(523.25, 0.18, 0.055, 'triangle', 0.085)
        this.tone(659.25, 0.28, 0.06, 'triangle', 0.17)
        break
      case 'warning':
        this.tone(185, 0.18, 0.085, 'sawtooth', 0, 132)
        this.tone(138, 0.2, 0.075, 'square', 0.12, 104)
        break
      case 'reward':
        this.tone(261.63, 0.16, 0.05, 'triangle')
        this.tone(392, 0.18, 0.05, 'triangle', 0.08)
        this.tone(523.25, 0.22, 0.055, 'triangle', 0.16)
        this.tone(783.99, 0.3, 0.04, 'sine', 0.24)
        break
    }
  }

  private ensureContext() {
    if (typeof window === 'undefined') return null
    if (this.context?.state === 'closed') {
      this.context = null
      this.master = null
      this.music = null
      this.effects = null
    }
    if (this.context) return this.context

    const AudioContextConstructor = window.AudioContext ?? (window as AudioContextWithWebkit).webkitAudioContext
    if (!AudioContextConstructor) return null
    const context = new AudioContextConstructor()
    const master = context.createGain()
    const music = context.createGain()
    const effects = context.createGain()
    master.gain.value = 0.72
    music.gain.value = 0.11
    effects.gain.value = 0.62
    music.connect(master)
    effects.connect(master)
    master.connect(context.destination)
    this.context = context
    this.master = master
    this.music = music
    this.effects = effects
    return context
  }

  private startMusic() {
    if (this.musicTimer !== null || this.context?.state !== 'running') return
    this.musicStep = 0
    this.playMusicStep()
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 620)
  }

  private stopMusic() {
    if (this.musicTimer === null || typeof window === 'undefined') return
    window.clearInterval(this.musicTimer)
    this.musicTimer = null
  }

  private playMusicStep() {
    if (!this.enabled || !this.context || !this.music) return
    const bass = [110, 110, 146.83, 110, 164.81, 146.83, 98, 123.47]
    const note = bass[this.musicStep % bass.length]
    this.tone(note, 0.42, 0.13, 'triangle', 0, undefined, this.music)
    if (this.musicStep % 2 === 1) {
      this.tone(note * 2, 0.12, 0.025, 'sine', 0.17, undefined, this.music)
    }
    if (this.musicStep % 4 === 3) {
      this.tone(note * 3, 0.18, 0.018, 'sine', 0.31, undefined, this.music)
    }
    this.musicStep += 1
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
    slideTo?: number,
    destination = this.effects,
  ) {
    if (!this.context || !destination) return
    const now = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.03)
  }

  private noise(duration: number, volume: number) {
    if (!this.context || !this.effects) return
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration))
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length)
    }
    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    filter.type = 'bandpass'
    filter.frequency.value = 820
    filter.Q.value = 0.8
    gain.gain.value = volume
    source.buffer = buffer
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.effects)
    source.start()
  }
}

export const audioDirector = new AudioDirector()
