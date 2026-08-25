import http from "node:http";

function parseJson(value) {
  const normalized = String(value ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

export async function ollamaJson({
  model,
  system,
  prompt,
  schema,
  temperature = 0.65,
  numPredict = 2_400,
  context = 16_384,
  hostname = "127.0.0.1",
  port = 11_434,
  timeoutMs = 10 * 60 * 1_000,
}) {
  const requestBody = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    format: schema,
    stream: true,
    think: false,
    keep_alive: "30m",
    options: { temperature, num_predict: numPredict, num_ctx: context },
  });

  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      hostname,
      port,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
    }, resolve);
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Ollama request timed out after ${timeoutMs}ms.`)));
    request.end(requestBody);
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    let errorBody = "";
    for await (const chunk of response) errorBody += chunk;
    let payload;
    try { payload = parseJson(errorBody); } catch { payload = null; }
    throw new Error(payload?.error?.message || payload?.detail || payload?.error || `Ollama returned HTTP ${response.statusCode}.`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let sawDone = false;
  for await (const chunk of response) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const payload = JSON.parse(line);
      if (payload.error) throw new Error(payload.error);
      content += payload.message?.content ?? "";
      sawDone ||= payload.done === true;
    }
  }
  if (buffer.trim()) {
    const payload = JSON.parse(buffer);
    if (payload.error) throw new Error(payload.error);
    content += payload.message?.content ?? "";
    sawDone ||= payload.done === true;
  }
  if (!sawDone) throw new Error("Ollama response ended before a completed generation receipt was received.");
  return parseJson(content);
}

export const stringObjectSchema = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(properties.map((property) => [property, { type: "string" }])),
  required: properties,
});
