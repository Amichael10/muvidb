"use client";

import { useCallback, useMemo, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEditor } from "@/editor/use-editor";
import { buildLibraryAudioElement } from "@/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/wasm";
import { toast } from "sonner";
import {
	generateKokoroSpeech,
	KOKORO_VOICES,
	preloadKokoro,
	type KokoroVoiceId,
} from "@/voice/kokoro";

type SourceMode = "script" | "captions";

export function VoiceTtsView() {
	const editor = useEditor();
	const [enabled, setEnabled] = useState(true);
	const [sourceMode, setSourceMode] = useState<SourceMode>("script");
	const [script, setScript] = useState("");
	const [voice, setVoice] = useState<KokoroVoiceId>("af_heart");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState(
		"Kokoro runs locally in the browser (first run downloads the model).",
	);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const captionText = useMemo(() => collectCaptionText({ editor }), [editor]);

	const activeText =
		sourceMode === "script" ? script.trim() : captionText.trim();

	const handlePreload = useCallback(async () => {
		setBusy(true);
		setStatus("Loading Kokoro model…");
		try {
			await preloadKokoro({
				onProgress: (message) => setStatus(message),
			});
			setStatus("Kokoro ready.");
			toast.success("Kokoro model ready");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load Kokoro";
			setStatus(message);
			toast.error(message);
		} finally {
			setBusy(false);
		}
	}, []);

	const handleGenerate = useCallback(async () => {
		if (!enabled) {
			toast.message("Voice generation is toggled off");
			return;
		}
		if (!activeText) {
			toast.error(
				sourceMode === "captions"
					? "No caption text found on the timeline"
					: "Write a script first",
			);
			return;
		}

		setBusy(true);
		setStatus("Generating speech…");
		try {
			const result = await generateKokoroSpeech({
				text: activeText,
				voice,
				onProgress: (message) => setStatus(message),
			});

			if (previewUrl) URL.revokeObjectURL(previewUrl);
			const url = URL.createObjectURL(result.blob);
			setPreviewUrl(url);

			const currentTime = editor.playback.getCurrentTime();
			const element = buildLibraryAudioElement({
				sourceUrl: url,
				name: `Voice · ${voice}`,
				duration: mediaTimeFromSeconds({ seconds: result.durationSeconds }),
				startTime: currentTime,
				buffer: result.buffer,
			});

			editor.timeline.insertElement({
				placement: { mode: "auto", trackType: "audio" },
				element,
			});

			setStatus(
				`Added ${result.durationSeconds.toFixed(1)}s voice clip to timeline.`,
			);
			toast.success("Voice added to timeline");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Voice generation failed";
			setStatus(message);
			toast.error(message);
		} finally {
			setBusy(false);
		}
	}, [
		activeText,
		editor,
		enabled,
		previewUrl,
		sourceMode,
		voice,
	]);

	return (
		<PanelView title="Voice / TTS">
			<div className="flex flex-col gap-3 pb-4 pt-1">
				<div className="flex items-center justify-between rounded-md border px-3 py-2">
					<div>
						<p className="text-sm font-medium">Voice generation</p>
						<p className="text-muted-foreground text-[11px]">
							Toggle off to skip TTS while editing
						</p>
					</div>
					<Switch
						checked={enabled}
						onCheckedChange={setEnabled}
						aria-label="Toggle voice generation"
					/>
				</div>

				<div className="flex gap-2">
					<Button
						variant={sourceMode === "script" ? "default" : "outline"}
						size="sm"
						className="flex-1"
						disabled={!enabled || busy}
						onClick={() => setSourceMode("script")}
					>
						From script
					</Button>
					<Button
						variant={sourceMode === "captions" ? "default" : "outline"}
						size="sm"
						className="flex-1"
						disabled={!enabled || busy}
						onClick={() => setSourceMode("captions")}
					>
						From captions
					</Button>
				</div>

				{sourceMode === "script" ? (
					<label className="flex flex-col gap-1.5">
						<span className="text-muted-foreground text-xs font-medium">
							Script
						</span>
						<Textarea
							value={script}
							disabled={!enabled || busy}
							placeholder="Type what the voice should say…"
							className="min-h-28 resize-y"
							onChange={(event) => setScript(event.target.value)}
						/>
					</label>
				) : (
					<div className="rounded-md border bg-muted/30 px-3 py-2">
						<p className="text-muted-foreground mb-1 text-[11px]">
							Caption text from timeline
						</p>
						<p className="text-xs leading-relaxed whitespace-pre-wrap">
							{captionText || "No text captions found yet."}
						</p>
					</div>
				)}

				<label className="flex flex-col gap-1.5">
					<span className="text-muted-foreground text-xs font-medium">
						Voice
					</span>
					<Select
						value={voice}
						disabled={!enabled || busy}
						onValueChange={(value) => setVoice(value as KokoroVoiceId)}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{KOKORO_VOICES.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</label>

				<div className="flex flex-col gap-2">
					<Button
						variant="outline"
						disabled={busy}
						onClick={() => void handlePreload()}
					>
						{busy ? "Working…" : "Load Kokoro model"}
					</Button>
					<Button
						disabled={!enabled || busy}
						onClick={() => void handleGenerate()}
					>
						{busy ? "Generating…" : "Generate & add to timeline"}
					</Button>
				</div>

				{previewUrl && (
					<audio controls src={previewUrl} className="w-full" />
				)}

				<p className="text-muted-foreground rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed">
					{status}
				</p>
			</div>
		</PanelView>
	);
}

function collectCaptionText({
	editor,
}: {
	editor: ReturnType<typeof useEditor>;
}) {
	const tracks = editor.scenes.getActiveScene().tracks;
	const texts: string[] = [];
	for (const track of tracks.overlay) {
		for (const element of track.elements) {
			if (element.type === "text" && "content" in element) {
				const content = String(
					(element as { content?: string }).content ?? "",
				).trim();
				if (content) texts.push(content);
			}
		}
	}
	return texts.join(" ");
}
