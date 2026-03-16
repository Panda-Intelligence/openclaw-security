import type { CheckDefinition, CheckResult, Finding } from '../../types';

const REQUIRED_FIELDS: Record<string, string[]> = {
  telegram: ['botToken'],
  discord: ['botToken', 'applicationId'],
  slack: ['botToken', 'signingSecret'],
  whatsapp: ['accessToken', 'verifyToken', 'phoneNumberId'],
};

const check: CheckDefinition = {
  id: 'channel-credential-status',
  name: 'Channel Credential Status',
  description: 'Checks channel integrations for missing or invalid credentials',
  mode: 'active',
  category: 'config',
  run: async (ctx): Promise<CheckResult> => {
    const findings: Finding[] = [];
    const channels = ctx.activeData?.channels ?? [];

    if (channels.length === 0) {
      return { checkId: 'channel-credential-status', status: 'skipped', findings: [], durationMs: 0 };
    }

    for (const ch of channels) {
      // Check for unverified/inactive channels
      if (ch.status !== 'active' && ch.status !== 'verified') {
        findings.push({
          checkId: 'channel-credential-status',
          title: `Channel not active: ${ch.type} (${ch.id})`,
          description: `${ch.type} channel for agent ${ch.agentId} is in "${ch.status}" state`,
          severity: 'medium',
          evidence: `Channel ${ch.id}: type=${ch.type}, status=${ch.status}`,
          recommendation: 'Verify channel configuration or remove unused channels',
        });
      }

      // Check for missing required fields
      const required = REQUIRED_FIELDS[ch.type.toLowerCase()];
      if (required) {
        const missing = required.filter((field) => !ch.config[field]);
        if (missing.length > 0) {
          findings.push({
            checkId: 'channel-credential-status',
            title: `Missing credentials: ${ch.type} channel`,
            description: `${ch.type} channel is missing required fields: ${missing.join(', ')}`,
            severity: 'high',
            evidence: `Channel ${ch.id}: missing ${missing.join(', ')}`,
            recommendation: `Configure the missing fields: ${missing.join(', ')}`,
          });
        }
      }

      // Check for exposed credentials in config (shouldn't be stored as plaintext)
      for (const [key, value] of Object.entries(ch.config)) {
        if (typeof value === 'string' && value.length > 20 && /token|secret|key/i.test(key)) {
          // Credential is present — check if it looks like a placeholder
          if (/^(xxx|placeholder|changeme|your[_-])/i.test(value)) {
            findings.push({
              checkId: 'channel-credential-status',
              title: `Placeholder credential: ${ch.type}.${key}`,
              description: `${ch.type} channel has a placeholder value for ${key}`,
              severity: 'high',
              evidence: `${key} appears to be a placeholder`,
              recommendation: 'Replace placeholder credentials with actual values',
            });
          }
        }
      }
    }

    return {
      checkId: 'channel-credential-status',
      status: findings.length > 0 ? 'fail' : 'pass',
      findings,
      durationMs: 0,
    };
  },
};

export default check;
