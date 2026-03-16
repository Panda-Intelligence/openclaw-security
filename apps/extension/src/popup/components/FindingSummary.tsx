import React from 'react';

interface Props {
  title: string;
  severity: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

export function FindingSummary({ title, severity }: Props) {
  const color = SEVERITY_COLORS[severity] ?? '#6b7280';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        borderBottom: '1px solid #1a1a25',
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>{title}</span>
      <span style={{ color, fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}>{severity}</span>
    </div>
  );
}
