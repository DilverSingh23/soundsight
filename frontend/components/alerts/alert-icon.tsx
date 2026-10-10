export type SoundKind = "siren" | "doorbell" | "speech" | "dog" | "horn";

/** Lightweight icons for the five environmental sound categories in the demo. */
export default function AlertIcon({ kind }: { kind: SoundKind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "siren" && (
        <>
          <path d="M8 15v-4a4 4 0 0 1 8 0v4" />
          <path d="M6.5 15h11l1.5 3h-14zM4 21h16" />
          <path d="M12 2v2M4.3 5.3l1.5 1.5M19.7 5.3l-1.5 1.5M2 12h2m16 0h2" />
        </>
      )}
      {kind === "doorbell" && (
        <>
          <path d="M6 10a6 6 0 1 1 12 0v5l2 3H4l2-3zM10 21h4" />
          <path d="M12 1v2" />
        </>
      )}
      {kind === "speech" && (
        <>
          <path d="M20 15a3 3 0 0 1-3 3h-4l-4 3v-3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
          <path d="M8 10h8m-8 3h5" />
        </>
      )}
      {kind === "dog" && (
        <>
          <path d="M7 7 4 5 2.5 10l2 4M17 7l3-2 1.5 5-2 4" />
          <path d="M7 7a8 8 0 0 1 10 0l2 7-3 6H8l-3-6z" />
          <path d="M9 13h.01M15 13h.01M10 17l2 1 2-1" />
        </>
      )}
      {kind === "horn" && (
        <>
          <path d="M4 11h12l3 3v5H5l-2-3v-3z" />
          <path d="M7 11V7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v4" />
          <path d="M7 19v2m10-2v2M4 15h3m9 0h3" />
        </>
      )}
    </svg>
  );
}
