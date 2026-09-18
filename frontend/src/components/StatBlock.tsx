import { Icon } from "./Icon";

interface StatBlockProps {
  label: string;
  value: string | number;
  hint: string;
  icon: string;
  color?: string;
}

/** Matches the source's stat() helper (label/value/hint/icon, used inline inside a card's grid, not its own bordered card). */
export function StatBlock({ label, value, hint, icon, color = "var(--text)" }: StatBlockProps) {
  return (
    <div className="stat-block">
      <div className="stat-block__top">
        <div className="stat-block__label">{label}</div>
        <div className="stat-block__icon" style={{ color }}>
          <Icon name={icon} />
        </div>
      </div>
      <div className="stat-block__value" style={{ color }}>{value}</div>
      <div className="stat-block__hint">{hint}</div>
    </div>
  );
}
