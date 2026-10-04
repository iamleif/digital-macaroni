import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio request signatures and TwiML, adapted from Anders (services/voice/src/twilio.ts).
 * X-Twilio-Signature is HMAC-SHA1 with the account auth token over the exact public URL followed by
 * each POST parameter name and value, sorted by name, base64 encoded.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | undefined): boolean {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The media stream handshake is signed over the stream URL as the TwiML gave it (wss://), or its https:// form. */
export function validMediaSignature(authToken: string, publicUrl: string, signature: string | undefined): boolean {
  const https = `${publicUrl}/twilio/media`;
  return validTwilioSignature(authToken, https.replace(/^http/, "ws"), {}, signature) || validTwilioSignature(authToken, https, {}, signature);
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Straight to the media stream. When the stream ends Twilio asks `action` what next: normally a
 * hang-up, or a short apology if the agent never started.
 */
export function streamTwiml(streamUrl: string, parameters: Record<string, string>, action: string): string {
  const params = Object.entries(parameters)
    .map(([name, value]) => `<Parameter name="${escapeXml(name)}" value="${escapeXml(value)}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect action="${escapeXml(action)}"><Stream url="${escapeXml(streamUrl)}">${params}</Stream></Connect></Response>`;
}

/** A short spoken notice and a polite hang-up, without opening a model session. */
export function noticeTwiml(notice: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna-Neural">${escapeXml(notice)}</Say><Hangup/></Response>`;
}

export function hangupTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';
}

export function rejectTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>';
}
