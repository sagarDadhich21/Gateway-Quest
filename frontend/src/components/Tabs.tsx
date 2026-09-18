export interface TabOption {
  label: string;
  value: string;
}

interface TabsProps {
  options: TabOption[];
  active: string;
  onChange: (value: string) => void;
}

export function Tabs({ options, active, onChange }: TabsProps) {
  return (
    <div className="tabs" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === active}
          className={"tabs__tab" + (opt.value === active ? " tabs__tab--active" : "")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
