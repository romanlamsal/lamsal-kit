import { EventEmitter } from "node:events";
import type { z } from "zod";

type EventMap<TSchema extends { type: string }> = {
	[K in TSchema["type"]]: Extract<TSchema, { type: K }>;
};

export interface TypedEventEmitter<TSchema extends { type: string }> {
	on<K extends TSchema["type"]>(
		event: K,
		listener: (data: EventMap<TSchema>[K]) => void,
		signal?: AbortSignal,
	): void;
	off<K extends TSchema["type"]>(
		event: K,
		listener: (data: EventMap<TSchema>[K]) => void,
	): void;
	emit(data: TSchema): void;
}

export const createTypedEventEmitter = <TSchema extends { type: string }>(
	schema: z.ZodType<TSchema>,
): TypedEventEmitter<TSchema> => {
	const emitter = new EventEmitter();

	return {
		on<K extends TSchema["type"]>(
			event: K,
			listener: (data: EventMap<TSchema>[K]) => void,
			signal?: AbortSignal,
		): void {
			emitter.on(event, listener);

			if (signal) {
				signal.addEventListener("abort", () => {
					emitter.off(event, listener);
				});
			}
		},

		off<K extends TSchema["type"]>(
			event: K,
			listener: (data: EventMap<TSchema>[K]) => void,
		): void {
			emitter.off(event, listener);
		},

		emit(data: TSchema): void {
			const parsed = schema.parse(data);
			emitter.emit(parsed.type, parsed);
		},
	};
};
