# Contributing

Thanks for your interest in contributing to OpenClaw Security!

## Getting started

```bash
git clone https://github.com/Panda-Intelligence/openclaw-security.git
cd openclaw-security
bun install
bun test
```

## Development workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure all tests pass: `bun test`
4. Ensure type checking passes: `bunx tsc --noEmit -p <package>/tsconfig.json`
5. Open a pull request

## Adding a new check

Checks live in `packages/scanner-core/src/checks/passive/` or `packages/scanner-core/src/checks/active/`.

1. Create a new file exporting a `CheckDefinition`:

```typescript
import type { CheckDefinition, CheckResult, Finding } from '../../types';

const check: CheckDefinition = {
  id: 'my-new-check',
  name: 'My New Check',
  description: 'What this check does',
  mode: 'passive',  // or 'active'
  category: 'headers',  // auth | headers | exposure | config | data | infrastructure
  dependsOn: [],  // optional: check IDs that must run first
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    // ... your check logic ...
    return {
      checkId: 'my-new-check',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
```

2. Register it in `packages/scanner-core/src/checks/index.ts`
3. Add tests in `packages/scanner-core/tests/`

## Code style

- TypeScript strict mode with `noUncheckedIndexedAccess`
- No `.js` extensions in imports (bun bundler resolution)
- Prefer `type` imports where possible
- No `any` in source code (tests are acceptable)

## Commit messages

Use conventional commits:

```
feat: add new check for X
fix: handle edge case in Y
test: add tests for Z
docs: update README
```

## Reporting bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, bun version)
