interface Props {
  data: { date: string; avgScore: number; count: number }[];
}

export function TrendChart({ data }: Props) {
  if (data.length < 2) return <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Not enough data for trend</p>;

  const width = 600;
  const height = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const scores = data.map((d) => d.avgScore);
  const minY = Math.min(...scores, 0);
  const maxY = Math.max(...scores, 100);

  const xStep = w / (data.length - 1);
  const scaleY = (v: number) => pad.top + h - ((v - minY) / (maxY - minY)) * h;

  const points = data.map((d, i) => `${pad.left + i * xStep},${scaleY(d.avgScore)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={scaleY(v)} x2={width - pad.right} y2={scaleY(v)} stroke="var(--border)" strokeDasharray="4" />
          <text x={pad.left - 8} y={scaleY(v) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">
            {v}
          </text>
        </g>
      ))}

      {/* Line */}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />

      {/* Dots */}
      {data.map((d, i) => (
        <circle key={d.date} cx={pad.left + i * xStep} cy={scaleY(d.avgScore)} r="3" fill="var(--accent)" />
      ))}

      {/* X labels (first, middle, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
        const d = data[i];
        if (!d) return null;
        return (
          <text key={i} x={pad.left + i * xStep} y={height - 5} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}
