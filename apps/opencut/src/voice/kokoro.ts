export type KokoroVoiceId =
	| "af_heart"
	| "af_bella"
	| "af_sarah"
	| "am_adam"
	| "am_michael"
	| "bf_emma"
	| "bm_george";

export const KOKORO_VOICES: Array<{ id: KokoroVoiceId; label: string }> = [
	{ id: "af_heart", label: "Heart (US female)" },
	{ id: "af_bella", label: "Bella (US female)" },
	{ id: "af_sarah", label: "Sarah (US female)" },
	{ id: "am_adam", label: "Adam (US male)" },
	{ id: "am_michael", label: "Michael (US male)" },
	{ id: "bf_emma", label: "Emma (UK female)" },
	{ id: "bm_george", label: "George (UK male)" },
];

type ProgressCallback = (message: string) => void;

type KokoroInstance = {
	generate: (
		text: string,
		options: { voice: string },
	) => Promise<{
		audio: Float32Array | Float32Array[];
		sampling_rate?: number;
		save?: (path: string) => void;
	}>;
};

let ttsPromise: Promise<KokoroInstance> | null = null;

async function getKokoro({
	onProgress,
}: {
	onProgress?: ProgressCallback;
} = {}): Promise<KokoroInstance> {
	if (!ttsPromise) {
		ttsPromise = (async () => {
			onProgress?.("Downloading Kokoro (first time can take a few minutes)…");
			const { KokoroTTS } = await import("kokoro-js");
			// CPU-first: wasm works without a GPU; WebGPU is optional acceleration only.
			const device = "wasm";
			const tts = await KokoroTTS.from_pretrained(
				"onnx-community/Kokoro-82M-v1.0-ONNX",
				{
					dtype: "q8",
					device,
					progress_callback: (progress: {
						status?: string;
						progress?: number;
						file?: string;
					}) => {
						if (progress.status === "progress" && progress.progress != null) {
							onProgress?.(
								`Loading ${progress.file ?? "model"}… ${Math.round(progress.progress)}%`,
							);
						} else if (progress.status) {
							onProgress?.(String(progress.status));
						}
					},
				},
			);
			onProgress?.("Kokoro ready");
			return tts as KokoroInstance;
		})().catch((error) => {
			ttsPromise = null;
			throw error;
		});
	}
	return ttsPromise;
}

export async function preloadKokoro({
	onProgress,
}: {
	onProgress?: ProgressCallback;
} = {}) {
	await getKokoro({ onProgress });
}

function floatToWavBlob({
	samples,
	sampleRate,
}: {
	samples: Float32Array;
	sampleRate: number;
}): Blob {
	const buffer = new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(buffer);

	const writeString = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) {
			view.setUint8(offset + i, value.charCodeAt(i));
		}
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeString(36, "data");
	view.setUint32(40, samples.length * 2, true);

	let offset = 44;
	for (let i = 0; i < samples.length; i++) {
		const sample = Math.max(-1, Math.min(1, samples[i]));
		view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
		offset += 2;
	}

	return new Blob([buffer], { type: "audio/wav" });
}

export async function generateKokoroSpeech({
	text,
	voice,
	onProgress,
}: {
	text: string;
	voice: KokoroVoiceId;
	onProgress?: ProgressCallback;
}) {
	const tts = await getKokoro({ onProgress });
	onProgress?.("Synthesizing…");
	const result = await tts.generate(text, { voice });
	const audio = Array.isArray(result.audio) ? result.audio[0] : result.audio;
	const sampleRate = result.sampling_rate ?? 24000;
	const samples =
		audio instanceof Float32Array ? audio : new Float32Array(audio);

	const blob = floatToWavBlob({ samples, sampleRate });
	const audioContext = new AudioContext({ sampleRate });
	const arrayBuffer = await blob.arrayBuffer();
	const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

	return {
		blob,
		buffer,
		durationSeconds: buffer.duration,
		sampleRate,
	};
}
