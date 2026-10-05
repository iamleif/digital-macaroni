import { llmInfoText } from "@/components/studio/llm-info";

export const dynamic = "force-static";

/** /llm-info.txt: the fact sheet as plain text for AI assistants. */
export function GET() {
  return new Response(llmInfoText(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
