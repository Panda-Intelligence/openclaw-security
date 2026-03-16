import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const DANGEROUS_MODELS = ['gpt-4', 'claude-3-opus'];
const DEFAULT_PROMPT_PATTERNS = [
  /you are a helpful assistant/i,
  /you are an ai/i,
  /default system prompt/i,
];

const check: CheckDefinition = {
  id: 'agent-config-review',
  name: 'Agent Configuration Review',
  description: 'Reviews agent configurations for security issues: exposed models, default prompts, failed agents',
  mode: 'active',
  category: 'config',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const agents = ctx.activeData?.agents ?? [];

    if (agents.length === 0) {
      return { checkId: 'agent-config-review', status: 'skipped', findings: [], durationMs: 0 };
    }

    for (const agent of agents) {
      // Check for failed agents
      if (agent.status === 'failed' || agent.status === 'error') {
        findings.push({
          checkId: 'agent-config-review',
          title: `Agent in error state: ${agent.name}`,
          description: `Agent "${agent.name}" (${agent.slug}) is in "${agent.status}" state`,
          severity: 'medium',
          evidence: `Agent ${agent.id}: status=${agent.status}`,
          recommendation: 'Investigate and fix or remove failed agents to prevent information leakage',
        });
      }

      // Check for expensive model exposure
      if (agent.model && DANGEROUS_MODELS.some((m) => agent.model!.includes(m))) {
        findings.push({
          checkId: 'agent-config-review',
          title: `High-cost model exposed: ${agent.model}`,
          description: `Agent "${agent.name}" uses ${agent.model} — if compromised, could incur significant costs`,
          severity: 'medium',
          evidence: `Agent ${agent.name}: model=${agent.model}`,
          recommendation: 'Ensure rate limiting and quota controls are in place for expensive models',
        });
      }

      // Check for default/weak system prompts
      if (agent.systemPrompt) {
        for (const pattern of DEFAULT_PROMPT_PATTERNS) {
          if (pattern.test(agent.systemPrompt)) {
            findings.push({
              checkId: 'agent-config-review',
              title: `Default system prompt detected: ${agent.name}`,
              description: 'Agent appears to use a default or minimal system prompt, which may lack safety instructions',
              severity: 'low',
              evidence: `System prompt matches pattern: ${pattern.source}`,
              recommendation: 'Configure a specific system prompt with appropriate safety guardrails',
            });
            break;
          }
        }

        // Check for system prompt leaking sensitive info
        if (/api[_-]?key|password|secret|token/i.test(agent.systemPrompt)) {
          findings.push({
            checkId: 'agent-config-review',
            title: `Sensitive info in system prompt: ${agent.name}`,
            description: 'Agent system prompt appears to contain secrets or API keys',
            severity: 'high',
            evidence: 'System prompt contains sensitive keywords',
            recommendation: 'Remove secrets from system prompts. Use environment variables instead.',
            cweId: 'CWE-798',
          });
        }
      }
    }

    return {
      checkId: 'agent-config-review',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
