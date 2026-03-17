# Marketplace Skills Security for OpenClaw

OpenClaw skills are a major productivity multiplier, but they also expand the audit surface. A useful **OpenClaw security audit** should look at more than whether a skill exists — it should ask how the skill was sourced, how it is loaded, and what local overrides can change its behavior.

## What matters most

- **Public registry trust**: public skills improve discoverability, but they also create a review bottleneck for operators.
- **Workspace precedence**: a local workspace skill can override managed or bundled copies.
- **Scripts and setup steps**: a skill is not just text; it can pull in scripts, templates, and operational instructions.

## Audit checks to prioritize

1. Inventory every installed skill and group them by source.
2. Flag local overrides that shadow managed or bundled skills.
3. Review setup instructions for shell execution, credential handling, and destructive commands.
4. Re-check permissions when a skill version changes.

## Why this belongs in a public board

Marketplace security is an ecosystem problem. If one deployment finds a risky skill pattern, others benefit from seeing the signal quickly. That is why our public intelligence board tracks marketplace-skill risk as a first-class **OpenClaw audit** category.
