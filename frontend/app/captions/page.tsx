import LiveCaptions from "@/components/captions/live-captions";
import { Suspense } from "react";

export default function CaptionsPage() {
  return <Suspense fallback={<p className="p-5">Loading captions…</p>}><LiveCaptions /></Suspense>;
}
