import { FunctionTool, type BaseTool } from "@google/adk";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, maskNumber, type DemoDefinition, type OpResult } from "./demos/types.js";
import { log } from "./log.js";
import { getSession, type DemoSession } from "./session.js";

/**
 * The agent's tools for one demo, independent of which voice engine asks for them. Each tool runs
 * against the calling session's own records and reports the actual result twice from the same
 * value: to the model (what it may say) and to the session's viewers (what the dashboard and
 * conversation panel show). Gemini reaches them through ADK (demoTools); ElevenLabs through
 * runTool, with its arguments validated here.
 */
export interface ToolSpec {
  name: string;
  description: string;
  parameters?: z.ZodObject;
  run(session: DemoSession, args: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export function toolSpecs(demo: DemoDefinition<unknown>): ToolSpec[] {
  const operations: ToolSpec[] = Object.entries(demo.operations).map(([name, op]) => ({
    name,
    description: op.description,
    ...(op.parameters ? { parameters: op.parameters } : {}),
    async run(session, args) {
      const callId = randomUUID().slice(0, 8);
      const started = Date.now();
      session.emit({ type: "tool.started", callId, tool: name, label: op.label });
      let r: OpResult;
      if ("callerConfirmed" in args && args.callerConfirmed !== true) {
        r = fail("not_confirmed", "Read the details back and get a clear yes from the caller first.");
      } else {
        try {
          r = op.run(session.state, args as never, { now: new Date(), channel: session.channel });
        } catch (err) {
          log.error("tool.crashed", { session: session.id, tool: name }, err);
          r = fail("internal_error", "Something went wrong. Apologise and offer to take a message instead.");
        }
      }
      log.info("tool.result", { session: session.id, tool: name, outcome: r.ok ? "ok" : r.error, latency_ms: Date.now() - started });
      if (r.ok) {
        if (r.changed) session.publishState();
        session.emit({ type: "tool.succeeded", callId, tool: name, label: op.label, summary: r.summary, version: session.version });
        return { ok: true, ...r.result };
      }
      session.emit({ type: "tool.failed", callId, tool: name, label: op.label, summary: r.message });
      return { ok: false, error: r.error, message: r.message, ...(r.result ?? {}) };
    },
  }));

  return [
    ...operations,
    {
      name: "get_caller_number",
      description:
        "The phone number this caller is calling from, when the network provides it. Use it instead of asking them to recite a number: confirm it by its last four digits (\"the number ending 0142\"), and use the full number for take_message if they agree. Not available in website conversations.",
      async run(session) {
        if (session.channel !== "phone") return { ok: false, error: "not_a_phone_call", message: "This is a website conversation; ask for a number if one is needed." };
        const callId = randomUUID().slice(0, 8);
        const label = "Checking the number you’re calling from";
        session.emit({ type: "tool.started", callId, tool: "get_caller_number", label });
        const n = session.callerNumber;
        if (!n) {
          session.emit({ type: "tool.failed", callId, tool: "get_caller_number", label, summary: "Caller ID withheld" });
          return { ok: false, error: "withheld", message: "The caller's number is hidden. Ask for a callback number." };
        }
        session.emit({ type: "tool.succeeded", callId, tool: "get_caller_number", label, summary: `Calling from ${maskNumber(n)}`, version: session.version });
        return { ok: true, number: n, lastFour: n.slice(-4) };
      },
    },
    {
      name: "link_screen",
      description: "Link this phone call to the caller's screen when they read you the four-digit code shown on the website, so they can watch the dashboard. Pass only the digits.",
      parameters: z.object({ code: z.string().describe("The four digits the caller read out.") }),
      async run(session, args) {
        if (!session.linkScreen) return { ok: false, error: "not_a_phone_call", message: "This conversation is already on the website." };
        const result = session.linkScreen(String(args.code ?? "").replace(/\D/g, ""));
        return result === "linked" ? { ok: true, linked: true } : { ok: false, error: result, message: "That code did not match a waiting screen. Ask them to check the code on the page." };
      },
    },
    {
      name: "end_call",
      description: "End the conversation after you have said goodbye.",
      async run(session) {
        session.requestEnd("agent_ended");
        return { ok: true };
      },
    },
  ];
}

/** ADK function tools for Gemini Live. ADK validates arguments against each schema before calling. */
export function demoTools(demo: DemoDefinition<unknown>): BaseTool[] {
  return toolSpecs(demo).map(
    (spec) =>
      new FunctionTool({
        name: spec.name,
        description: spec.description,
        ...(spec.parameters ? { parameters: spec.parameters } : {}),
        execute: async (input: unknown, ctx: { sessionId?: string } | undefined) => {
          const session = getSession(ctx?.sessionId);
          if (!session || session.ended) return { ok: false, error: "session_ended" };
          return spec.run(session, (input ?? {}) as Record<string, unknown>);
        },
      }),
  );
}

/** Runs a tool by name for engines that do not validate arguments themselves (ElevenLabs). */
export async function runTool(specs: ToolSpec[], session: DemoSession, name: string, input: unknown): Promise<Record<string, unknown>> {
  const spec = specs.find((s) => s.name === name);
  if (!spec) return { ok: false, error: "unknown_tool" };
  if (session.ended) return { ok: false, error: "session_ended" };
  const parsed = spec.parameters ? spec.parameters.safeParse(input ?? {}) : { success: true as const, data: (input ?? {}) as Record<string, unknown> };
  if (!parsed.success) return { ok: false, error: "invalid_arguments", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return spec.run(session, parsed.data as Record<string, unknown>);
}
