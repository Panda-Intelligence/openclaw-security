export interface BlogPost {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  category: 'announcement' | 'guide' | 'research';
  readingMinutes: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'welcome',
    title: 'Introducing OpenClaw Security',
    subtitle: 'Automated security auditing for AI agent deployments',
    date: '2026-03-16',
    category: 'announcement',
    readingMinutes: 3,
  },
  {
    slug: 'top-10-misconfigurations',
    title: 'Top 10 OpenClaw Misconfigurations',
    subtitle: 'The most common security issues we find in production deployments',
    date: '2026-03-16',
    category: 'research',
    readingMinutes: 8,
  },
  {
    slug: 'cors-deep-dive',
    title: 'CORS Security for AI Agent APIs',
    subtitle: 'Why permissive CORS is especially dangerous for agent infrastructure',
    date: '2026-03-16',
    category: 'guide',
    readingMinutes: 6,
  },
  {
    slug: 'marketplace-skills-security',
    title: 'Marketplace Skills Security for OpenClaw',
    subtitle: 'How to audit public skills, local overrides, and execution trust boundaries',
    date: '2026-03-17',
    category: 'research',
    readingMinutes: 7,
  },
  {
    slug: 'openclaw-release-dependency-watch',
    title: 'OpenClaw Release & Dependency Security Watch',
    subtitle: 'What operators should review on every version bump and package install',
    date: '2026-03-17',
    category: 'research',
    readingMinutes: 7,
  },
  {
    slug: 'llm-runtime-security-checklist',
    title: 'LLM Runtime Security Checklist for OpenClaw',
    subtitle: 'Prompt leakage, tool overreach, and provider drift in real agent deployments',
    date: '2026-03-17',
    category: 'guide',
    readingMinutes: 6,
  },
];
