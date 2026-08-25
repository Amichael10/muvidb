import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { getTempClipDir } from "@/lib/youtube-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_request: Request,
	context: { params: Promise<{ name: string }> },
) {
	const { name } = await context.params;
	if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
		return new Response("Invalid file", { status: 400 });
	}
	if (!/^clip-[a-f0-9]+\.[a-z0-9]+$/i.test(name)) {
		return new Response("Invalid file", { status: 400 });
	}

	const filePath = join(getTempClipDir(), name);
	if (!existsSync(filePath)) {
		return new Response("Not found", { status: 404 });
	}

	const stats = statSync(filePath);
	const nodeStream = createReadStream(filePath);
	const webStream = Readable.toWeb(nodeStream) as ReadableStream;

	const ext = name.split(".").pop()?.toLowerCase();
	const contentType =
		ext === "webm"
			? "video/webm"
			: ext === "mkv"
				? "video/x-matroska"
				: "video/mp4";

	return new Response(webStream, {
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(stats.size),
			"Cache-Control": "no-store",
		},
	});
}
