// The desktop's sounds: the start-up sound from public/sounds, and a modem dialling for Dial-Up
// Networking, synthesized so it needs no file. Browsers may refuse to play before the visitor has
// clicked anything; that is simply silence.

const STARTUP = `${import.meta.env.BASE_URL}sounds/vista.mp3`

export function playStartup() {
  const audio = new Audio(STARTUP)
  audio.volume = 0.6
  audio.play().catch(() => {})
  return () => audio.pause()
}

// Touch-tone pairs (Hz) for the digits the modem dials.
const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477],
  4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
  0: [941, 1336],
}

// Dial tone, the number, then the handshake's screech. Returns a function that hangs up.
export function playModem(number = '5550199') {
  const Context = window.AudioContext ?? window.webkitAudioContext
  if (!Context) return () => {}
  const ctx = new Context()
  const out = ctx.createGain()
  out.gain.value = 0.08
  out.connect(ctx.destination)

  const tone = (frequencies, start, length, type = 'sine') => {
    for (const frequency of frequencies) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = frequency
      osc.connect(out)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + length)
    }
  }

  let t = 0
  tone([350, 440], t, 0.9) // dial tone
  t += 1
  for (const digit of number) {
    if (DTMF[digit]) tone(DTMF[digit], t, 0.09)
    t += 0.14
  }
  t += 0.5
  tone([2100], t, 0.9) // the answering modem
  t += 1
  // The handshake: a few seconds of warbling, alternating carriers.
  for (let i = 0; i < 14; i++) tone([i % 2 ? 1200 : 2400, 980 + (i % 3) * 200], t + i * 0.12, 0.12, 'square')

  return () => ctx.close().catch(() => {})
}
