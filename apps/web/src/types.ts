// ── Plan tiers ──

export type PlanTier = 'free' | 'starter';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

export const PLAN_LIMITS: Record<PlanTier, {
  maxScansPerDayPerProject: number;
  maxProjects: number;
  price: number; // monthly USD cents
}> = {
  free: { maxScansPerDayPerProject: 2, maxProjects: 3, price: 0 },
  starter: { maxScansPerDayPerProject: 3, maxProjects: 10, price: 900 },
};

// ── User ──

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  createdAt: string;
}

// ── Subscription ──

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

// ── Project ──

export interface Project {
  id: string;
  userId: string;
  name: string;
  targetUrl: string;
  createdAt: string;
}

// ── Auth ──

export interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
}

// ── Billing ──

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  price: number;
  maxScansPerDayPerProject: number;
  maxProjects: number;
}

export function getPlans(): PlanInfo[] {
  return [
    { tier: 'free', name: 'Free', ...PLAN_LIMITS.free },
    { tier: 'starter', name: 'Starter', ...PLAN_LIMITS.starter },
  ];
}

// ── Community stats ──

export interface CommunityStats {
  totalReports: number;
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  severityBreakdown: Record<string, number>;
  topIssues: { checkId: string; count: number }[];
  trend: { date: string; avgScore: number; count: number }[];
}
