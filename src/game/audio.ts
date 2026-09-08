let context: AudioContext | undefined;
let enabled = localStorage.getItem("flock-sound") !== "off";
let birdTimer: ReturnType<typeof setInterval> | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let musicEnabled = localStorage.getItem("flock-music") !== "off";
let musicBus: GainNode | undefined;
let nextBarAt = 0;
let bar = 0;

export function getMusic() {
  return musicEnabled;
}
export function setMusic(value: boolean) {
  musicEnabled = value;
  localStorage.setItem("flock-music", value ? "on" : "off");
  if (context && musicBus)
    musicBus.gain.setTargetAtTime(value ? 1 : 0, context.currentTime, 0.2);
}

export function setSound(value: boolean) {
  enabled = value;
  localStorage.setItem("flock-sound", value ? "on" : "off");
  if (!value && context?.state === "running") void context.suspend();
  if (value && context?.state === "suspended") void context.resume();
}
export function getSound() {
  return enabled;
}
function tone(
  frequency: number,
  delay: number,
  length: number,
  volume = 0.06,
  type: OscillatorType = "sine",
  endFrequency?: number,
  background = false,
) {
  if (!context || !enabled) return;
  const osc = context.createOscillator(),
    gain = context.createGain(),
    t = context.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (endFrequency)
    osc.frequency.exponentialRampToValueAtTime(endFrequency, t + length);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + (background ? 0.025 : 0.012));
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  osc.connect(gain);
  gain.connect(background && musicBus ? musicBus : context.destination);
  osc.start(t);
  osc.stop(t + length + 0.01);
}
export function unlockAudio() {
  if (!enabled) return;
  if (!context) {
    context = new AudioContext();
    musicBus = context.createGain();
    musicBus.gain.value = musicEnabled ? 1 : 0;
    musicBus.connect(context.destination);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void context?.suspend();
      else if (enabled) {
        nextBarAt = 0;
        void context?.resume();
      }
    });
  }
  if (context.state === "suspended") void context.resume();
  if (!musicTimer) {
    // An original, unhurried sixteen-bar music-box theme in D major.
    const melody = [
      [74, null, 78, 81, null, 78, 76, null],
      [73, null, 76, 78, null, 76, 73, null],
      [71, null, 74, 78, 81, null, 78, 74],
      [69, null, 73, null, 76, 74, 73, null],
      [74, 78, 81, null, 83, null, 81, 78],
      [76, null, 78, null, 81, 78, 76, null],
      [74, null, 71, 74, 78, null, 76, null],
      [73, 76, 74, null, null, null, null, null],
    ];
    const bass = [50, 49, 47, 45, 50, 54, 55, 45];
    const beat = 60 / 76;
    const schedule = () => {
      if (!context || document.hidden || !enabled) return;
      if (nextBarAt > context.currentTime + 0.5) return;
      const delay = Math.max(0.05, nextBarAt - context.currentTime);
      const row = bar % melody.length;
      const variation = Math.floor(bar / melody.length) % 2;
      const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
      melody[row].forEach((note, i) => {
        if (note !== null)
          tone(
            hz(note - variation * 12),
            delay + i * beat,
            1.65,
            0.012,
            "sine",
            undefined,
            true,
          );
      });
      tone(hz(bass[row]), delay, 3.5, 0.017, "sine", undefined, true);
      tone(
        hz(bass[row] + 7),
        delay + 3 * beat,
        2.5,
        0.009,
        "sine",
        undefined,
        true,
      );
      nextBarAt = context.currentTime + delay + 8 * beat;
      bar++;
    };
    schedule();
    musicTimer = setInterval(schedule, 250);
  }
  if (!birdTimer)
    birdTimer = setInterval(() => {
      if (document.hidden || !enabled) return;
      const f = 1900 + Math.random() * 700;
      tone(f, 0, 0.16, 0.012, "sine", f * 1.3);
      tone(f * 1.1, 0.22, 0.12, 0.01, "sine", f * 0.8);
    }, 12000);
}
export function playSound(type = "click") {
  unlockAudio();
  if (type === "error") {
    tone(220, 0, 0.12, 0.035);
    tone(180, 0.08, 0.16, 0.02);
    return;
  }
  if (type === "pet" || type === "feed") {
    tone(310, 0, 0.13, 0.04, "triangle", 440);
    tone(440, 0.1, 0.15, 0.03, "triangle", 310);
    return;
  }
  if (
    type === "harvest" ||
    type === "order" ||
    type === "sell" ||
    type === "breed"
  ) {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.065, 0.3, 0.035));
    return;
  }
  if (type === "whistle") {
    tone(1300, 0, 0.28, 0.025, "sine", 1800);
    tone(1600, 0.3, 0.3, 0.02, "sine", 1100);
    return;
  }
  if (type === "jump") {
    tone(240, 0, 0.17, 0.018, "sine", 430);
    return;
  }
  if (type === "water") {
    [900, 1100, 800, 1400].forEach((f, i) => tone(f, i * 0.05, 0.09, 0.015));
    return;
  }
  tone(type === "shear" ? 780 : 660, 0, 0.12, 0.025, "sine");
  tone(880, 0.05, 0.12, 0.015);
}
