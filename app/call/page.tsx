import type { Metadata } from "next";
import { Suspense } from "react";
import { CallPage, CallPageFallback } from "@/components/studio/call/call-page";

/** One demo call's own page (/call/?r=<token>), opened from the after-call pop-up and the call's email. Private: never indexed. */
export const metadata: Metadata = {
  title: "Your call",
  description: "The recording, transcript and every step of your demo call with a Digital Macaroni voice agent.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function Page() {
  // The token is read in the browser (static export): the page renders inside Suspense.
  return <Suspense fallback={<CallPageFallback />}><CallPage /></Suspense>;
}
