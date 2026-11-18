/** Tiny inline markup: **bold**, *em*, `code`, [label](/route or https://...). No HTML injection. */
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export function rich(text: string): ReactNode[] {
  const parts = text.split(TOKEN);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
    if (m) {
      return m[2].startsWith('/') ? <Link key={i} to={m[2]}>{m[1]}</Link> : <a key={i} href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Rich({ text }: { text: string }) {
  return <>{rich(text)}</>;
}

/** Extract internal links for link checking. */
export function internalLinks(text: string): string[] {
  return [...text.matchAll(/\[[^\]]+\]\((\/[^)]+)\)/g)].map((m) => m[1]);
}
