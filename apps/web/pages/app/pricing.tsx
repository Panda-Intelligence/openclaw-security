
import { createCheckout, isLoggedIn } from '../lib/api';

const plans = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    features: ['2 scans/day per project', 'Up to 3 projects', '14 passive checks', 'Community reports'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: '$9/mo',
    features: ['3 scans/day per project', 'Up to 10 projects', '20 checks (passive + active)', 'Priority queue', 'Export reports'],
    highlighted: true,
  },
];

export default function PricingPage() {
  const handleCheckout = async (tier: string) => {
    if (!isLoggedIn()) {
      window.location.href = '/auth/login';
      return;
    }
    if (tier === 'free') {
      window.location.href = '/app/dashboard';
      return;
    }
    const result = await createCheckout(tier);
    window.location.href = result.data.url;
  };

  return (
    <div style={{ maxWidth: 700, margin: '3rem auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Pricing</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Audit your OpenClaw deployments with confidence</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {plans.map((plan) => (
          <div
            key={plan.tier}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${plan.highlighted ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '2rem 1.5rem',
              position: 'relative',
            }}
          >
            {plan.highlighted && (
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 12px',
                  borderRadius: 12,
                }}
              >
                RECOMMENDED
              </span>
            )}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{plan.name}</h2>
            <p style={{ fontSize: '2rem', fontWeight: 700, margin: '0.75rem 0' }}>{plan.price}</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem', textAlign: 'left' }}>
              {plan.features.map((f) => (
                <li key={f} style={{ padding: '0.3rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout(plan.tier)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: plan.highlighted ? 'var(--accent)' : 'var(--bg)',
                color: plan.highlighted ? '#fff' : 'var(--text)',
                border: `1px solid ${plan.highlighted ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {plan.tier === 'free' ? 'Get Started' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
