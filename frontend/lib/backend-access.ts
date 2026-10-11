// Entered by the user, never bundled as a NEXT_PUBLIC secret.
const STORAGE_KEY = "soundsight-demo-access";
let memoryCode = "";

export function getBackendAccessCode(): string {
  if (typeof window === "undefined") return "";
  try { return window.sessionStorage?.getItem(STORAGE_KEY) ?? memoryCode; }
  catch { return memoryCode; }
}

export function saveBackendAccessCode(code: string): void {
  memoryCode = code.trim();
  try {
    if (memoryCode) window.sessionStorage.setItem(STORAGE_KEY, memoryCode);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Keep the code in memory when storage is unavailable. */ }
}

export function backendAccessHeaders(): Record<string, string> {
  const code = getBackendAccessCode();
  return code ? { Authorization: `Bearer ${code}` } : {};
}

export function backendSocketProtocols(): string[] {
  const code = getBackendAccessCode();
  return code ? ["soundsight", `access.${code}`] : [];
}
