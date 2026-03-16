import { describe, test, expect } from 'bun:test';
import { PLAN_LIMITS, getPlans } from '../src/types';
import type { PlanTier } from '../src/types';

describe('Plan Limits', () => {
  test('free plan has correct limits', () => {
    expect(PLAN_LIMITS.free.maxScansPerDayPerProject).toBe(2);
    expect(PLAN_LIMITS.free.maxProjects).toBe(3);
    expect(PLAN_LIMITS.free.price).toBe(0);
  });

  test('starter plan has correct limits', () => {
    expect(PLAN_LIMITS.starter.maxScansPerDayPerProject).toBe(3);
    expect(PLAN_LIMITS.starter.maxProjects).toBe(10);
    expect(PLAN_LIMITS.starter.price).toBe(900);
  });

  test('getPlans returns all plans', () => {
    const plans = getPlans();
    expect(plans).toHaveLength(2);
    expect(plans[0]!.tier).toBe('free');
    expect(plans[1]!.tier).toBe('starter');
  });

  test('starter allows more scans than free', () => {
    expect(PLAN_LIMITS.starter.maxScansPerDayPerProject).toBeGreaterThan(PLAN_LIMITS.free.maxScansPerDayPerProject);
  });

  test('starter allows more projects than free', () => {
    expect(PLAN_LIMITS.starter.maxProjects).toBeGreaterThan(PLAN_LIMITS.free.maxProjects);
  });
});

describe('Quota enforcement logic', () => {
  test('free plan rejects 3rd scan on same project', () => {
    const plan: PlanTier = 'free';
    const limits = PLAN_LIMITS[plan];
    const todayCount = 2;
    const allowed = todayCount < limits.maxScansPerDayPerProject;
    expect(allowed).toBe(false);
  });

  test('free plan allows 2nd scan on same project', () => {
    const plan: PlanTier = 'free';
    const limits = PLAN_LIMITS[plan];
    const todayCount = 1;
    const allowed = todayCount < limits.maxScansPerDayPerProject;
    expect(allowed).toBe(true);
  });

  test('starter plan allows 3rd scan on same project', () => {
    const plan: PlanTier = 'starter';
    const limits = PLAN_LIMITS[plan];
    const todayCount = 2;
    const allowed = todayCount < limits.maxScansPerDayPerProject;
    expect(allowed).toBe(true);
  });

  test('starter plan rejects 4th scan on same project', () => {
    const plan: PlanTier = 'starter';
    const limits = PLAN_LIMITS[plan];
    const todayCount = 3;
    const allowed = todayCount < limits.maxScansPerDayPerProject;
    expect(allowed).toBe(false);
  });

  test('free plan rejects 4th project', () => {
    const plan: PlanTier = 'free';
    const limits = PLAN_LIMITS[plan];
    const currentCount = 3;
    const allowed = currentCount < limits.maxProjects;
    expect(allowed).toBe(false);
  });

  test('starter plan allows up to 10 projects', () => {
    const plan: PlanTier = 'starter';
    const limits = PLAN_LIMITS[plan];
    expect(9 < limits.maxProjects).toBe(true);
    expect(10 < limits.maxProjects).toBe(false);
  });
});
