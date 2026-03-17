# OpenClaw Release & Dependency Security Watch

Every version bump changes the shape of an **OpenClaw security audit**. Operators should review release notes, package provenance, install instructions, and runtime dependencies together instead of treating them as separate tasks.

## Release review workflow

- Confirm the exact version you plan to deploy.
- Read release notes for auth, storage, routing, and provider changes.
- Check whether the release is signed or otherwise provenance-verified.
- Re-run your dependency and install safety checklist before promotion.

## Dependency risk areas

### Native build dependencies

Packages that require build approval deserve more scrutiny because they widen the install-time trust boundary.

### Plugin and skill ecosystems

Even when package scripts are restricted, runtime code still needs review. A dependency can be safe to install but risky to execute with broad tool access.

### Transport and provider changes

A release that changes model transport or provider synchronization can affect logging, fallback behavior, and token exposure.

## Public reporting goal

Our intelligence board turns release and dependency review into a standing public signal so operators can see which versions deserve extra attention before rollout.
