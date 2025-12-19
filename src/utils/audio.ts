// Web Audio API Synth Utilities

const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;

const getCtx = () => {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
};

// 10 Sound Options
export const SOUND_OPTIONS = [
    { id: 'none', name: '无报警音' },
    { id: 'radar', name: 'Radar' },       // Classic Radar Alarm
    { id: 'pulse', name: 'Pulse' },       // Deep Pulse
    { id: 'digital', name: 'Digital' },   // Digital Watch
    { id: 'crystal', name: 'Crystal' },   // High Chime
    { id: 'urgent', name: 'Urgent' },     // Fast Siren
    { id: 'sonar', name: 'Sonar' },       // Submarine
    { id: 'cosmic', name: 'Cosmic' },     // Sci-fi Sweep
    { id: 'alert', name: 'Alert' },       // Standard Alert
    { id: 'retro', name: 'Retro' },       // 8-bit
    { id: 'gong', name: 'Gong' },         // Low bell
];

const createOsc = (ctx: AudioContext, type: OscillatorType, freq: number, start: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
    return { osc, gain };
};

export const playSound = async (type: string) => {
    if (type === 'none') return;

    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;

    switch (type) {
        case 'radar':
            // High pitch repeating pulses
            for (let i = 0; i < 3; i++) {
                const t = now + i * 0.1;
                const { gain } = createOsc(ctx, 'triangle', 1500, t, 0.08);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.05);
            }
            break;

        case 'pulse':
            const { gain: pGain } = createOsc(ctx, 'sine', 200, now, 0.3);
            pGain.gain.setValueAtTime(0, now);
            pGain.gain.linearRampToValueAtTime(0.3, now + 0.1);
            pGain.gain.linearRampToValueAtTime(0, now + 0.3);
            break;

        case 'digital':
            // beep-beep
            createOsc(ctx, 'square', 1200, now, 0.05).gain.gain.value = 0.05;
            createOsc(ctx, 'square', 1200, now + 0.1, 0.05).gain.gain.value = 0.05;
            break;

        case 'crystal':
            const { gain: cGain } = createOsc(ctx, 'sine', 1800, now, 0.5);
            cGain.gain.setValueAtTime(0.1, now);
            cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            break;

        case 'urgent':
            const { gain: uGain, osc: uOsc } = createOsc(ctx, 'sawtooth', 800, now, 0.2);
            uOsc.frequency.linearRampToValueAtTime(400, now + 0.2);
            uGain.gain.setValueAtTime(0.1, now);
            uGain.gain.linearRampToValueAtTime(0, now + 0.2);
            break;

        case 'sonar':
            const { gain: sGain } = createOsc(ctx, 'sine', 600, now, 0.4);
            sGain.gain.setValueAtTime(0.05, now);
            sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            break;

        case 'cosmic':
            const { gain: cosGain, osc: cosOsc } = createOsc(ctx, 'sine', 400, now, 0.4);
            cosOsc.frequency.linearRampToValueAtTime(1200, now + 0.4);
            cosGain.gain.setValueAtTime(0.05, now);
            cosGain.gain.linearRampToValueAtTime(0, now + 0.4);
            break;

        case 'alert':
            createOsc(ctx, 'square', 660, now, 0.15).gain.gain.value = 0.05;
            createOsc(ctx, 'square', 550, now + 0.15, 0.15).gain.gain.value = 0.05;
            break;

        case 'retro':
            const { osc: rOsc, gain: rGain } = createOsc(ctx, 'square', 220, now, 0.2);
            rOsc.frequency.setValueAtTime(220, now);
            rOsc.frequency.setValueAtTime(440, now + 0.05);
            rOsc.frequency.setValueAtTime(880, now + 0.1);
            rOsc.frequency.setValueAtTime(110, now + 0.15);
            rGain.gain.value = 0.05;
            break;

        case 'gong':
            const { gain: gGain } = createOsc(ctx, 'sine', 200, now, 0.8);
            gGain.gain.setValueAtTime(0.2, now);
            gGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            break;
    }
};



// New Helper for Warning Sequence
// User Request: Play 10 times, interval 0.7s
export const playWarningSequence = (type: string) => {
    if (type === 'none') return;

    let count = 0;
    const max = 10;
    const interval = 1000; // 1s interval

    const playLoop = () => {
        if (count >= max) return;
        playSound(type);
        count++;
        setTimeout(playLoop, interval);
    };

    playLoop();
};
