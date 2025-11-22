export const consumeGenerator = <TEvent, TReturn>(
	generator: Generator<TEvent, TReturn>,
	eventCallback: (event: TEvent) => void,
): TReturn => {
	let result = generator.next()

	while (!result.done) {
		eventCallback(result.value)
		result = generator.next()
	}

	return result.value
}

export const consumeAsyncGenerator = async <TEvent, TReturn>(
	generator: AsyncGenerator<TEvent, TReturn>,
	eventCallback: (event: TEvent) => void,
): Promise<TReturn> => {
	let result = await generator.next()

	while (!result.done) {
		eventCallback(result.value)
		result = await generator.next()
	}

	return result.value
}
