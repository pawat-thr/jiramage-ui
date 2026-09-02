import { getNotifSound } from './prefs.js'

// Messenger-style two-tone pop, synthesized with Web Audio — no audio asset.
// Browsers block sound before the first user interaction; when that happens we
// queue ONE retry on the next click/keypress instead of dropping the ping.

let ctx = null
let retryArmed = false

const getCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)())

function beep(ac, soft) {
  const t0 = ac.currentTime
  const peak = soft ? 0.06 : 0.14
  const note = (freq, start, dur) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t0 + start)
    gain.gain.linearRampToValueAtTime(peak, t0 + start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(t0 + start)
    osc.stop(t0 + start + dur + 0.02)
  }
  note(659, 0, 0.18) // E5
  note(988, 0.09, 0.22) // B5
}

// soft=true → quieter tone (used for the periodic reminder).
export function playPing(soft = false) {
  if (!getNotifSound()) return
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') {
      // Autoplay-blocked (fresh load/refresh, no interaction yet): play on
      // the user's first click or keypress instead.
      if (retryArmed) return
      retryArmed = true
      const retry = () => {
        retryArmed = false
        window.removeEventListener('pointerdown', retry)
        window.removeEventListener('keydown', retry)
        ac.resume()
          .then(() => beep(ac, soft))
          .catch(() => {})
      }
      window.addEventListener('pointerdown', retry, { once: true })
      window.addEventListener('keydown', retry, { once: true })
      return
    }
    beep(ac, soft)
  } catch {
    // no Web Audio support — silently skip
  }
}
