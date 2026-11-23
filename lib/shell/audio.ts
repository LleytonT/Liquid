/**
 * Synthesized one-shots. No sample files. Games choose when to call them.
 * Visuals that match a sound should wait SOUND_LEAD_MS.
 */

export const SOUND_LEAD_MS = 80

/** Major pentatonic from C5. playScaleNote walks it and wraps. */
export const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880] as const

let context: AudioContext | null = null
let scaleStep = 0

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!context) context = new AudioContext()
  return context
}

export function unlockAudio(): void {
  const ctx = audio()
  if (ctx && ctx.state === "suspended") void ctx.resume()
}

export function resetScale(): void {
  scaleStep = 0
}

export function playBlip(options: {
  frequency: number
  type?: OscillatorType
  gain?: number
  duration?: number
  slideTo?: number
}): void {
  const ctx = audio()
  if (!ctx || ctx.state !== "running") return
  const t = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const amp = ctx.createGain()
  oscillator.type = options.type ?? "sine"
  oscillator.frequency.setValueAtTime(options.frequency, t)
  if (options.slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.slideTo), t + (options.duration ?? 0.12))
  }
  const peak = options.gain ?? 0.12
  const duration = options.duration ?? 0.12
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.008)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(amp)
  amp.connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + duration + 0.02)
}

function tone(
  ctx: AudioContext,
  frequency: number,
  type: OscillatorType,
  gain: number,
  duration: number,
): void {
  const t = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const amp = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(amp)
  amp.connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + duration + 0.02)
}

/** Next note of the pentatonic scale. */
export function playScaleNote(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== "running") return
  const frequency = PENTATONIC[scaleStep % PENTATONIC.length]
  scaleStep += 1
  tone(ctx, frequency, "triangle", 0.16, 0.24)
}

/** Soft low thump. */
export function playThump(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== "running") return
  const t = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const amp = ctx.createGain()
  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(146, t)
  oscillator.frequency.exponentialRampToValueAtTime(44, t + 0.2)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(0.32, t + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
  oscillator.connect(amp)
  amp.connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + 0.3)
}

/** Short major chord. */
export function playChord(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== "running") return
  for (const frequency of [261.63, 329.63, 392]) {
    tone(ctx, frequency, "sine", 0.07, 0.62)
  }
}
