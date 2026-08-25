"use client";

import { useCallback } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { effectsRegistry, EFFECT_TARGET_ELEMENT_TYPES } from "@/effects";
import { effectPreviewService } from "@/services/renderer/effect-preview";
import { useEditor } from "@/editor/use-editor";
import { buildEffectElement } from "@/timeline/element-utils";
import { AddClipEffectCommand } from "@/commands/timeline";
import { toast } from "sonner";
import type { EffectDefinition } from "@/effects/types";
import { useEffect, useRef } from "react";

export function AdjustmentView() {
	const adjustments = effectsRegistry
		.getAll()
		.filter((effect) => effect.category === "adjustment");

	return (
		<PanelView title="Adjustment">
			<p className="text-muted-foreground mb-3 text-xs leading-relaxed">
				Color looks for the selected clip — click to apply, or drag onto a
				layer.
			</p>
			<div
				className="grid gap-2"
				style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
			>
				{adjustments.map((effect) => (
					<AdjustmentItem key={effect.type} effect={effect} />
				))}
			</div>
		</PanelView>
	);
}

function Preview({ effectType }: { effectType: string }) {
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

function AdjustmentItem({ effect }: { effect: EffectDefinition }) {
	const editor = useEditor();

	const apply = useCallback(() => {
		const selected = editor.selection.getSelectedElements();
		if (selected.length > 0) {
			for (const ref of selected) {
				editor.command.execute({
					command: new AddClipEffectCommand({
						trackId: ref.trackId,
						elementId: ref.elementId,
						effectType: effect.type,
					}),
				});
			}
			toast.success(`Applied ${effect.name}`);
			return;
		}

		const element = buildEffectElement({
			effectType: effect.type,
			startTime: editor.playback.getCurrentTime(),
		});
		editor.timeline.insertElement({
			placement: { mode: "auto", trackType: "effect" },
			element,
		});
		toast.message(`${effect.name} added as layer — or select a clip first`);
	}, [editor, effect.type, effect.name]);

	return (
		<DraggableItem
			name={effect.name}
			preview={<Preview effectType={effect.type} />}
			dragData={{
				id: effect.type,
				name: effect.name,
				type: "effect",
				effectType: effect.type,
				targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
			}}
			onAddToTimeline={apply}
			aspectRatio={1}
			isRounded
			variant="card"
			containerClassName="w-full"
		/>
	);
}
