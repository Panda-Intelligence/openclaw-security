import { useEffect, useState } from 'react';
import { blogPosts } from './meta';

const postModules = import.meta.glob('./posts/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function getPostContent(slug: string): string | null {
  const key = `./posts/${slug}.md`;
  return (postModules[key] as string) ?? null;
}

const categoryColors: Record<string, string> = {
  announcement: '#6366f1',
  guide: '#22c55e',
  research: '#f97316',
};

function getSlugFromPath(): string | null {
  const match = window.location.pathname.match(/^\/blog\/([^/]+)$/);
  return match?.[1] ?? null;
}

function applyBlogSeo(post: (typeof blogPosts)[number] | null): void {
  const title = post ? `${post.title} · OpenClaw Security Audit` : 'Blog · OpenClaw Security Audit';
  const description = post
    ? `${post.subtitle} Focused on OpenClaw security, audit workflows, marketplace skills, dependencies, and LLM runtime safety.`
    : 'Research, guides, and operator notes focused on OpenClaw security, audit workflows, and AI runtime risks.';

  document.title = title;
  const set = (selector: string, attr: 'content' | 'href', value: string) => {
    const node = document.head.querySelector(selector);
    if (node) node.setAttribute(attr, value);
  };
  set('meta[name="description"]', 'content', description);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[name="twitter:title"]', 'content', title);
  set('meta[name="twitter:description"]', 'content', description);
  set('link[rel="canonical"]', 'href', window.location.href);

  const scriptId = 'blog-structured-data';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description,
          datePublished: post.date,
          keywords: ['openclaw security', 'openclaw audit', post.category],
          url: window.location.href,
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'OpenClaw Security Audit Blog',
          description,
          url: window.location.href,
        },
  );
}

export default function BlogPage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(getSlugFromPath());
  const selectedPost = selectedSlug ? blogPosts.find((p) => p.slug === selectedSlug) : null;
  const content = selectedSlug ? getPostContent(selectedSlug) : null;

  useEffect(() => {
    applyBlogSeo(selectedPost ?? null);
    const sync = () => {
      const slug = getSlugFromPath();
      setSelectedSlug(slug);
      const post = slug ? blogPosts.find((p) => p.slug === slug) ?? null : null;
      applyBlogSeo(post);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [selectedPost]);

  const openPost = (slug: string) => {
    window.history.pushState({}, '', `/blog/${slug}`);
    setSelectedSlug(slug);
    const post = blogPosts.find((entry) => entry.slug === slug) ?? null;
    applyBlogSeo(post);
  };

  const closePost = () => {
    window.history.pushState({}, '', '/blog');
    setSelectedSlug(null);
    applyBlogSeo(null);
  };

  if (selectedPost && content) {
    return (
      <div className="page-narrow">
        <button
          type="button"
          onClick={closePost}
          className="button-ghost"
          style={{ marginBottom: '1.5rem' }}
        >
          &larr; Back to blog
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {selectedPost.date} &middot; {selectedPost.readingMinutes} min read &middot;{' '}
          <span style={{ color: categoryColors[selectedPost.category] }}>{selectedPost.category}</span>
        </p>
        <article
          className="blog-prose fade-up"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: content is HTML-escaped before markdown conversion
          dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
        />
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <div className="page-header">
        <h1 style={{ fontSize: '2.8rem' }}>Blog</h1>
        <p>Security insights for AI agent infrastructure</p>
      </div>

      <div className="blog-list">
        {blogPosts.map((post) => (
          <article
            key={post.slug}
            onClick={() => openPost(post.slug)}
            className="blog-card fade-up"
          >
            <div className="blog-meta">
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: categoryColors[post.category], textTransform: 'uppercase' }}>
                {post.category}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{post.date}</span>
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>{post.title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{post.subtitle}</p>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{post.readingMinutes} min read</span>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Escape HTML entities to prevent XSS */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal markdown → HTML (headings, paragraphs, code blocks, bold, links, lists) */
function markdownToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg);padding:1rem;border-radius:6px;overflow-x:auto;font-size:0.85rem"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:0.15rem 0.4rem;border-radius:3px;font-size:0.85rem">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent)">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul style="margin:0.5rem 0;padding-left:1.5rem">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p style="margin:0.75rem 0">')
    .replace(/^(?!<)(.+)$/gm, '<p style="margin:0.75rem 0">$1</p>')
    .replace(/<p style="margin:0.75rem 0"><(h[123]|pre|ul|li|ol)/g, '<$1')
    .replace(/<\/(h[123]|pre|ul|ol)><\/p>/g, '</$1>');
}
