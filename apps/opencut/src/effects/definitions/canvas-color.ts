import type { EffectDefinition } from "@/effects/types";

function num(
	key: string,
	label: string,
	defaults: { default: number; min: number; max: number; step: number },
) {
	return { key, label, type: "number" as const, ...defaults };
}

function canvasPass(
	shader: string,
	uniforms: (
		effectParams: Record<string, unknown>,
	) => Record<string, number | number[]>,
): EffectDefinition["renderer"] {
	return {
		passes: [
			{
				shader: `canvas:${shader}`,
				uniforms: ({ effectParams }) => uniforms(effectParams),
			},
		],
	};
}

function asNumber(value: unknown, fallback: number) {
	return typeof value === "number" ? value : Number.parseFloat(String(value)) || fallback;
}

export const canvasEffectDefinitions: EffectDefinition[] = [
	{
		type: "soft-blur",
		name: "Soft Blur",
		keywords: ["blur", "soft", "defocus"],
		category: "effect",
		params: [num("px", "Amount", { default: 3, min: 0, max: 24, step: 0.5 })],
		renderer: canvasPass("blur", (p) => ({ u_px: asNumber(p.px, 3) })),
	},
	{
		type: "heavy-blur",
		name: "Heavy Blur",
		keywords: ["blur", "heavy", "fog"],
		category: "effect",
		params: [num("px", "Amount", { default: 12, min: 0, max: 40, step: 0.5 })],
		renderer: canvasPass("blur", (p) => ({ u_px: asNumber(p.px, 12) })),
	},
	{
		type: "vignette",
		name: "Vignette",
		keywords: ["vignette", "dark", "edges"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 0.55, min: 0, max: 1, step: 0.01 }),
		],
		renderer: canvasPass("vignette", (p) => ({
			u_amount: asNumber(p.amount, 0.55),
		})),
	},
	{
		type: "warm-tint",
		name: "Warm",
		keywords: ["warm", "orange", "tint"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 0.25, min: 0, max: 0.7, step: 0.01 }),
		],
		renderer: canvasPass("warm", (p) => ({
			u_amount: asNumber(p.amount, 0.25),
		})),
	},
	{
		type: "cool-tint",
		name: "Cool",
		keywords: ["cool", "blue", "tint"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 0.25, min: 0, max: 0.7, step: 0.01 }),
		],
		renderer: canvasPass("cool", (p) => ({
			u_amount: asNumber(p.amount, 0.25),
		})),
	},
	{
		type: "sepia",
		name: "Sepia",
		keywords: ["sepia", "vintage", "old"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 0.8, min: 0, max: 1, step: 0.01 }),
		],
		renderer: canvasPass("sepia", (p) => ({
			u_amount: asNumber(p.amount, 0.8),
		})),
	},
	{
		type: "grayscale",
		name: "B&W",
		keywords: ["grayscale", "black", "white", "mono"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 1, min: 0, max: 1, step: 0.01 }),
		],
		renderer: canvasPass("grayscale", (p) => ({
			u_amount: asNumber(p.amount, 1),
		})),
	},
	{
		type: "invert",
		name: "Invert",
		keywords: ["invert", "negative"],
		category: "effect",
		params: [
			num("amount", "Amount", { default: 1, min: 0, max: 1, step: 0.01 }),
		],
		renderer: canvasPass("invert", (p) => ({
			u_amount: asNumber(p.amount, 1),
		})),
	},
	{
		type: "hue-shift",
		name: "Hue Shift",
		keywords: ["hue", "color", "shift"],
		category: "effect",
		params: [
			num("degrees", "Degrees", { default: 40, min: -180, max: 180, step: 1 }),
		],
		renderer: canvasPass("hue-rotate", (p) => ({
			u_degrees: asNumber(p.degrees, 40),
		})),
	},
	{
		type: "brightness",
		name: "Brightness",
		keywords: ["brightness", "light", "exposure"],
		category: "adjustment",
		params: [
			num("brightness", "Brightness", {
				default: 0.15,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("contrast", "Contrast", {
				default: 0,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
		],
		renderer: canvasPass("brightness-contrast", (p) => ({
			u_brightness: asNumber(p.brightness, 0.15),
			u_contrast: asNumber(p.contrast, 0),
		})),
	},
	{
		type: "contrast",
		name: "Contrast",
		keywords: ["contrast", "punch"],
		category: "adjustment",
		params: [
			num("brightness", "Brightness", {
				default: 0,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("contrast", "Contrast", {
				default: 0.25,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
		],
		renderer: canvasPass("brightness-contrast", (p) => ({
			u_brightness: asNumber(p.brightness, 0),
			u_contrast: asNumber(p.contrast, 0.25),
		})),
	},
	{
		type: "saturation",
		name: "Saturation",
		keywords: ["saturation", "vivid", "color"],
		category: "adjustment",
		params: [
			num("amount", "Amount", { default: 1.4, min: 0, max: 3, step: 0.05 }),
		],
		renderer: canvasPass("saturation", (p) => ({
			u_amount: asNumber(p.amount, 1.4),
		})),
	},
	{
		type: "desaturate",
		name: "Desaturate",
		keywords: ["desaturate", "muted", "flat"],
		category: "adjustment",
		params: [
			num("amount", "Amount", { default: 0.35, min: 0, max: 1, step: 0.05 }),
		],
		renderer: canvasPass("saturation", (p) => ({
			u_amount: asNumber(p.amount, 0.35),
		})),
	},
	{
		type: "exposure-up",
		name: "Exposure +",
		keywords: ["exposure", "bright"],
		category: "adjustment",
		params: [
			num("brightness", "Brightness", {
				default: 0.28,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("contrast", "Contrast", {
				default: 0.08,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
		],
		renderer: canvasPass("brightness-contrast", (p) => ({
			u_brightness: asNumber(p.brightness, 0.28),
			u_contrast: asNumber(p.contrast, 0.08),
		})),
	},
	{
		type: "exposure-down",
		name: "Exposure −",
		keywords: ["exposure", "dark", "moody"],
		category: "adjustment",
		params: [
			num("brightness", "Brightness", {
				default: -0.22,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("contrast", "Contrast", {
				default: 0.12,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
		],
		renderer: canvasPass("brightness-contrast", (p) => ({
			u_brightness: asNumber(p.brightness, -0.22),
			u_contrast: asNumber(p.contrast, 0.12),
		})),
	},
	{
		type: "cinematic",
		name: "Cinematic",
		keywords: ["cinematic", "film", "look"],
		category: "adjustment",
		params: [
			num("brightness", "Brightness", {
				default: -0.05,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("contrast", "Contrast", {
				default: 0.18,
				min: -0.5,
				max: 0.8,
				step: 0.01,
			}),
			num("amount", "Warmth", { default: 0.14, min: 0, max: 0.5, step: 0.01 }),
		],
		renderer: {
			passes: [
				{
					shader: "canvas:brightness-contrast",
					uniforms: ({ effectParams }) => ({
						u_brightness: asNumber(effectParams.brightness, -0.05),
						u_contrast: asNumber(effectParams.contrast, 0.18),
					}),
				},
				{
					shader: "canvas:warm",
					uniforms: ({ effectParams }) => ({
						u_amount: asNumber(effectParams.amount, 0.14),
					}),
				},
				{
					shader: "canvas:vignette",
					uniforms: () => ({ u_amount: 0.35 }),
				},
			],
		},
	},
];
