import { Icon } from "./Icon";

interface StatusBadgeProps {
  label: string;
  tone: "success" | "pending" | "error";
}

const TONE_ICON: Record<StatusBadgeProps["tone"], string> = {
  success: "check-circle",
  pending: "clock",
  error: "x-circle",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <Icon name={TONE_ICON[tone]} size="sm" />
      {label}
    </span>
  );
}
