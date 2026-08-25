"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { effectsRegistry, EFFECT_TARGET_ELEMENT_TYPES } from "@/effects";
import { effectPreviewService } from "@/services/renderer/effect-preview";
import { useEditor } from "@/editor/use-editor";
import { buildEffectElement } from "@/timeline/element-utils";
import type { EffectDefinition } from "@/effects/types";
import { AddClipEffectCommand } from "@/commands/timeline";
import { toast } from "sonner";

export function EffectsView() {
	const effects = useMemo(
		() =>
			effectsRegistry
				.getAll()
				.filter((effect) => (effect.category ?? "effect") === "effect"),
		[],
	);

	return (
		<PanelView title="Effects">
			<p className="text-muted-foreground mb-3 text-xs">
				Click to add a layer, or select a clip and use Apply on clip.
			</p>
			<EffectsGrid effects={effects} />
		</PanelView>
	);
}

export function AdjustmentView() {
	const effects = useMemo(
		() =>
			effectsRegistry
				.getAll()
				.filter((effect) => effect.category === "adjustment"),
		[],
	);

	return (
		<PanelView title="Adjustment">
			<p className="text-muted-foreground mb-3 text-xs">
				Color / look presets. Select a clip first, then click a preset to apply.
			</p>
			<EffectsGrid effects={effects} preferClipApply />
		</PanelView>
	);
}

function EffectsGrid({
	effects,
	preferClipApply = false,
}: {
	effects: EffectDefinition[];
	preferClipApply?: boolean;
}) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{effects.map((effect) => (
				<EffectItem
					key={effect.type}
					effect={effect}
					preferClipApply={preferClipApply}
				/>
			))}
		</div>
	);
}

function EffectPreviewCanvas({ effectType }: { effectType: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const render = () => {
			if (canvasRef.current) {
				effectPreviewService.renderPreview({
					effectType,
					params: {},
					targetCanvas: canvasRef.current,
				});
			}
		};

		render();
		return effectPreviewService.onPreviewImageReady({ callback: render });
	}, [effectType]);

	return <canvas ref={canvasRef} className="size-full" />;
}

function EffectItem({
	effect,
	preferClipApply,
}: {
	effect: EffectDefinition;
	preferClipApply: boolean;
}) {
	const editor = useEditor();

	const handleAddToTimeline = useCallback(() => {
		const selected = editor.selection.getSelectedElements();
		if (preferClipApply && selected.length > 0) {
			for (const ref of selected) {
				editor.command.execute({
					command: new AddClipEffectCommand({
						trackId: ref.trackId,
						elementId: ref.elementId,
						effectType: effect.type,
					}),
				});
			}
			toast.success(`Applied ${effect.name} to selection`);
			return;
		}

		const currentTime = editor.playback.getCurrentTime();
		const element = buildEffectElement({
			effectType: effect.type,
			startTime: currentTime,
		});

		editor.timeline.insertElement({
			placement: { mode: "auto", trackType: "effect" },
			element,
		});
	}, [editor, effect.type, effect.name, preferClipApply]);

	const preview = <EffectPreviewCanvas effectType={effect.type} />;

	return (
		<DraggableItem
			name={effect.name}
			preview={preview}
			dragData={{
				id: effect.type,
				name: effect.name,
				type: "effect",
				effectType: effect.type,
				targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
			}}
			onAddToTimeline={handleAddToTimeline}
			aspectRatio={1}
			isRounded
			variant="card"
			containerClassName="w-full"
		/>
	);
}
