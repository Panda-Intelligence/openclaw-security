import { describe, test, expect } from 'bun:test';
import { lookupVersion, getCvesForVersion, isEol, isOutdated, getLatestVersion } from '../src/version-db.js';

describe('version-db', () => {
  test('getLatestVersion returns a version string', () => {
    const latest = getLatestVersion();
    expect(latest).toBeTruthy();
    expect(latest).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('lookupVersion finds known version', () => {
    const entry = lookupVersion('0.1.0');
    expect(entry).toBeTruthy();
    expect(entry!.version).toBe('0.1.0');
    expect(entry!.releaseDate).toBeTruthy();
  });

  test('lookupVersion returns undefined for unknown', () => {
    expect(lookupVersion('99.99.99')).toBeUndefined();
  });

  test('getCvesForVersion returns CVEs for vulnerable version', () => {
    const cves = getCvesForVersion('0.1.0');
    expect(cves.length).toBeGreaterThan(0);
    expect(cves[0].id).toMatch(/^OCLAW-/);
    expect(cves[0].severity).toBeTruthy();
  });

  test('getCvesForVersion returns empty for clean version', () => {
    const cves = getCvesForVersion('0.3.0');
    expect(cves).toHaveLength(0);
  });

  test('getCvesForVersion returns empty for unknown version', () => {
    expect(getCvesForVersion('99.99.99')).toHaveLength(0);
  });

  test('isEol for deprecated version', () => {
    expect(isEol('0.1.0')).toBe(true);
  });

  test('isEol for current version', () => {
    expect(isEol('0.3.0')).toBe(false);
  });

  test('isEol for unknown version', () => {
    expect(isEol('99.0.0')).toBe(false);
  });

  test('isOutdated for old version', () => {
    expect(isOutdated('0.1.0')).toBe(true);
  });

  test('isOutdated for latest version', () => {
    const latest = getLatestVersion();
    expect(isOutdated(latest)).toBe(false);
  });
});
