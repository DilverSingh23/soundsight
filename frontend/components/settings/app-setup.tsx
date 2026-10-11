"use client";

import { useState } from "react";
import { saveBackendAccessCode } from "@/lib/backend-access";

export default function AppSetup() {
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <section aria-labelledby="app-setup-title" className="mt-7 space-y-4 rounded-2xl bg-[#eee8f6] p-4 text-xs leading-relaxed">
      <h2 id="app-setup-title" className="text-sm font-semibold">Install & connect</h2>
      <p>On iPhone, open SoundSight in Safari, tap Share, then Add to Home Screen. On Android, open your browser menu and choose Install app or Add to Home screen. Installation requires an HTTPS address.</p>
      <p>Keep SoundSight open and your screen unlocked while listening. Listening may pause in the background. Lock-screen push is not connected yet.</p>
      <p>Sound labels are model estimates. SoundSight is an assistive prototype and does not replace certified safety-alerting equipment.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (code.trim() && !/^[A-Za-z0-9_-]{32,128}$/.test(code.trim())) {
          setNotice("Use the access code supplied by your demo host.");
          return;
        }
        saveBackendAccessCode(code);
        setCode("");
        setNotice(code.trim() ? "Access code saved for this tab. Restart listening to connect." : "Access code cleared.");
      }}>
        <label htmlFor="demo-access" className="block font-semibold">Demo access code</label>
        <p className="mt-1">Enter the code supplied by your host when using a protected backend. Local development does not require one.</p>
        <input id="demo-access" type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[#c3a9e8] bg-white px-3 text-base" />
        <button type="submit" className="mt-2 min-h-11 rounded-lg border border-[#c3a9e8] px-3 font-semibold">Save code / clear</button>
        <p role="status" className="mt-2">{notice}</p>
      </form>
    </section>
  );
}
