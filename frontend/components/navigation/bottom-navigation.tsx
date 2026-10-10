"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavigationIcon, { type NavigationIconName } from "./navigation-icon";

type NavigationTheme = "light" | "dark";

type NavItem = {
  href: string;
  label: string;
  icon: NavigationIconName;
};

const navigationItems: readonly NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/alerts", label: "Alerts", icon: "alerts" },
  { href: "/captions", label: "Captions", icon: "captions" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/speak";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNavigation({ theme }: { theme: NavigationTheme }) {
  const pathname = usePathname();
  const dark = theme === "dark";

  return (
    <nav
      aria-label="Primary navigation"
      className={[
        "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[440px]",
        "border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        dark
          ? "border-white/10 bg-plum text-muted-on-dark"
          : "border-outline bg-surface text-muted",
      ].join(" ")}
    >
      <div className="flex items-stretch justify-around gap-1">
        {navigationItems.map(({ href, label, icon }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-[56px] min-w-0 flex-1 touch-manipulation flex-col",
                "items-center justify-center gap-1 rounded-xl px-1 py-2",
                "text-[10px] font-medium transition-colors",
                active
                  ? dark
                    ? "text-[#d1b4ff]"
                    : "text-brand-deep"
                  : dark
                    ? "text-muted-on-dark hover:text-light-on-dark"
                    : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              <NavigationIcon name={icon} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
