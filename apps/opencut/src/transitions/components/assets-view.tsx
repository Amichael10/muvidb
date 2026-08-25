"use client";

import { useCallback } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { BatchCommand } from "@/commands";
import { UpsertKeyframeCommand } from "@/commands/timeline";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { toast } from "sonner";
import type { AnimationPath } from "@/animation/types";

type TransitionPreset = {
	id: string;
	name: string;
	description: string;
	build: (args: {
		trackId: string;
		elementId: string;
		durationSeconds: number;
	}) => UpsertKeyframeCommand[];
};

function fadeDuration({ durationSeconds }: { durationSeconds: number }) {
	return Math.min(0.75, Math.max(0.15, durationSeconds * 0.2));
}

const TRANSITIONS: TransitionPreset[] = [
	{
		id: "fade-in",
		name: "Fade In",
		description: "Opacity 0 → 1 at start",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 0,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 1,
				}),
			];
		},
	},
	{
		id: "fade-out",
		name: "Fade Out",
		description: "Opacity 1 → 0 at end",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({
						seconds: Math.max(0, durationSeconds - fade),
					}),
					value: 1,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: durationSeconds }),
					value: 0,
				}),
			];
		},
	},
	{
		id: "fade-in-out",
		name: "Fade In / Out",
		description: "Fade both ends",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 0,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 1,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({
						seconds: Math.max(fade, durationSeconds - fade),
					}),
					value: 1,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: durationSeconds }),
					value: 0,
				}),
			];
		},
	},
	{
		id: "zoom-in",
		name: "Zoom In",
		description: "Scale up from 80%",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			const paths: AnimationPath[] = ["transform.scaleX", "transform.scaleY"];
			return paths.flatMap((propertyPath) => [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 0.8,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 1,
				}),
			]);
		},
	},
	{
		id: "zoom-out",
		name: "Zoom Out",
		description: "Scale down to 80% at end",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			const paths: AnimationPath[] = ["transform.scaleX", "transform.scaleY"];
			return paths.flatMap((propertyPath) => [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: mediaTimeFromSeconds({
						seconds: Math.max(0, durationSeconds - fade),
					}),
					value: 1,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: mediaTimeFromSeconds({ seconds: durationSeconds }),
					value: 0.8,
				}),
			]);
		},
	},
	{
		id: "pop-in",
		name: "Pop In",
		description: "Scale + fade from 0",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = Math.min(0.45, fadeDuration({ durationSeconds }));
			const scalePaths: AnimationPath[] = [
				"transform.scaleX",
				"transform.scaleY",
			];
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 0,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 1,
				}),
				...scalePaths.flatMap((propertyPath) => [
					new UpsertKeyframeCommand({
						trackId,
						elementId,
						propertyPath,
						time: mediaTimeFromSeconds({ seconds: 0 }),
						value: 0.6,
					}),
					new UpsertKeyframeCommand({
						trackId,
						elementId,
						propertyPath,
						time: mediaTimeFromSeconds({ seconds: fade }),
						value: 1,
					}),
				]),
			];
		},
	},
	{
		id: "slide-up",
		name: "Slide Up",
		description: "Rise into frame",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "transform.positionY",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 180,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "transform.positionY",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 0,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 0,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "opacity",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 1,
				}),
			];
		},
	},
	{
		id: "slide-left",
		name: "Slide Left",
		description: "Enter from right",
		build: ({ trackId, elementId, durationSeconds }) => {
			const fade = fadeDuration({ durationSeconds });
			return [
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "transform.positionX",
					time: mediaTimeFromSeconds({ seconds: 0 }),
					value: 220,
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath: "transform.positionX",
					time: mediaTimeFromSeconds({ seconds: fade }),
					value: 0,
				}),
			];
		},
	},
];

export function TransitionsView() {
	const editor = useEditor();

	const applyTransition = useCallback(
		(preset: TransitionPreset) => {
			const selected = editor.selection.getSelectedElements();
			if (selected.length === 0) {
				toast.error("Select a clip on the timeline first");
				return;
			}

			const commands: UpsertKeyframeCommand[] = [];
			for (const ref of selected) {
				const found = findElement({
					editor,
					trackId: ref.trackId,
					elementId: ref.elementId,
				});
				if (!found) continue;
				const durationSeconds = mediaTimeToSeconds({
					time: found.duration,
				});
				commands.push(
					...preset.build({
						trackId: ref.trackId,
						elementId: ref.elementId,
						durationSeconds,
					}),
				);
			}

			if (commands.length === 0) {
				toast.error("Could not apply transition to selection");
				return;
			}

			editor.command.execute({
				command:
					commands.length === 1
						? commands[0]
						: new BatchCommand(commands),
			});
			toast.success(`Applied ${preset.name}`);
		},
		[editor],
	);

	return (
		<PanelView title="Transitions">
			<p className="text-muted-foreground mb-3 text-xs leading-relaxed">
				Select a clip, then apply a transition. These animate opacity / scale /
				position with keyframes.
			</p>
			<div className="grid gap-2">
				{TRANSITIONS.map((preset) => (
					<button
						key={preset.id}
						type="button"
						className="hover:bg-accent flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors"
						onClick={() => applyTransition(preset)}
					>
						<span className="text-sm font-medium">{preset.name}</span>
						<span className="text-muted-foreground text-[11px]">
							{preset.description}
						</span>
					</button>
				))}
			</div>
			<div className="pt-3">
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					onClick={() => {
						const selected = editor.selection.getSelectedElements();
						if (!selected.length) {
							toast.error("Select a clip first");
							return;
						}
						toast.message("Tip: use the Properties panel to fine-tune keyframes");
					}}
				>
					{editor.selection.getSelectedElements().length
						? `${editor.selection.getSelectedElements().length} clip(s) selected`
						: "No clip selected"}
				</Button>
			</div>
		</PanelView>
	);
}

function findElement({
	editor,
	trackId,
	elementId,
}: {
	editor: ReturnType<typeof useEditor>;
	trackId: string;
	elementId: string;
}) {
	const tracks = editor.scenes.getActiveScene().tracks;
	const all = [
		...tracks.overlay,
		tracks.main,
		...tracks.audio,
	];
	const track = all.find((item) => item.id === trackId);
	return track?.elements.find((el) => el.id === elementId) ?? null;
}
