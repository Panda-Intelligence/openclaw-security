import { useState } from 'react';
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

export default function BlogPage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedPost = selectedSlug ? blogPosts.find((p) => p.slug === selectedSlug) : null;
  const content = selectedSlug ? getPostContent(selectedSlug) : null;

  if (selectedPost && content) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => setSelectedSlug(null)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem' }}
        >
          &larr; Back to blog
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {selectedPost.date} &middot; {selectedPost.readingMinutes} min read &middot;{' '}
          <span style={{ color: categoryColors[selectedPost.category] }}>{selectedPost.category}</span>
        </p>
        <article
          style={{ lineHeight: 1.7, color: 'var(--text)' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: content is HTML-escaped before markdown conversion
          dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Blog</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Security insights for AI agent infrastructure</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {blogPosts.map((post) => (
          <article
            key={post.slug}
            onClick={() => setSelectedSlug(post.slug)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
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
