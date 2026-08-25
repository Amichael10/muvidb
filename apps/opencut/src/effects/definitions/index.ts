import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { canvasEffectDefinitions } from "./canvas-color";

const defaultEffects = [blurEffectDefinition, ...canvasEffectDefinitions];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
