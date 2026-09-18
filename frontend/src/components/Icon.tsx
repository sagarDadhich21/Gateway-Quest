interface IconProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Renders one symbol from the sprite in IconSprite.tsx, matching the source's <svg class="icon"><use href="#i-name"></use></svg> pattern. */
export function Icon({ name, size = "md", className = "" }: IconProps) {
  const sizeClass = size === "sm" ? "icon-sm" : size === "lg" ? "icon-lg" : "";
  return (
    <svg className={["icon", sizeClass, className].filter(Boolean).join(" ")}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
