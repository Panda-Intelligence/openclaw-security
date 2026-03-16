import React from 'react';

interface Props {
  score: number;
}

export function ScoreBadge({ score }: Props) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        color,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {score}
    </span>
  );
}
