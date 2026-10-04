import { z } from "zod";
import { addDays, dateIn, dateLabel, fail, ok, reference, maskNumber, Confirmed, type DemoDefinition } from "./types.js";

/**
 * Form & Field: a fictional home-goods shop. The visitor describes what they want, hears about real
 * catalogue items and stock, and reserves one for pickup. Order lookup and support requests are the
 * secondary path. No payment, purchase or delivery happens.
 */
const TIME_ZONE = "America/Chicago";
const HOLD_DAYS = 2;

interface Variant {
  id: string;
  option: string;
  stock: number;
}
interface Product {
  id: string;
  name: string;
  category: "lighting" | "tableware" | "textiles" | "furniture" | "planters";
  price: number;
  description: string;
  materials: string;
  size: string;
  colors: string[];
  variants: Variant[];
}

const CATALOGUE: Product[] = [
  { id: "ridge-lamp", name: "Ridge Table Lamp", category: "lighting", price: 89, description: "A ribbed ceramic table lamp with a soft linen drum shade. Warm, even light for a side table or desk.", materials: "Glazed stoneware base, linen shade, fabric cord", size: "18 inches tall, shade 12 inches across", colors: ["green", "sage", "oat", "beige", "charcoal", "grey"], variants: [{ id: "ridge-sage", option: "Sage green", stock: 3 }, { id: "ridge-oat", option: "Oat", stock: 0 }, { id: "ridge-charcoal", option: "Charcoal", stock: 5 }] },
  { id: "moss-lamp", name: "Moss Glass Lamp", category: "lighting", price: 129, description: "A mouth-blown green glass table lamp. The base glows slightly when it is on.", materials: "Hand-blown glass, brass fittings, cotton shade", size: "16 inches tall", colors: ["green", "moss"], variants: [{ id: "moss-green", option: "Moss green", stock: 1 }] },
  { id: "arc-floor-lamp", name: "Arc Floor Lamp", category: "lighting", price: 189, description: "A slim arching floor lamp that reaches over a sofa or reading chair.", materials: "Powder-coated steel, marble base", size: "68 inches tall, 40 inch reach", colors: ["brass", "gold", "black"], variants: [{ id: "arc-brass", option: "Brushed brass", stock: 2 }, { id: "arc-black", option: "Matte black", stock: 4 }] },
  { id: "pleat-pendant", name: "Pleat Paper Pendant", category: "lighting", price: 64, description: "A pleated paper ceiling shade that softens a bright bulb. Fits a standard pendant fitting.", materials: "Washi-style paper over a steel frame", size: "20 inches across", colors: ["white", "cream"], variants: [{ id: "pleat-white", option: "White", stock: 8 }] },
  { id: "everyday-mugs", name: "Everyday Mugs, set of two", category: "tableware", price: 32, description: "Generous stoneware mugs with a comfortable handle. Dishwasher and microwave safe.", materials: "Stoneware with a satin glaze", size: "12 fluid ounces each", colors: ["sand", "beige", "sage", "green", "ink", "blue"], variants: [{ id: "mugs-sand", option: "Sand", stock: 12 }, { id: "mugs-sage", option: "Sage", stock: 0 }, { id: "mugs-ink", option: "Ink blue", stock: 7 }] },
  { id: "linen-throw", name: "Washed Linen Throw", category: "textiles", price: 78, description: "A heavy, soft washed-linen throw with fringed ends.", materials: "100% European linen", size: "50 by 60 inches", colors: ["olive", "green", "natural", "beige", "rust", "orange"], variants: [{ id: "throw-olive", option: "Olive", stock: 4 }, { id: "throw-natural", option: "Natural", stock: 6 }, { id: "throw-rust", option: "Rust", stock: 0 }] },
  { id: "fold-side-table", name: "Fold Side Table", category: "furniture", price: 145, description: "A small solid-wood side table with a folded lip that stops things sliding off.", materials: "Solid oak or walnut, oil finish", size: "20 inches tall, 16 inch top", colors: ["oak", "light wood", "walnut", "dark wood"], variants: [{ id: "fold-oak", option: "Oak", stock: 2 }, { id: "fold-walnut", option: "Walnut", stock: 0 }] },
  { id: "field-planter", name: "Field Planter", category: "planters", price: 48, description: "A stoneware planter with a drainage hole and matching saucer.", materials: "Stoneware, unglazed inside", size: "Small 6 inches, large 10 inches across", colors: ["sage", "green", "clay", "terracotta"], variants: [{ id: "planter-small-sage", option: "Small, sage", stock: 5 }, { id: "planter-large-sage", option: "Large, sage", stock: 1 }, { id: "planter-large-clay", option: "Large, clay", stock: 3 }] },
];

const ORDERS = [
  { number: "1042", email: "emilia@example.com", name: "Emilia Hayes", items: [{ name: "Everyday Mugs, set of two", option: "Sand", price: 32 }, { name: "Washed Linen Throw", option: "Olive", price: 78 }], status: "Delayed in transit", events: ["Order placed", "Packed", "Shipped", "Carrier delay reported"], expected: 2 },
  { number: "1043", email: "jon@example.com", name: "Jon Park", items: [{ name: "Ridge Table Lamp", option: "Charcoal", price: 89 }], status: "Delivered", events: ["Order placed", "Packed", "Shipped", "Delivered"], expected: -1 },
];

interface Reservation {
  id: string;
  variantId: string;
  quantity: number;
  name: string;
  status: "reserved" | "cancelled";
  pickupBy: string;
  updatedAt: string;
}

export interface FormFieldState {
  seed: string;
  today: string;
  /** Units held by reservations made in this session, by variant. Stock shown is stock minus held. */
  held: Record<string, number>;
  shown: string[];
  focus: string | null;
  reservations: Reservation[];
  matchedOrder: string | null;
  supportRequests: { id: string; orderNumber: string; issue: string; status: "pending_review" }[];
  messages: { id: string; name: string; callbackNumber: string; summary: string }[];
  seq: number;
}

const product = (id: string) => CATALOGUE.find((p) => p.id === id);
const variantOf = (variantId: string) => {
  for (const p of CATALOGUE) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { p, v };
  }
  return null;
};
const available = (state: FormFieldState, v: Variant) => v.stock - (state.held[v.id] ?? 0);
const price = (n: number) => `$${n}`;
const variantView = (state: FormFieldState, v: Variant) => ({ variantId: v.id, option: v.option, inStock: available(state, v) });
const reservationText = (r: Reservation) => {
  const pv = variantOf(r.variantId)!;
  return `${r.quantity} × ${pv.p.name} in ${pv.v.option}, held for ${r.name} until closing on ${dateLabel(r.pickupBy)}. Reference ${r.id}.`;
};

function score(p: Product, q: { query?: string; category?: string; color?: string; maxPrice?: number }): number {
  if (q.category && p.category !== q.category) return 0;
  if (q.maxPrice !== undefined && p.price > q.maxPrice) return 0;
  if (q.color && !p.colors.some((c) => c.includes(q.color!.toLowerCase()) || q.color!.toLowerCase().includes(c))) return 0;
  if (!q.query) return 1;
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
  const vocabulary = new Set(words(`${p.name} ${p.category} ${p.description} ${p.colors.join(" ")}`));
  return words(q.query).reduce((s, w) => s + (vocabulary.has(w) ? 1 : 0), 0);
}

export const formfield: DemoDefinition<FormFieldState> = {
  id: "formfield",
  businessName: "Form & Field",
  agentName: "Theo",

  createState(now) {
    const today = dateIn(TIME_ZONE, now).date;
    return { seed: `${today}:${now.getTime()}`, today, held: {}, shown: [], focus: null, reservations: [], matchedOrder: null, supportRequests: [], messages: [], seq: 0 };
  },

  instruction(state) {
    return `You are Theo. You work at Form & Field, a small home-goods shop selling lighting, tableware, textiles, small furniture and planters, and you answer its phone. Speak as part of the shop ("we", "our shop").

Behind the scenes, and not something to mention unless asked: this line is a demonstration. Reservations, orders and requests are sample records; nothing is charged, held, sold or shipped. If a caller asks directly whether you are a real person, answer honestly and briefly that you are Form & Field's AI assistant. If they ask directly whether this is a real shop or a real reservation, say briefly that this is a demo line and nothing will actually be held or charged, then carry on helping.

Today is ${dateLabel(state.today)}. The shop is at 210 Market Street and open 10 AM to 6 PM, Monday to Saturday. Reserved items are held for ${HOLD_DAYS} days for pickup and paid for in store.

How you speak: calm, helpful and endearing, in an understated way. Warm and gently upbeat, like a kind, unflappable shop assistant: never theatrical, never gushing, never dramatic. Bad news (out of stock, a delayed order, missing details) is said simply and calmly, followed straight away by what you can do; do not sound upset about it. Good news gets a light, friendly touch, not excitement. Never write bracketed delivery or emotion tags such as [happy], [sad] or [slow]; just say the words plainly. Speak at an easy pace in short sentences, one question at a time. Describe products the way a good shop assistant would, using only catalogue facts. Never read out ids. Say prices naturally ("eighty-nine dollars"). Offer at most three items at once. If you are interrupted, stop and listen.

Opening: exactly "Thanks for calling Form & Field, this is Theo. How can I help?" Nothing more.

What you can do, always through your tools:
- Find products with search_products; its results include each item's description, materials, size and stock, so you can describe them straight away. Use get_product_details only to look at an item that was not in the results. Never invent products, prices, sizes, materials or stock.
- Stock: say whether the option they want is in stock, using the inStock numbers. If it is out of stock, say so and suggest available options or similar items from search results.
- Reserve for pickup: confirm the item, option, quantity and the name for the reservation, read them back and ask for a clear yes, then call reserve_item with callerConfirmed true. Tell them the result exactly as returned, including the reference and pickup deadline. Change the quantity or cancel with update_reservation or cancel_reservation after confirming.
- Orders: for "where is my order", ask for the order number and the email on the order, then lookup_order. Only discuss an order after it matches. For a damaged or wrong item on a matched order, use create_support_request; it goes to the team for review. Never promise a refund, replacement or delivery date the tool did not give. Sample details: order 1042 with emilia@example.com.
- Take a message with take_message if they want someone to call back. On a phone call, use get_caller_number and ask whether the number they are calling from (say only its last four digits) is the best one; otherwise ask for a number, and suggest the sample number 555-0142 if they would rather not give theirs.

Rules: never say something is reserved, changed or cancelled unless the tool returned ok true. For a callback, call take_message only after the caller has confirmed the number. If a tool fails, explain simply and offer what it suggests.

Ending: after you finish something for the caller, ask whether there is anything else. Only when the caller says they are done or says goodbye, say a short goodbye and then call end_call. Never call end_call in the same turn as a reservation, change or support request.`;
  },

  operations: {
    search_products: {
      label: "Searching the catalogue",
      description: "Find catalogue items. Returns up to five matches with price and stock by option.",
      parameters: z.object({
        query: z.string().max(120).optional().describe("What they are looking for, in their words, e.g. 'table lamp'."),
        category: z.enum(["lighting", "tableware", "textiles", "furniture", "planters"]).optional(),
        color: z.string().max(30).optional().describe("A colour they asked for."),
        maxPrice: z.number().min(1).optional().describe("Their budget in US dollars."),
      }),
      run(state, input: { query?: string; category?: string; color?: string; maxPrice?: number }) {
        const scored = CATALOGUE.map((p) => ({ p, s: score(p, input) }));
        const best = Math.max(0, ...scored.map((m) => m.s));
        // Keep the strong matches: "table lamp" should not also bring back a table.
        const matches = scored
          .filter((m) => m.s > 0 && m.s >= best * 0.6)
          .sort((a, b) => b.s - a.s || a.p.price - b.p.price)
          .slice(0, 5)
          .map((m) => m.p);
        state.shown = matches.map((p) => p.id);
        state.focus = null;
        if (!matches.length) return ok("No matching items", { matches: [], note: "Nothing in the catalogue matches. Suggest a broader search or a different colour or budget." }, true);
        return ok(`${matches.length} item${matches.length > 1 ? "s" : ""} found`, {
          // The main facts come with the results, so describing an item needs no second lookup.
          matches: matches.map((p) => ({ productId: p.id, name: p.name, price: price(p.price), description: p.description, materials: p.materials, size: p.size, options: p.variants.map((v) => variantView(state, v)) })),
        }, true);
      },
    },

    get_product_details: {
      label: "Checking product details",
      description: "Full catalogue facts for one product: description, materials, size and stock by option.",
      parameters: z.object({ productId: z.string() }),
      run(state, input: { productId: string }) {
        const p = product(input.productId);
        if (!p) return fail("not_found", "That product is not in the catalogue.");
        state.focus = p.id;
        if (!state.shown.includes(p.id)) state.shown = [p.id, ...state.shown].slice(0, 5);
        return ok(p.name, { productId: p.id, name: p.name, price: price(p.price), description: p.description, materials: p.materials, size: p.size, options: p.variants.map((v) => variantView(state, v)) }, true);
      },
    },

    reserve_item: {
      label: "Reserving for pickup",
      description: "Hold an in-stock option for pickup, after the caller said yes to the read-back.",
      parameters: z.object({ variantId: z.string(), quantity: z.number().int().min(1).max(5), name: z.string().min(1).max(80), callerConfirmed: Confirmed }),
      run(state, input: { variantId: string; quantity: number; name: string }, ctx) {
        const pv = variantOf(input.variantId);
        if (!pv) return fail("not_found", "That option is not in the catalogue.");
        const same = state.reservations.find((r) => r.status === "reserved" && r.variantId === input.variantId);
        if (same) return ok(`Already reserved · ${same.id}`, { reservationId: same.id, duplicate: true, confirmation: reservationText(same), note: "Use update_reservation to change the quantity." });
        const free = available(state, pv.v);
        if (free < input.quantity) {
          const others = pv.p.variants.filter((v) => v.id !== pv.v.id && available(state, v) > 0).map((v) => variantView(state, v));
          return fail("insufficient_stock", free > 0 ? `Only ${free} in stock.` : "That option is out of stock.", { inStock: free, otherOptions: others });
        }
        state.held[pv.v.id] = (state.held[pv.v.id] ?? 0) + input.quantity;
        const id = reference("FF", state.seq++, state.seed);
        const r: Reservation = { id, variantId: pv.v.id, quantity: input.quantity, name: input.name.trim(), status: "reserved", pickupBy: addDays(state.today, HOLD_DAYS), updatedAt: ctx.now.toISOString() };
        state.reservations.push(r);
        state.focus = pv.p.id;
        return ok(`Reserved · ${id}`, { reservationId: id, confirmation: reservationText(r), payment: "Paid in store at pickup." }, true);
      },
    },

    update_reservation: {
      label: "Updating the reservation",
      description: "Change the quantity on a reservation made in this call, after the caller confirmed.",
      parameters: z.object({ reservationId: z.string(), quantity: z.number().int().min(1).max(5), callerConfirmed: Confirmed }),
      run(state, input: { reservationId: string; quantity: number }, ctx) {
        const r = state.reservations.find((x) => x.id === input.reservationId && x.status === "reserved");
        if (!r) return fail("not_found", "There is no active reservation with that reference in this call.");
        if (r.quantity === input.quantity) return ok(`No change · ${r.id}`, { reservationId: r.id, unchanged: true, confirmation: reservationText(r) });
        const v = variantOf(r.variantId)!.v;
        const free = available(state, v) + r.quantity;
        if (input.quantity > free) return fail("insufficient_stock", `Only ${free} can be held in total.`, { maxQuantity: free });
        state.held[v.id] = (state.held[v.id] ?? 0) - r.quantity + input.quantity;
        Object.assign(r, { quantity: input.quantity, updatedAt: ctx.now.toISOString() });
        return ok(`Reservation updated · ${r.id}`, { reservationId: r.id, confirmation: reservationText(r) }, true);
      },
    },

    cancel_reservation: {
      label: "Cancelling the reservation",
      description: "Cancel a reservation made in this call, after the caller confirmed. The stock is released.",
      parameters: z.object({ reservationId: z.string(), callerConfirmed: Confirmed }),
      run(state, input: { reservationId: string }, ctx) {
        const r = state.reservations.find((x) => x.id === input.reservationId);
        if (!r) return fail("not_found", "There is no reservation with that reference in this call.");
        if (r.status === "cancelled") return ok(`Already cancelled · ${r.id}`, { reservationId: r.id, unchanged: true });
        state.held[r.variantId] = (state.held[r.variantId] ?? 0) - r.quantity;
        Object.assign(r, { status: "cancelled", updatedAt: ctx.now.toISOString() });
        return ok(`Reservation cancelled · ${r.id}`, { reservationId: r.id, cancelled: true }, true);
      },
    },

    lookup_order: {
      label: "Looking up the order",
      description: "Find an order by its number and the email address on it. Both must match.",
      parameters: z.object({ orderNumber: z.string().max(20), email: z.string().max(120) }),
      run(state, input: { orderNumber: string; email: string }) {
        const number = input.orderNumber.replace(/\D/g, "");
        const email = input.email.trim().toLowerCase().replace(/\s+at\s+/, "@").replace(/\s+dot\s+/g, ".").replace(/\s/g, "");
        const order = ORDERS.find((o) => o.number === number && o.email === email);
        if (!order) {
          state.matchedOrder = null;
          return fail("no_match", "No order matches that number and email together. Ask them to check both.");
        }
        state.matchedOrder = order.number;
        const eta = order.expected >= 0 ? dateLabel(addDays(state.today, order.expected)) : null;
        return ok(`Order ${order.number} matched`, { orderNumber: order.number, customer: order.name.split(" ")[0], items: order.items.map((i) => `${i.name}, ${i.option}`), status: order.status, ...(eta ? { carrierEstimate: eta } : {}) }, true);
      },
    },

    create_support_request: {
      label: "Opening a support request",
      description: "Send a damaged, wrong or missing item report on the matched order to the team for review. Nothing is refunded or replaced automatically.",
      parameters: z.object({ issue: z.string().min(3).max(300) }),
      run(state, input: { issue: string }) {
        if (!state.matchedOrder) return fail("order_not_matched", "Match the order with lookup_order first.");
        const dup = state.supportRequests.find((s) => s.orderNumber === state.matchedOrder);
        if (dup) return ok(`Request already open · ${dup.id}`, { requestId: dup.id, duplicate: true, status: "pending review" });
        const id = reference("CS", state.seq++, state.seed);
        state.supportRequests.push({ id, orderNumber: state.matchedOrder, issue: input.issue.trim(), status: "pending_review" });
        return ok(`Support request · ${id}`, { requestId: id, status: "pending review", next: "The team reviews it and replies by email within one business day." }, true);
      },
    },

    take_message: {
      label: "Leaving a message for the team",
      description: "Leave a callback request for the shop team.",
      parameters: z.object({ name: z.string().min(1).max(80), callbackNumber: z.string().min(7).max(20), summary: z.string().min(3).max(300) }),
      run(state, input: { name: string; callbackNumber: string; summary: string }) {
        const dup = state.messages.find((m) => m.summary === input.summary.trim());
        if (dup) return ok(`Message already left · ${dup.id}`, { messageId: dup.id, duplicate: true });
        const id = reference("MSG", state.seq++, state.seed);
        state.messages.push({ id, name: input.name.trim(), callbackNumber: input.callbackNumber.trim(), summary: input.summary.trim() });
        return ok(`Message for the team · ${id}`, { messageId: id }, true);
      },
    },
  },

  view(state) {
    const order = ORDERS.find((o) => o.number === state.matchedOrder);
    return {
      shown: state.shown.map((id) => {
        const p = product(id)!;
        return { id: p.id, name: p.name, category: p.category, price: p.price, focus: state.focus === p.id, options: p.variants.map((v) => ({ id: v.id, option: v.option, inStock: available(state, v) })), ...(state.focus === p.id ? { description: p.description, materials: p.materials, size: p.size } : {}) };
      }),
      reservations: state.reservations.map((r) => {
        const pv = variantOf(r.variantId)!;
        return { id: r.id, status: r.status, product: pv.p.name, option: pv.v.option, quantity: r.quantity, name: r.name, pickupBy: dateLabel(r.pickupBy), price: pv.p.price * r.quantity };
      }),
      order: order ? { number: order.number, name: order.name, items: order.items, status: order.status, events: order.events } : null,
      supportRequests: state.supportRequests,
      messages: state.messages.map((m) => ({ id: m.id, name: m.name, summary: m.summary, callback: maskNumber(m.callbackNumber) })),
    };
  },
};
