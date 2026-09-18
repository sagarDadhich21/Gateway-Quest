interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
}

const SIZE = 130;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Matches the source's donutChart()/chart-legend pattern (mockData/reports section of PAGES.reports). */
export function DonutChart({ segments, centerLabel }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="chart-row">
      <div className="donut-wrap">
        <svg className="chart-svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#eef0f7" strokeWidth={STROKE} />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const fraction = s.value / total;
                const dash = fraction * CIRCUMFERENCE;
                const circle = (
                  <circle
                    key={s.label}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  />
                );
                offset += dash;
                return circle;
              })}
        </svg>
        <div className="donut-center">
          <div className="n">{total}</div>
          <div className="l">{centerLabel}</div>
        </div>
      </div>
      <div className="chart-legend">
        {segments.map((s) => (
          <div className="chart-legend-item" key={s.label}>
            <span className="chart-legend-dot" style={{ background: s.color }} />
            {s.label}
            <span className="v">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
