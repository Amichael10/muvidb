"""
Generates the film's voiceover locally with YarnGPT2.

Why local rather than a hosted TTS: the hosted voice tools on the connected
account are capped on the free plan, and more importantly YarnGPT2 is a
Nigerian-accented English model, which is the right voice for a Nigerian film
platform. Apache-2.0, so it is usable commercially.

Each line is generated separately and placed at the exact frame its caption
appears on, so the narration is locked to the UI interactions rather than
drifting against them.

Models (downloaded once, see README):
  models/yarngpt/YarnGPT2                  365M-param SmolLM2 finetune
  models/yarngpt/wavtokenizer/*.ckpt       audio decoder
  models/yarngpt/yarngpt-src               the author's tokenizer helper

Usage:  python scripts/build-voiceover.py
Writes: public/assets/audio/vo/line-NN.wav  (24 kHz mono, one per line)
"""

from __future__ import annotations

import os
import sys
import types
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MODELS = os.path.join(REPO, "models", "yarngpt")
OUT_DIR = os.path.join(HERE, "..", "public", "assets", "audio", "vo")

FPS = 30

# (start_frame, text) — mirrors NARRATION in build-subtitles.py, which in turn
# mirrors T in ActorAlertFilm.tsx. The frame is where the line must start.
LINES: list[tuple[int, str]] = [
    (10, "What if you never missed a new movie from your favourite actor?"),
    (126, "On MuviDB, just find the actor you love, and hit Follow."),
    (276, "Add your WhatsApp number once, and that's it."),
    (400, "When a new movie featuring them becomes available, you get an alert straight to WhatsApp."),
    (600, "With the poster, the title, and where to watch it."),
    (880, "One tap takes you to the film page, and on to Netflix."),
    (1068, "MuviDB. Follow the stars."),
    (1158, "Never miss their stories."),
]

# "idera" is listed first in the model card's stability ranking.
SPEAKER = "idera"


def _install_mecab_stub() -> None:
    """
    outetts' package __init__ pulls in Japanese tokenisation (MeCab) whose
    native DLL is not present on Windows. The WavTokenizer decoder never
    touches it, so a stub satisfies the import chain harmlessly.
    """
    if "MeCab" in sys.modules:
        return
    stub = types.ModuleType("MeCab")

    class _Tagger:  # pragma: no cover - never called
        def __init__(self, *a, **k):
            pass

        def parse(self, s):
            return s

    stub.Tagger = _Tagger
    sys.modules["MeCab"] = stub


def build_tokenizer():
    _install_mecab_stub()
    sys.path.insert(0, MODELS)  # so `yarngpt-src` is importable as a package
    sys.path.insert(0, os.path.join(MODELS, "yarngpt-src"))
    from audiotokenizer import AudioTokenizerV2  # type: ignore

    wav_dir = os.path.join(MODELS, "wavtokenizer")
    return AudioTokenizerV2(
        os.path.join(MODELS, "YarnGPT2"),
        os.path.join(wav_dir, "wavtokenizer_medium_speech_320_24k.ckpt"),
        os.path.join(
            wav_dir,
            "wavtokenizer_mediumdata_frame75_3s_nq1_code4096_dim512_kmeans200_attn.yaml",
        ),
    )


def write_wav(path: str, mono: np.ndarray, rate: int) -> None:
    pcm = (np.clip(mono, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    from transformers import AutoModelForCausalLM

    print("loading YarnGPT2…")
    tok = build_tokenizer()
    model = AutoModelForCausalLM.from_pretrained(
        os.path.join(MODELS, "YarnGPT2"), torch_dtype="auto"
    ).to(tok.device)
    print(f"  device: {tok.device}, speaker: {SPEAKER}")

    manifest = []
    for i, (frame, text) in enumerate(LINES, start=1):
        prompt = tok.create_prompt(text, lang="english", speaker_name=SPEAKER)
        input_ids = tok.tokenize_prompt(prompt)
        output = model.generate(
            input_ids=input_ids,
            temperature=0.1,
            repetition_penalty=1.1,
            max_length=4000,
        )
        audio = tok.get_audio(tok.get_codes(output))
        mono = audio.detach().cpu().numpy().squeeze().astype(np.float64)

        path = os.path.join(OUT_DIR, f"line-{i:02d}.wav")
        write_wav(path, mono, 24000)
        dur = len(mono) / 24000
        budget = (
            (LINES[i][0] - frame) / FPS if i < len(LINES) else None
        )
        flag = ""
        if budget is not None and dur > budget:
            flag = f"  !! {dur - budget:.2f}s OVER its slot"
        manifest.append((frame, dur, text))
        print(f"  line {i}: frame {frame:>4}  {dur:5.2f}s{flag}")

    total = sum(d for _, d, _ in manifest)
    print(f"\n{len(manifest)} lines, {total:.1f}s of speech -> {os.path.normpath(OUT_DIR)}")


if __name__ == "__main__":
    main()
