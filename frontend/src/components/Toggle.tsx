interface ToggleProps {
  on: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/** Matches the source's .toggle/.toggle.on switch styling exactly. */
export function Toggle({ on, onChange, disabled, label }: ToggleProps) {
  return (
    <div
      className={"toggle" + (on ? " toggle--on" : "") + (disabled ? " toggle--disabled" : "")}
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!on)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onChange(!on);
        }
      }}
    />
  );
}
