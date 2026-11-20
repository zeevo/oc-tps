// How far back the live rate looks. Short enough to follow the model, long enough to smooth over bursty streams
export const WINDOW_MS = 3000;
// Chars per token until the session has a finished message to measure it from
const DEFAULT_CHARS_PER_TOKEN = 4;

// Characters the model has generated in a message: answer, thinking and tool-call arguments
export function generatedChars(parts) {
	let chars = 0;
	for (const part of parts) {
		if (part.type === "text" || part.type === "reasoning") chars += part.text?.length ?? 0;
		else if (part.type === "tool") chars += part.state?.raw?.length ?? JSON.stringify(part.state?.input ?? "").length;
	}
	return chars;
}

export function outputTokens(message) {
	return (message.tokens?.output ?? 0) + (message.tokens?.reasoning ?? 0);
}

// When the first token arrived, so the rate leaves out the prompt processing before it
function firstTokenAt(message, parts) {
	let first;
	for (const part of parts) {
		const start = part.time?.start ?? part.state?.time?.start;
		if (start !== undefined && (first === undefined || start < first)) first = start;
	}
	return first ?? message.time.created;
}

// Chars per token in this session's finished messages, to turn the live char rate into tokens
export function charsPerToken(messages, partsOf) {
	let chars = 0;
	let tokens = 0;
	for (const message of messages) {
		if (message.role !== "assistant" || !message.time?.completed) continue;
		const messageChars = generatedChars(partsOf(message.id));
		const messageTokens = outputTokens(message);
		// Skip messages with hidden thinking or no usage, which would skew the ratio
		if (messageChars === 0 || messageTokens === 0) continue;
		chars += messageChars;
		tokens += messageTokens;
	}
	return tokens ? Math.min(8, Math.max(1.5, chars / tokens)) : DEFAULT_CHARS_PER_TOKEN;
}

// Average decode rate of a finished message, from the provider's token count when it reports one
export function finishedRate(message, parts, ratio) {
	const seconds = (message.time.completed - firstTokenAt(message, parts)) / 1000;
	if (seconds <= 0) return undefined;
	const tokens = outputTokens(message);
	if (tokens) return { tps: tokens / seconds, estimated: false };
	const chars = generatedChars(parts);
	return chars ? { tps: chars / ratio / seconds, estimated: true } : undefined;
}

// Rate over the samples in the window, each { at, chars }. Undefined while nothing is streaming
export function liveRate(samples, ratio) {
	if (samples.length < 2) return undefined;
	const first = samples[0];
	const last = samples[samples.length - 1];
	const seconds = (last.at - first.at) / 1000;
	if (seconds <= 0 || last.chars <= first.chars) return undefined;
	return { tps: (last.chars - first.chars) / ratio / seconds, estimated: true };
}

export function formatRate(rate) {
	if (!rate) return "⚡ – tok/s";
	const tps = rate.tps < 10 ? rate.tps.toFixed(1) : Math.round(rate.tps).toString();
	return `⚡ ${rate.estimated ? "~" : ""}${tps} tok/s`;
}
