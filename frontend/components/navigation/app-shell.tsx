"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import BottomNavigation from "./bottom-navigation";
import { useSoundSightPreferences } from "@/lib/preferences";

type AppShellProps = {
  children: ReactNode;
};

/** A shared mobile canvas; routes choose their Figma light/dark presentation. */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { highContrast } = useSoundSightPreferences();
  const isHome = pathname === "/";
  const isCaptions = pathname === "/captions";
  const isAlertDetail = pathname.startsWith("/alerts/");
  const isDark = isHome || isCaptions || isAlertDetail;

  const backdrop = isHome
    ? "bg-plum text-light-on-dark"
    : isCaptions
      ? "bg-caption text-light-on-dark"
      : isAlertDetail
        ? "bg-plum text-light-on-dark"
        : "bg-background text-foreground";

  return (
    <div
      className={`soundsight-shell mx-auto flex min-h-dvh w-full max-w-[440px] flex-col ${backdrop}`}
      data-high-contrast={highContrast ? "true" : "false"}
    >
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNavigation theme={isDark ? "dark" : "light"} />
    </div>
  );
}
