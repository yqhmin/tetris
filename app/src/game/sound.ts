/** Web Audio 合成音效，无需外部音频文件 */

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(v: boolean) {
  enabled = v
}

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface ToneOpts {
  type?: OscillatorType
  vol?: number
  delay?: number
  slide?: number // 滑音目标频率
}

function tone(freq: number, dur: number, opts: ToneOpts = {}) {
  if (!enabled) return
  const audio = ac()
  if (!audio) return
  const { type = 'square', vol = 0.06, delay = 0, slide } = opts
  const t0 = audio.currentTime + delay
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur)
  gain.gain.setValueAtTime(vol, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + dur)
}

export const sounds = {
  move() {
    tone(220, 0.045, { vol: 0.035 })
  },
  rotate() {
    tone(330, 0.06, { vol: 0.045 })
  },
  softDrop() {
    tone(180, 0.03, { vol: 0.02 })
  },
  hardDrop() {
    tone(160, 0.1, { type: 'sawtooth', vol: 0.09, slide: 60 })
  },
  lock() {
    tone(140, 0.07, { vol: 0.05 })
  },
  /** 消行：行数越多琶音越华丽 */
  clear(n: number) {
    const base = [523, 659, 784, 1047]
    for (let i = 0; i < Math.min(n + 1, 4); i++) {
      tone(base[i], 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.06 })
    }
    if (n >= 4) tone(1319, 0.25, { type: 'triangle', vol: 0.1, delay: 0.28 })
  },
  levelUp() {
    ;[523, 659, 784].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.08, delay: i * 0.08 }))
  },
  start() {
    ;[392, 523, 659].forEach((f, i) => tone(f, 0.09, { type: 'triangle', vol: 0.07, delay: i * 0.07 }))
  },
  pause() {
    tone(440, 0.08, { vol: 0.05 })
  },
  over() {
    ;[392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', vol: 0.07, delay: i * 0.18 }))
  },
}
