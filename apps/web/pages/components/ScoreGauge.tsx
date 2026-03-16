import React from 'react';

interface Props {
  score: number;
}

export function ScoreGauge({ score }: Props) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--medium)' : 'var(--critical)';
  const label = score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="var(--font)">
          {score}
        </text>
        <text x="60" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="12" fontFamily="var(--font)">
          {label}
        </text>
      </svg>
    </div>
  );
}
