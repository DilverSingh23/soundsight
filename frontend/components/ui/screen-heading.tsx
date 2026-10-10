type ScreenHeadingProps = {
  title: string;
  subtitle?: string;
  inverted?: boolean;
  className?: string;
};

/** Editorial serif headings and restrained supporting copy from the designs. */
export default function ScreenHeading({
  title,
  subtitle,
  inverted = false,
  className = "",
}: ScreenHeadingProps) {
  return (
    <header className={className}>
      <h1
        className={[
          "font-display text-[30px] leading-[1.12] tracking-[-0.02em]",
          inverted ? "text-light-on-dark" : "text-foreground",
        ].join(" ")}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={[
            "mt-2 text-xs leading-relaxed",
            inverted ? "text-muted-on-dark" : "text-muted",
          ].join(" ")}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
