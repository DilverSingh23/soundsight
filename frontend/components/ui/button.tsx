import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "soft" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-brand to-brand-deep text-white shadow-[0_8px_20px_rgba(112,64,187,0.22)] hover:brightness-110",
  soft: "bg-brand-soft text-foreground hover:brightness-95",
  outline:
    "border border-outline bg-transparent text-foreground hover:bg-surface-muted",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
};

/** Minimum 44px touch target, consistent across the mobile screens. */
export default function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-5 py-3 text-sm font-medium",
        "transition-[filter,background-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
