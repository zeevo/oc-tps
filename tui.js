import { createElement, insert, setProp } from "@opentui/solid";
import { createSignal } from "solid-js";
import { WINDOW_MS, charsPerToken, finishedRate, formatRate, generatedChars, liveRate } from "./tps.js";

const tui = async (api) => {
	const [now, setNow] = createSignal(Date.now());
	const tick = setInterval(() => setNow(Date.now()), 500);
	api.lifecycle.onDispose(() => clearInterval(tick));

	// Recent { at, chars } samples of the message being streamed, per session
	const streams = new Map();

	api.slots.register({
		slots: {
			session_prompt_right(_ctx, props) {
				const node = createElement("text");
				setProp(node, "fg", api.theme.current.textMuted);
				insert(node, () => {
					const at = now();
					const messages = api.state.session.messages(props.session_id);
					const assistant = messages.filter((message) => message.role === "assistant");
					const ratio = charsPerToken(assistant, api.state.part);

					const current = assistant[assistant.length - 1];
					if (current && !current.time.completed) {
						let stream = streams.get(props.session_id);
						if (stream?.messageID !== current.id) {
							stream = { messageID: current.id, samples: [] };
							streams.set(props.session_id, stream);
						}
						stream.samples.push({ at, chars: generatedChars(api.state.part(current.id)) });
						while (stream.samples.length > 2 && at - stream.samples[0].at > WINDOW_MS) stream.samples.shift();
						const rate = liveRate(stream.samples, ratio);
						if (rate) return formatRate(rate);
					} else {
						streams.delete(props.session_id);
					}

					// Prompt processing, a tool running, or idle: show the last finished message's rate
					const finished = assistant.findLast((message) => message.time.completed);
					return formatRate(finished && finishedRate(finished, api.state.part(finished.id), ratio));
				});
				return node;
			},
		},
	});
};

export default { id: "oc-tps", tui };
