import type { TCanvasSize } from "@/project/types";

/** Social-first presets (MuviDB Studio). */
export const DEFAULT_CANVAS_PRESETS: TCanvasSize[] = [
	{ width: 1080, height: 1920 }, // Reel / TikTok 9:16
	{ width: 1080, height: 1350 }, // Instagram 4:5
	{ width: 1080, height: 1080 }, // Instagram Post 1:1
	{ width: 1600, height: 900 }, // Twitter / X 16:9
	{ width: 1920, height: 1080 }, // Landscape 16:9
	{ width: 1440, height: 1080 }, // 4:3
];

export const DEFAULT_CANVAS_SIZE: TCanvasSize = { width: 1080, height: 1920 };
