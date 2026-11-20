# oc-tps

An [opencode](https://opencode.ai) TUI plugin that shows how fast the model is generating, next to the prompt, as `⚡ 42 tok/s`.

While the model streams, it shows the live rate over the last 3 seconds, marked `~` because it is estimated: opencode only gets token counts once a message finishes, so the plugin counts the characters streamed (answer, thinking and tool-call arguments) and divides by the session's own chars per token. That ratio is measured from the session's finished messages, and is 4 until there is one.

Between streams (prompt processing, a tool running, or idle) it shows the last finished message's average rate, from the provider's token count. The time runs from the message's first token to its end, so prompt processing is left out. Providers that send no usage get the same `~` estimate from characters.

It shows `⚡ – tok/s` until the session has a message to measure.

## Install

Add it to the `plugin` array of `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["file:/path/to/oc-tps"]
}
```

Restart opencode to load it.
