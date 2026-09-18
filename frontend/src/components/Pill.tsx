import { Icon } from "./Icon";

export type PillTone = "success" | "warning" | "error" | "neutral" | "info" | "purple";

interface PillProps {
  label: string;
  tone: PillTone;
}

/** Matches badge()/BADGE_ICONS in the source (b-green/b-red/b-orange/b-blue/b-purple/b-gray). */
const TONE_ICON: Record<PillTone, string> = {
  success: "check-circle",
  error: "x-circle",
  warning: "clock",
  info: "info-circle",
  purple: "edit",
  neutral: "minus-circle",
};

export function Pill({ label, tone }: PillProps) {
  return (
    <span className={`pill pill--${tone}`}>
      <Icon name={TONE_ICON[tone]} size="sm" />
      {label}
    </span>
  );
}
