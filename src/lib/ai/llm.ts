// Provider-agnostic LLM call. Default: Anthropic Messages API. Also supports any OpenAI-compatible endpoint
// (OpenAI, Groq, OpenRouter, self-hosted vLLM/Ollama) => "independent / own AI" can be swapped without code change.
export type LLM = (system: string, user: string) => Promise<string>;
let override: LLM | null = null; export const setLLM = (f: LLM | null) => { override = f; };
export const llmConfigured = () => !!override || !!(process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY);
export const llm: LLM = async (system, user) => {
  if (override) return override(system, user);
  const provider = process.env.AI_PROVIDER ?? "anthropic"; const key = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI_NOT_CONFIGURED");
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 45_000);
  try {
    if (provider === "anthropic") {
      const r = await fetch(process.env.AI_BASE_URL ?? "https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: process.env.AI_MODEL ?? "claude-sonnet-5-5", max_tokens: 1500, temperature: 0, system, messages: [{ role: "user", content: user }] }) });
      if (!r.ok) throw new Error(`AI_HTTP_${r.status}`); const j: any = await r.json(); return (j.content ?? []).map((c: any) => c.text ?? "").join("");
    }
    const r = await fetch((process.env.AI_BASE_URL ?? "https://api.openai.com/v1") + "/chat/completions", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.AI_MODEL ?? "gpt-4o-mini", temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
    if (!r.ok) throw new Error(`AI_HTTP_${r.status}`); const j: any = await r.json(); return j.choices?.[0]?.message?.content ?? "";
  } finally { clearTimeout(to); }
};
