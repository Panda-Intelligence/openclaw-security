import type { CheckDefinition, CheckResult, Finding } from '../../types.js';

const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, name: 'Instruction override' },
  { pattern: /you\s+are\s+now\s+/i, name: 'Role hijack' },
  { pattern: /system\s*:\s*/i, name: 'System prompt injection' },
  { pattern: /\[INST\]/i, name: 'Instruction tag injection' },
  { pattern: /<\|im_start\|>/i, name: 'Chat ML injection' },
  { pattern: /do\s+not\s+follow\s+(your\s+)?instructions/i, name: 'Instruction negation' },
  { pattern: /reveal\s+(your\s+)?(system\s+)?prompt/i, name: 'Prompt extraction' },
  { pattern: /forget\s+(everything|all)/i, name: 'Memory wipe attempt' },
  { pattern: /repeat\s+(your\s+)?(system\s+)?(prompt|instructions)/i, name: 'Prompt leak' },
  { pattern: /act\s+as\s+(if\s+)?you\s+(are|were)\s/i, name: 'Persona override' },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, name: 'Pretend directive' },
  { pattern: /```\s*(system|admin|root)/i, name: 'Code block privilege escalation' },
];

const check: CheckDefinition = {
  id: 'memory-injection-scan',
  name: 'Memory Injection Scan',
  description: 'Scans stored memories for prompt injection patterns that could compromise agent behavior',
  mode: 'active',
  category: 'data',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const memories = ctx.activeData?.memories ?? [];

    if (memories.length === 0) {
      return { checkId: 'memory-injection-scan', status: 'skipped', findings: [], durationMs: 0 };
    }

    for (const memory of memories) {
      for (const { pattern, name } of INJECTION_PATTERNS) {
        if (pattern.test(memory.content)) {
          findings.push({
            checkId: 'memory-injection-scan',
            title: `Prompt injection detected in memory: ${name}`,
            description: `Memory entry (agent: ${memory.agentId}) contains a "${name}" pattern that could manipulate agent behavior`,
            severity: 'critical',
            evidence: `Memory ${memory.id}: "${memory.content.substring(0, 100)}..."`,
            recommendation: 'Review and remove suspicious memory entries. Implement input sanitization.',
            cweId: 'CWE-94',
          });
          break; // One finding per memory entry is enough
        }
      }
    }

    // Summary finding
    if (findings.length > 0) {
      findings.push({
        checkId: 'memory-injection-scan',
        title: `${findings.length} potential injection(s) found in ${memories.length} memories`,
        description: 'Stored memories contain patterns commonly used in prompt injection attacks',
        severity: 'critical',
        evidence: `${findings.length} suspicious entries detected`,
        recommendation: 'Audit all stored memories and implement content filtering for incoming messages',
        cweId: 'CWE-94',
      });
    }

    return {
      checkId: 'memory-injection-scan',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
