import { useEffect, useRef, useState } from 'react';

/** Read-only code listing with optional highlighted lines (1-based). */
export function CodeBlock({
  code,
  lang,
  highlight = [],
  caption,
  scrollToHighlight,
  maxHeight,
}: {
  code: string;
  lang: string;
  highlight?: number[];
  caption?: string;
  scrollToHighlight?: boolean;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const lines = code.replace(/\n$/, '').split('\n');
  const hl = new Set(highlight);
  const key = highlight.join(',');
  useEffect(() => {
    if (!scrollToHighlight || !ref.current || !highlight.length) return;
    const el = ref.current.querySelector<HTMLElement>(`[data-line="${highlight[0]}"]`);
    if (el) ref.current.scrollTo({ top: Math.max(0, el.offsetTop - 60), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scrollToHighlight]);
  const [copied, setCopied] = useState(false);
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <pre ref={ref} className="code" data-lang={lang} style={{ maxHeight, overflow: 'auto', position: 'relative' }} tabIndex={0} aria-label={caption ?? `${lang} code`}>
        <code>
          {lines.map((l, i) => (
            <span key={i} data-line={i + 1} className={hl.has(i + 1) ? 'hl' : undefined}>
              {l || ' '}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
      <figcaption className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{caption}</span>
        <button className="btn btn-quiet btn-small" style={{ minHeight: 24, padding: '0 6px', fontSize: 13 }} onClick={() => { navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
    </figure>
  );
}
