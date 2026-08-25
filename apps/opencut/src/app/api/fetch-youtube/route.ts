import { NextResponse } from "next/server";
import {
	getYoutubeJob,
	isYouTubeUrl,
	publicJob,
	startYoutubeJob,
} from "@/lib/youtube-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const jobId = searchParams.get("jobId");
	const job = jobId ? getYoutubeJob(jobId) : null;
	if (!job) {
		return NextResponse.json({ error: "Job not found." }, { status: 404 });
	}
	return NextResponse.json(publicJob(job));
}

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { url?: string };
		const url = body.url?.trim();
		if (!url || !isYouTubeUrl(url)) {
			return NextResponse.json(
				{ error: "Provide a valid YouTube URL." },
				{ status: 400 },
			);
		}
		const job = startYoutubeJob(url);
		return NextResponse.json(publicJob(job), { status: 202 });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to start YouTube fetch.",
			},
			{ status: 500 },
		);
	}
}
