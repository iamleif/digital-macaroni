import type { DemoId } from "../protocol.js";
import { formfield } from "./formfield.js";
import { northline } from "./northline.js";
import type { DemoDefinition } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const demos: Record<DemoId, DemoDefinition<any>> = { northline, formfield };

export const isDemoId = (v: unknown): v is DemoId => v === "northline" || v === "formfield";
