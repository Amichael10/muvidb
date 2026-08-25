"use client";

import { useRef, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { showMediaUploadToast } from "@/media/upload-toast";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { AddMediaAssetCommand } from "@/commands/media";
import { InsertElementCommand } from "@/commands/timeline";
import { BatchCommand } from "@/commands";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/timeline/creation";
import { mediaTimeFromSeconds } from "@/wasm";
import { toast } from "sonner";

type FetchProgress = {
	stage: string;
	percent: number;
	message: string;
};

export function YoutubeClipView() {
	const editor = useEditor();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState<FetchProgress | null>(null);
	const [status, setStatus] = useState(
		"Paste a YouTube link — it loads as a temporary clip on the timeline.",
	);

	async function importClipToTimeline({
		file,
		title,
	}: {
		file: File;
		title: string;
	}) {
		const activeProject = editor.project.getActive();
		if (!activeProject) {
			throw new Error("Open a project first.");
		}

		await showMediaUploadToast({
			filesCount: 1,
			promise: async () => {
				const processedAssets = await processMediaAssets({ files: [file] });
				const startTime = editor.playback.getCurrentTime();

				for (const asset of processedAssets) {
					const namedAsset = { ...asset, name: title || asset.name };
					const addMediaCmd = new AddMediaAssetCommand({
						projectId: activeProject.metadata.id,
						asset: namedAsset,
					});
					const assetId = addMediaCmd.getAssetId();
					const duration =
						namedAsset.duration != null
							? mediaTimeFromSeconds({ seconds: namedAsset.duration })
							: DEFAULT_NEW_ELEMENT_DURATION;

					const element = buildElementFromMedia({
						mediaId: assetId,
						mediaType: namedAsset.type,
						name: namedAsset.name,
						duration,
						startTime,
					});

					const insertCmd = new InsertElementCommand({
						element,
						placement: { mode: "auto", trackType: "video" },
					});
					editor.command.execute({
						command: new BatchCommand([addMediaCmd, insertCmd]),
					});
				}

				return {
					uploadedCount: processedAssets.length,
					assetNames: processedAssets.map((asset) => title || asset.name),
				};
			},
		});
	}

	async function handleFetchYoutube() {
		const trimmed = url.trim();
		if (!trimmed) {
			setStatus("Paste a YouTube URL first.");
			return;
		}

		setBusy(true);
		setProgress({ stage: "queued", percent: 0, message: "Starting..." });
		setStatus("Fetching from YouTube (temporary clip)...");

		try {
			const start = await fetch("/api/fetch-youtube", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: trimmed }),
			});
			const started = await start.json();
			if (!start.ok) throw new Error(started.error || "Fetch failed");

			const jobId = started.jobId as string;
			setProgress({
				stage: started.stage || "queued",
				percent: Number(started.percent) || 0,
				message: started.message || "Queued...",
			});

			let result: {
				path: string;
				fileName: string;
				title: string;
				duration: number | null;
			} | null = null;

			for (;;) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				const statusResponse = await fetch(
					`/api/fetch-youtube?jobId=${encodeURIComponent(jobId)}`,
				);
				const statusJson = await statusResponse.json();
				if (!statusResponse.ok) {
					throw new Error(statusJson.error || "Lost fetch progress.");
				}
				setProgress({
					stage: statusJson.stage,
					percent: Number(statusJson.percent) || 0,
					message: statusJson.message || "Working...",
				});
				setStatus(statusJson.message || "Fetching...");
				if (statusJson.done) {
					if (statusJson.error) throw new Error(statusJson.error);
					result = statusJson.result;
					break;
				}
			}

			if (!result?.path) throw new Error("Fetch finished without a video file.");

			setStatus("Importing clip into the editor...");
			const fileResponse = await fetch(result.path);
			if (!fileResponse.ok) throw new Error("Could not load downloaded clip.");
			const blob = await fileResponse.blob();
			const fileName = result.fileName || "youtube-clip.mp4";
			const file = new File([blob], fileName, {
				type: blob.type || "video/mp4",
			});

			await importClipToTimeline({
				file,
				title: result.title || fileName,
			});

			setProgress(null);
			setStatus(`On timeline · ${result.title || fileName}. Trim and export.`);
			toast.success("YouTube clip added to timeline");
		} catch (error) {
			setProgress(null);
			const message =
				error instanceof Error
					? error.message
					: "Could not fetch that video. Try optional upload instead.";
			setStatus(message);
			toast.error(message);
		} finally {
			setBusy(false);
		}
	}

	async function handleLocalUpload(fileList: FileList | null) {
		const file = fileList?.[0];
		if (!file) return;
		setBusy(true);
		setStatus("Loading local file into the editor...");
		try {
			await importClipToTimeline({
				file,
				title: file.name.replace(/\.[^.]+$/, ""),
			});
			setStatus(`On timeline · ${file.name}`);
			toast.success("Clip added to timeline");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Could not load that file.";
			setStatus(message);
			toast.error(message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<PanelView title="Clip / YouTube">
			<div className="flex flex-col gap-3 pb-4 pt-2">
				<p className="text-muted-foreground text-xs leading-relaxed">
					Paste a YouTube link — MuviDB fetches a temporary clip, drops it on
					the timeline, then you trim and export.
				</p>

				<label className="flex flex-col gap-1.5">
					<span className="text-muted-foreground text-xs font-medium">
						YouTube URL
					</span>
					<Input
						placeholder="https://www.youtube.com/watch?v=..."
						value={url}
						disabled={busy}
						onChange={(event) => setUrl(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") void handleFetchYoutube();
						}}
					/>
				</label>

				<Button
					className="w-full"
					disabled={busy}
					onClick={() => void handleFetchYoutube()}
				>
					{busy ? "Working…" : "Fetch from YouTube"}
				</Button>

				{progress && (
					<div className="rounded-md border bg-secondary/40 px-3 py-2">
						<div className="mb-1 flex items-center justify-between text-[11px]">
							<span className="text-muted-foreground">{progress.stage}</span>
							<span className="font-mono">{Math.round(progress.percent)}%</span>
						</div>
						<div className="bg-muted h-1.5 overflow-hidden rounded-full">
							<div
								className="bg-primary h-full transition-all"
								style={{ width: `${Math.min(100, progress.percent)}%` }}
							/>
						</div>
						<p className="text-muted-foreground mt-1.5 text-[11px]">
							{progress.message}
						</p>
					</div>
				)}

				<div className="relative flex items-center gap-2 py-1">
					<div className="bg-border h-px flex-1" />
					<span className="text-muted-foreground text-[10px] uppercase tracking-wide">
						or
					</span>
					<div className="bg-border h-px flex-1" />
				</div>

				<input
					ref={fileInputRef}
					className="hidden"
					type="file"
					accept="video/*,.mp4,.mov,.m4v,.webm"
					disabled={busy}
					onChange={(event) => {
						void handleLocalUpload(event.target.files);
						event.target.value = "";
					}}
				/>
				<Button
					variant="outline"
					className="w-full"
					disabled={busy}
					onClick={() => fileInputRef.current?.click()}
				>
					Upload local video
				</Button>

				<p className="text-muted-foreground rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed">
					{status}
				</p>
			</div>
		</PanelView>
	);
}
