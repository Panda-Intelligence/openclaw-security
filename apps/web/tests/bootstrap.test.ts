import { beforeEach, describe, expect, test } from 'bun:test';
import {
  APP_SCHEMA_VERSION,
  ensureAppSchema,
  resetSchemaBootstrapForTests,
  SchemaMigrationRequiredError,
} from '../src/state/bootstrap';

function makeDb(options: { hasUsersTable: boolean; schemaVersion?: string | null }) {
  const executed: string[] = [];

  return {
    prepare(sql: string) {
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => {
            executed.push(sql);
            return { success: true };
          },
        }),
        first: async () => {
          if (sql.includes(`sqlite_master`) && sql.includes(`name = 'users'`)) {
            return options.hasUsersTable ? { name: 'users' } : null;
          }
          if (sql.includes(`FROM app_meta WHERE key = 'schema_version'`)) {
            return options.schemaVersion ? { value: options.schemaVersion } : null;
          }
          return null;
        },
        run: async () => {
          executed.push(sql);
          return { success: true };
        },
      };
    },
    executed,
  };
}

describe('ensureAppSchema', () => {
  beforeEach(() => {
    resetSchemaBootstrapForTests();
  });

  test('bootstraps schema locally when users table is missing', async () => {
    const db = makeDb({ hasUsersTable: false });
    await ensureAppSchema(db as unknown as D1Database, { allowBootstrap: true });
    expect(db.executed.length).toBeGreaterThan(5);
    expect(db.executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
    expect(db.executed.some((sql) => sql.includes('INSERT INTO app_meta'))).toBe(true);
  });

  test('requires migration when users table is missing outside local bootstrap mode', async () => {
    const db = makeDb({ hasUsersTable: false });
    await expect(ensureAppSchema(db as unknown as D1Database)).rejects.toBeInstanceOf(SchemaMigrationRequiredError);
  });

  test('records schema version when legacy tables exist without app_meta', async () => {
    const db = makeDb({ hasUsersTable: true, schemaVersion: null });
    await ensureAppSchema(db as unknown as D1Database, { allowBootstrap: true });
    expect(db.executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS app_meta'))).toBe(true);
    expect(db.executed.some((sql) => sql.includes('INSERT INTO app_meta'))).toBe(true);
  });

  test('auto-migrates mismatched schema version in local bootstrap mode', async () => {
    const db = makeDb({ hasUsersTable: true, schemaVersion: '2025.01.01.1' });
    await ensureAppSchema(db as unknown as D1Database, { allowBootstrap: true });
    expect(db.executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
    expect(db.executed.some((sql) => sql.includes('INSERT INTO app_meta'))).toBe(true);
  });

  test('rejects mismatched schema version in production mode', async () => {
    const db = makeDb({ hasUsersTable: true, schemaVersion: '2025.01.01.1' });
    await expect(ensureAppSchema(db as unknown as D1Database)).rejects.toBeInstanceOf(
      SchemaMigrationRequiredError,
    );
  });

  test('accepts matching schema version', async () => {
    const db = makeDb({ hasUsersTable: true, schemaVersion: APP_SCHEMA_VERSION });
    await ensureAppSchema(db as unknown as D1Database, { allowBootstrap: true });
    expect(db.executed.some((sql) => sql.includes('INSERT INTO app_meta'))).toBe(false);
  });
});
