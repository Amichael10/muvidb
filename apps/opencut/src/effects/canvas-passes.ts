import type { EffectPass } from "@/effects/types";

const CANVAS_SHADER_PREFIX = "canvas:";

export function isCanvasEffectShader({ shader }: { shader: string }) {
	return shader.startsWith(CANVAS_SHADER_PREFIX);
}

function readNumber(
	uniforms: Record<string, number | number[]>,
	key: string,
	fallback: number,
) {
	const value = uniforms[key];
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value) && typeof value[0] === "number") return value[0];
	return fallback;
}

function applyCssFilterPass({
	source,
	width,
	height,
	filter,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	filter: string;
}): OffscreenCanvas {
	const output = new OffscreenCanvas(width, height);
	const ctx = output.getContext("2d");
	if (!ctx) return source;
	ctx.filter = filter;
	ctx.drawImage(source, 0, 0, width, height);
	ctx.filter = "none";
	return output;
}

function applyVignettePass({
	source,
	width,
	height,
	amount,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	amount: number;
}): OffscreenCanvas {
	const output = new OffscreenCanvas(width, height);
	const ctx = output.getContext("2d");
	if (!ctx) return source;
	ctx.drawImage(source, 0, 0, width, height);
	const radius = Math.hypot(width, height) * 0.55;
	const gradient = ctx.createRadialGradient(
		width / 2,
		height / 2,
		radius * (1 - amount * 0.65),
		width / 2,
		height / 2,
		radius,
	);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, amount)})`);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	return output;
}

function applyTintPass({
	source,
	width,
	height,
	r,
	g,
	b,
	amount,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	r: number;
	g: number;
	b: number;
	amount: number;
}): OffscreenCanvas {
	const output = new OffscreenCanvas(width, height);
	const ctx = output.getContext("2d");
	if (!ctx) return source;
	ctx.drawImage(source, 0, 0, width, height);
	ctx.globalCompositeOperation = "source-atop";
	ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, Math.max(0, amount))})`;
	ctx.fillRect(0, 0, width, height);
	ctx.globalCompositeOperation = "source-over";
	return output;
}

/** Apply MuviDB canvas-based effect passes (no WASM shader required). */
export function applyCanvasEffectPasses({
	source,
	width,
	height,
	passes,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	passes: EffectPass[];
}): OffscreenCanvas {
	let current = source;
	for (const pass of passes) {
		if (!isCanvasEffectShader({ shader: pass.shader })) {
			continue;
		}
		const kind = pass.shader.slice(CANVAS_SHADER_PREFIX.length);
		const u = pass.uniforms;

		switch (kind) {
			case "brightness-contrast": {
				const brightness = readNumber(u, "u_brightness", 0);
				const contrast = readNumber(u, "u_contrast", 0);
				const bPct = Math.round(100 + brightness * 100);
				const cPct = Math.round(100 + contrast * 100);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `brightness(${bPct}%) contrast(${cPct}%)`,
				});
				break;
			}
			case "saturation": {
				const amount = readNumber(u, "u_amount", 1);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `saturate(${Math.round(amount * 100)}%)`,
				});
				break;
			}
			case "hue-rotate": {
				const degrees = readNumber(u, "u_degrees", 0);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `hue-rotate(${degrees}deg)`,
				});
				break;
			}
			case "grayscale": {
				const amount = readNumber(u, "u_amount", 1);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `grayscale(${Math.round(amount * 100)}%)`,
				});
				break;
			}
			case "sepia": {
				const amount = readNumber(u, "u_amount", 0.75);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `sepia(${Math.round(amount * 100)}%)`,
				});
				break;
			}
			case "invert": {
				const amount = readNumber(u, "u_amount", 1);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `invert(${Math.round(amount * 100)}%)`,
				});
				break;
			}
			case "blur": {
				const px = readNumber(u, "u_px", 4);
				current = applyCssFilterPass({
					source: current,
					width,
					height,
					filter: `blur(${px}px)`,
				});
				break;
			}
			case "vignette": {
				current = applyVignettePass({
					source: current,
					width,
					height,
					amount: readNumber(u, "u_amount", 0.55),
				});
				break;
			}
			case "tint": {
				current = applyTintPass({
					source: current,
					width,
					height,
					r: readNumber(u, "u_r", 255),
					g: readNumber(u, "u_g", 180),
					b: readNumber(u, "u_b", 80),
					amount: readNumber(u, "u_amount", 0.25),
				});
				break;
			}
			case "warm": {
				current = applyTintPass({
					source: current,
					width,
					height,
					r: 255,
					g: 170,
					b: 90,
					amount: readNumber(u, "u_amount", 0.22),
				});
				break;
			}
			case "cool": {
				current = applyTintPass({
					source: current,
					width,
					height,
					r: 90,
					g: 150,
					b: 255,
					amount: readNumber(u, "u_amount", 0.22),
				});
				break;
			}
			default:
				break;
		}
	}
	return current;
}
