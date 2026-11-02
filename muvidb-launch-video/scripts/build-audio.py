"""
Builds the film's sound design.

Everything here is synthesised from scratch, so the audio ships with no
licensing attached to it. Nothing imitates a real product's alert tone -- the
notification cue is an original two-note bell, not WhatsApp's sound, which is
copyrighted and must never be reproduced.

The cue times are read from the same frame numbers the composition animates
to, so a retime in ActorAlertFilm.tsx only has to be mirrored in CUES below.

Usage:  python scripts/build-audio.py
Writes: public/assets/audio/*.wav
"""

from __future__ import annotations

import math
import os
import wave

import numpy as np

SR = 44100
FPS = 30
DURATION_FRAMES = 1260
DURATION_S = DURATION_FRAMES / FPS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "audio")


# ---------------------------------------------------------------- primitives


def t(n: int) -> np.ndarray:
    """Time axis of n samples, in seconds."""
    return np.arange(n, dtype=np.float64) / SR


def env_ad(n: int, attack: float, decay: float, curve: float = 2.4) -> np.ndarray:
    """Percussive attack/decay envelope. `curve` shapes the decay tail."""
    x = t(n)
    a = np.clip(x / max(attack, 1e-6), 0.0, 1.0)
    d = np.exp(-x / max(decay, 1e-6) * curve)
    return a * d


def env_asr(n: int, attack: float, release: float) -> np.ndarray:
    """Slow swell with a matching release, for pads."""
    x = t(n)
    total = n / SR
    a = np.clip(x / max(attack, 1e-6), 0.0, 1.0)
    r = np.clip((total - x) / max(release, 1e-6), 0.0, 1.0)
    return a * r


def sine(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    return np.sin(2 * math.pi * freq * t(n) + phase)


def soft_clip(x: np.ndarray) -> np.ndarray:
    """Gentle saturation so nothing ever hits a hard digital edge."""
    return np.tanh(x * 1.15) / math.tanh(1.15)


def fade_edges(x: np.ndarray, ms: float = 4.0) -> np.ndarray:
    """Remove clicks at buffer boundaries."""
    k = max(1, int(SR * ms / 1000))
    if len(x) < 2 * k:
        return x
    ramp = np.linspace(0.0, 1.0, k)
    x = x.copy()
    x[:k] *= ramp
    x[-k:] *= ramp[::-1]
    return x


# ------------------------------------------------------------------- one-shots


def ui_tap(bright: float = 1.0, level: float = 0.5) -> np.ndarray:
    """
    A muted, premium UI click: a short tonal body plus a tiny filtered
    transient. Deliberately dry -- a reverb tail would read as a cartoon.
    """
    n = int(SR * 0.09)
    body = (
        0.6 * sine(880 * bright, n)
        + 0.25 * sine(1760 * bright, n)
        + 0.1 * sine(2640 * bright, n)
    ) * env_ad(n, 0.0016, 0.022, 3.2)

    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n) * env_ad(n, 0.0005, 0.004, 5.0) * 0.18
    # One-pole lowpass keeps the transient from sounding like static.
    for i in range(1, n):
        noise[i] = noise[i - 1] * 0.62 + noise[i] * 0.38

    return fade_edges(soft_clip(body + noise) * level)


def follow_confirm(level: float = 0.42) -> np.ndarray:
    """Two quick rising notes: the 'it worked' cue after Follow is pressed."""
    out = np.zeros(int(SR * 0.46))
    for i, f in enumerate((659.25, 987.77)):  # E5 -> B5
        n = int(SR * 0.3)
        seg = (0.7 * sine(f, n) + 0.3 * sine(f * 2, n)) * env_ad(n, 0.004, 0.09, 2.6)
        start = int(SR * (0.0 + i * 0.1))
        out[start : start + n] += seg
    return fade_edges(soft_clip(out) * level)


def notification() -> np.ndarray:
    """
    The alert cue. An original soft two-note bell (C6 -> F6) with a gentle
    tail. Recognisable as a notification without copying any real app's tone.
    """
    out = np.zeros(int(SR * 1.5))
    for i, f in enumerate((1046.50, 1396.91)):
        n = int(SR * 1.1)
        partials = (
            1.0 * sine(f, n)
            + 0.42 * sine(f * 2.0, n)
            + 0.16 * sine(f * 3.01, n)
            + 0.07 * sine(f * 4.2, n)
        )
        seg = partials * env_ad(n, 0.003, 0.22, 2.0)
        start = int(SR * i * 0.17)
        out[start : start + n] += seg * (1.0 if i == 0 else 0.86)
    return fade_edges(soft_clip(out) * 0.4)


def brand_cue() -> np.ndarray:
    """A warm, unhurried resolve under the logo. No stinger, no impact."""
    n = int(SR * 3.4)
    # A major add9, voiced low to high.
    freqs = (110.0, 164.81, 220.0, 277.18, 329.63, 554.37)
    gains = (0.9, 0.5, 0.42, 0.3, 0.24, 0.1)
    out = np.zeros(n)
    for f, g in zip(freqs, gains):
        detune = 1.0 + (hash(int(f)) % 7 - 3) * 0.0004
        out += g * sine(f * detune, n) * env_asr(n, 0.55, 1.5)
    return fade_edges(soft_clip(out * 0.18))


# ------------------------------------------------------------------- music bed


def music_bed() -> np.ndarray:
    """
    A restrained ambient pad that follows the arc the brief asks for: curious,
    a lift when the notification lands, a warm resolve under the logo.

    This is a competent scratch bed, not a scored track. It is intentionally
    low in the mix and easy to swap -- see README for the licensed-music path.
    """
    n = int(SR * DURATION_S)
    out = np.zeros(n)
    x = t(n)

    # Four chords across the film. A major throughout, so the resolve lands.
    chords = [
        (0.0, 14.0, (220.00, 277.18, 329.63, 415.30)),  # Amaj7
        (13.0, 26.0, (184.997, 277.18, 369.99, 554.37)),  # F#m7-ish voicing
        (25.0, 36.0, (146.83, 220.00, 293.66, 369.99)),  # Dmaj7
        (35.0, 42.0, (164.81, 246.94, 329.63, 415.30)),  # E -> resolve
    ]
    for start, end, freqs in chords:
        s, e = int(SR * start), min(n, int(SR * end))
        seg_n = e - s
        if seg_n <= 0:
            continue
        seg = np.zeros(seg_n)
        for j, f in enumerate(freqs):
            # Two slightly detuned layers give the pad movement without chorus.
            for d in (0.9985, 1.0015):
                seg += sine(f * d, seg_n) * (0.5 ** (j * 0.45))
        # Slow breathing so the pad never sits static.
        lfo = 1.0 + 0.06 * np.sin(2 * math.pi * 0.07 * t(seg_n))
        out[s:e] += seg * env_asr(seg_n, 2.6, 3.4) * lfo * 0.05

    # Sub pulse enters once the story proper starts, around 4s.
    pulse_period = 60.0 / 100.0  # 100 BPM
    k = 0
    while k * pulse_period < DURATION_S:
        at = k * pulse_period
        k += 1
        if at < 4.0 or at > 39.0:
            continue
        pn = int(SR * 0.4)
        s = int(SR * at)
        e = min(n, s + pn)
        if e <= s:
            continue
        # Fade the pulse in over its first bars and back out at the end.
        ramp = min(1.0, (at - 4.0) / 6.0) * min(1.0, (39.0 - at) / 4.0)
        body = sine(55.0, e - s) * env_ad(e - s, 0.006, 0.1, 3.0)
        out[s:e] += body * 0.1 * ramp

    # A light bell figure from the lift (~20s) to just before the resolve.
    arp = (659.25, 880.00, 987.77, 1318.51)
    step = 0.3
    i = 0
    at = 19.5
    while at < 37.0:
        s = int(SR * at)
        an = int(SR * 0.9)
        e = min(n, s + an)
        if e > s:
            f = arp[i % len(arp)]
            seg = (sine(f, e - s) + 0.3 * sine(f * 2, e - s)) * env_ad(
                e - s, 0.004, 0.16, 2.4
            )
            ramp = min(1.0, (at - 19.5) / 3.0) * min(1.0, (37.0 - at) / 3.0)
            out[s:e] += seg * 0.035 * ramp
        at += step
        i += 1

    return soft_clip(out)


# ----------------------------------------------------------------------- mix

# Frame numbers mirror T in src/actor-alert/compositions/ActorAlertFilm.tsx.
CUES = [
    ("follow_tap", 212, "tap"),
    ("follow_done", 218, "confirm"),
    ("optin_submit", 356, "tap"),
    ("notification", 468, "notify"),
    ("notification_tap", 546, "tap"),
    ("alert_link_tap", 838, "tap_bright"),
    ("netflix_tap", 1002, "tap_bright"),
    ("brand", 1052, "brand"),
]


def write_wav(path: str, data: np.ndarray, stereo: bool = True) -> None:
    data = np.clip(data, -1.0, 1.0)
    pcm = (data * 32767.0).astype("<i2")
    if stereo:
        pcm = np.column_stack((pcm, pcm)).reshape(-1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    n = int(SR * DURATION_S)

    shots = {
        "tap": ui_tap(1.0, 0.34),
        "tap_bright": ui_tap(1.22, 0.38),
        "confirm": follow_confirm(),
        "notify": notification(),
        "brand": brand_cue(),
    }

    # Individual cues, so an editor can re-time them by hand if needed.
    for name, buf in shots.items():
        write_wav(os.path.join(OUT_DIR, f"sfx-{name}.wav"), buf)

    bed = music_bed()
    write_wav(os.path.join(OUT_DIR, "music-bed.wav"), bed)

    # Full pre-mixed track: bed plus every cue at its frame.
    mix = bed.copy()
    for label, frame, kind in CUES:
        buf = shots[kind]
        s = int(SR * frame / FPS)
        e = min(n, s + len(buf))
        if e > s:
            mix[s:e] += buf[: e - s]

    mix = soft_clip(mix)
    peak = float(np.max(np.abs(mix))) or 1.0
    # Leave ~1.5 dB of headroom rather than normalising to full scale.
    mix *= 0.84 / peak
    write_wav(os.path.join(OUT_DIR, "mix-full.wav"), mix)

    print(f"wrote {len(shots)} cues + bed + mix to {os.path.normpath(OUT_DIR)}")
    print(f"mix length: {len(mix) / SR:.2f}s ({DURATION_FRAMES} frames @ {FPS}fps)")


if __name__ == "__main__":
    main()
