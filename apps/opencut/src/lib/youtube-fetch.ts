import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	renameSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";

export type YoutubeJobStage =
	| "queued"
	| "resolving"
	| "downloading"
	| "processing"
	| "ready"
	| "error";

export interface YoutubeJobResult {
	path: string;
	fileName: string;
	title: string;
	duration: number | null;
	temporary: true;
}

export interface YoutubeJob {
	id: string;
	stage: YoutubeJobStage;
	percent: number;
	message: string;
	done: boolean;
	error: string | null;
	result: YoutubeJobResult | null;
	title: string | null;
}

const youtubeJobs = new Map<string, YoutubeJob>();

export function getTempClipDir() {
	const dir = join(process.cwd(), ".temp-clips");
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function isYouTubeUrl(value: string) {
	try {
		const url = new URL(value);
		return (
			/(^|\.)youtube\.com$/i.test(url.hostname) ||
			/(^|\.)youtu\.be$/i.test(url.hostname) ||
			/(^|\.)youtube-nocookie\.com$/i.test(url.hostname)
		);
	} catch {
		return false;
	}
}

export function publicJob(job: YoutubeJob) {
	return {
		jobId: job.id,
		stage: job.stage,
		percent: job.percent,
		message: job.message,
		done: job.done,
		error: job.error || null,
		result: job.result || null,
	};
}

export function getYoutubeJob(jobId: string) {
	return youtubeJobs.get(jobId) || null;
}

function findYtDlpCommand(): Array<[string, string[]]> {
	return [
		["yt-dlp", []],
		["py", ["-m", "yt_dlp"]],
		["python", ["-m", "yt_dlp"]],
	];
}

function runCommand(command: string, args: string[]) {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const child = spawn(command, args, { shell: false });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(stderr || stdout || `${command} failed with code ${code}`));
		});
	});
}

async function runYtDlp(args: string[]) {
	let lastError: unknown = null;
	for (const [command, prefix] of findYtDlpCommand()) {
		try {
			return await runCommand(command, [...prefix, ...args]);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("yt-dlp is not available. Install it with: pip install yt-dlp");
}

function spawnYtDlp(
	args: string[],
	{
		onStdout,
		onStderr,
	}: {
		onStdout?: (text: string) => void;
		onStderr?: (text: string) => void;
	} = {},
) {
	const attempts = findYtDlpCommand();
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		let index = 0;
		const tryNext = () => {
			if (index >= attempts.length) {
				reject(
					new Error(
						"yt-dlp is not available. Install it with: pip install yt-dlp",
					),
				);
				return;
			}
			const [command, prefix] = attempts[index];
			index += 1;
			const child = spawn(command, [...prefix, ...args], {
				shell: false,
			}) as ChildProcessWithoutNullStreams;
			let stdout = "";
			let stderr = "";
			let started = false;
			child.stdout?.on("data", (chunk) => {
				started = true;
				const text = chunk.toString();
				stdout += text;
				onStdout?.(text);
			});
			child.stderr?.on("data", (chunk) => {
				started = true;
				const text = chunk.toString();
				stderr += text;
				onStderr?.(text);
			});
			child.on("error", (error: NodeJS.ErrnoException) => {
				if (error.code === "ENOENT") tryNext();
				else reject(error);
			});
			child.on("close", (code) => {
				if (code === 0) resolve({ stdout, stderr });
				else if (!started && index < attempts.length) tryNext();
				else
					reject(
						new Error(stderr || stdout || `${command} failed with code ${code}`),
					);
			});
		};
		tryNext();
	});
}

function parseYtDlpProgress(chunk: string, job: YoutubeJob) {
	const lines = String(chunk).split(/\r?\n|\r/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const percentMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
		if (percentMatch) {
			const percent = Math.min(99, Math.max(0, Number(percentMatch[1])));
			job.percent = percent;
			job.stage = "downloading";
			job.message = `Downloading... ${percent.toFixed(0)}%`;
			const etaMatch = trimmed.match(/ETA\s+(\d+:\d+)/i);
			if (etaMatch)
				job.message = `Downloading... ${percent.toFixed(0)}% (ETA ${etaMatch[1]})`;
			continue;
		}
		if (
			/\[download\]\s+Destination:/i.test(trimmed) ||
			/\[download\]\s+Downloading/i.test(trimmed)
		) {
			job.stage = "downloading";
			if (job.percent < 1) job.message = "Downloading video...";
			continue;
		}
		if (/Merging|\[Merger\]|\[Fixup/i.test(trimmed)) {
			job.stage = "processing";
			job.percent = Math.max(job.percent, 95);
			job.message = "Merging video and audio...";
			continue;
		}
		if (
			/Extracting URL|Downloading webpage|Downloading android/i.test(trimmed)
		) {
			if (
				job.stage !== "downloading" &&
				job.stage !== "processing" &&
				job.stage !== "ready"
			) {
				job.stage = "resolving";
				job.message = "Contacting YouTube...";
			}
		}
	}
}

function cleanYtError(message: string) {
	const lines = String(message || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const errors = lines.filter((line) => /^ERROR:/i.test(line));
	const picked =
		errors.at(-1) || lines.find((line) => !/^WARNING:/i.test(line)) || message;
	return String(picked)
		.replace(/^ERROR:\s*/i, "")
		.trim();
}

async function remuxFaststart(filePath: string) {
	if (!/\.mp4$/i.test(filePath) || !existsSync(filePath)) return false;
	const tempPath = `${filePath}.faststart.mp4`;
	try {
		await runCommand("ffmpeg", [
			"-y",
			"-i",
			filePath,
			"-c",
			"copy",
			"-movflags",
			"+faststart",
			tempPath,
		]);
		unlinkSync(filePath);
		renameSync(tempPath, filePath);
		return true;
	} catch {
		try {
			if (existsSync(tempPath)) unlinkSync(tempPath);
		} catch {
			/* ignore */
		}
		return false;
	}
}

async function runYoutubeJob(job: YoutubeJob, url: string) {
	const tempClipDir = getTempClipDir();
	const clipId = randomBytes(8).toString("hex");
	const outTemplate = join(tempClipDir, `clip-${clipId}.%(ext)s`);
	try {
		job.stage = "resolving";
		job.percent = 2;
		job.message = "Reading video info...";

		let title = `clip-${clipId}`;
		let duration: number | null = null;
		try {
			const meta = await runYtDlp([
				"--no-playlist",
				"--no-warnings",
				"--no-update",
				"-j",
				url,
			]);
			const info = JSON.parse(
				meta.stdout.split("\n").find((line) => line.trim().startsWith("{")) ||
					"{}",
			);
			title = info.title || title;
			duration = Number.isFinite(info.duration) ? Number(info.duration) : null;
			job.title = title;
			job.message = `Found "${title.slice(0, 48)}${title.length > 48 ? "..." : ""}"`;
			job.percent = 8;
		} catch {
			job.message = "Starting download...";
		}

		job.stage = "downloading";
		job.message = "Downloading video...";
		await spawnYtDlp(
			[
				"--no-playlist",
				"--no-warnings",
				"--no-update",
				"--no-part",
				"--retries",
				"5",
				"--newline",
				"-f",
				"b[ext=mp4]/best[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b",
				"--merge-output-format",
				"mp4",
				"-o",
				outTemplate,
				url,
			],
			{
				onStderr: (text) => parseYtDlpProgress(text, job),
				onStdout: (text) => parseYtDlpProgress(text, job),
			},
		);

		job.stage = "processing";
		job.percent = 97;
		job.message = "Preparing temporary clip...";

		const files = readdirSync(tempClipDir).filter((name) =>
			name.startsWith(`clip-${clipId}.`),
		);
		if (!files.length)
			throw new Error("Download finished but no video file was found.");
		const fileName = files[0];
		const absolutePath = join(tempClipDir, fileName);

		job.message = "Making clip seekable in the editor...";
		job.percent = 98;
		await remuxFaststart(absolutePath);

		job.stage = "ready";
		job.percent = 100;
		job.message = "Ready";
		job.done = true;
		job.result = {
			path: `/api/temp-clips/${fileName}`,
			fileName,
			title,
			duration,
			temporary: true,
		};
	} catch (error) {
		job.done = true;
		job.stage = "error";
		job.error =
			cleanYtError(error instanceof Error ? error.message : String(error)) ||
			"Failed to fetch YouTube video. Install yt-dlp (pip install yt-dlp) and try again.";
		job.message = job.error;
	} finally {
		setTimeout(() => youtubeJobs.delete(job.id), 30 * 60 * 1000);
	}
}

export function startYoutubeJob(url: string) {
	const jobId = randomBytes(8).toString("hex");
	const job: YoutubeJob = {
		id: jobId,
		stage: "queued",
		percent: 0,
		message: "Queued…",
		done: false,
		error: null,
		result: null,
		title: null,
	};
	youtubeJobs.set(jobId, job);
	void runYoutubeJob(job, url);
	return job;
}
