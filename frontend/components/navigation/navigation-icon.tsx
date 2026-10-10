export type NavigationIconName = "home" | "alerts" | "captions" | "settings";

export default function NavigationIcon({ name }: { name: NavigationIconName }) {
  const shared = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.65,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      aria-hidden="true"
      width="21"
      height="21"
      viewBox="0 0 24 24"
      {...shared}
    >
      {name === "home" && (
        <>
          <path d="m3.5 10 8.5-7 8.5 7v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
          <path d="M9 21v-8h6v8" />
        </>
      )}
      {name === "alerts" && (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      )}
      {name === "captions" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M7 10h3m-3 4h3m3-4h4m-4 4h4" />
        </>
      )}
      {name === "settings" && (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="9" cy="18" r="2" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
