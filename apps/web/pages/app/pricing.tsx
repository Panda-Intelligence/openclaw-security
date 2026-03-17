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
    <div className="page-narrow">
      <div className="page-header" style={{ margin: '2rem 0 2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem' }}>Pricing</h1>
        <p>Choose the scan depth, quotas, and workflow speed that fit your deployment cadence.</p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.tier} className={`pricing-card fade-up${plan.highlighted ? ' pricing-card--highlighted' : ''}`}>
            {plan.highlighted && <span className="pricing-badge">Recommended</span>}
            <h2>{plan.name}</h2>
            <div className="pricing-price">{plan.price}</div>
            <ul className="pricing-list">
              {plan.features.map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout(plan.tier)}
              className={plan.highlighted ? 'button-primary' : 'button-secondary'}
              style={{ width: '100%' }}
            >
              {plan.tier === 'free' ? 'Get started' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
