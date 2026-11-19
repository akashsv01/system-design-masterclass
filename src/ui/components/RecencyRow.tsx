/** A cache's recency order as fixed slots: items slide between slots; an evicted item fades out of the last one. */
import { useState } from 'react';

export function RecencyRow({ order, values, moved, evicted, inserted, capacity = 3 }: { order: string[]; values: Record<string, string>; moved?: string; evicted?: string; inserted?: string; capacity?: number }) {
  const [width, setWidth] = useState(0);
  const slotW = 100 / capacity;
  const all = evicted ? [...order, evicted] : order;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
        <span>← most recently used</span>
        <span>least recently used →</span>
      </div>
      <div ref={(el) => el && el.clientWidth !== width && setWidth(el.clientWidth)} style={{ position: 'relative', height: 104 }} role="list" aria-label={`Cache from most to least recently used: ${order.join(', ') || 'empty'}`}>
        {Array.from({ length: capacity }, (_, i) => (
          <div key={`slot-${i}`} aria-hidden="true" style={{ position: 'absolute', left: `calc(${i * slotW}% + 6px)`, width: `calc(${slotW}% - 12px)`, top: 0, height: 96, border: '1.5px dashed var(--line)', borderRadius: 12 }} />
        ))}
        {all.map((k) => {
          const i = order.indexOf(k);
          const gone = k === evicted;
          const tone = gone ? 'fail' : k === moved || k === inserted ? 'active' : i === order.length - 1 && order.length === capacity ? 'warn' : '';
          return (
            <div
              key={k}
              role="listitem"
              style={{
                position: 'absolute', top: 0, height: 96,
                left: `calc(${(gone ? capacity - 0.3 : i) * slotW}% + 6px)`,
                width: `calc(${slotW}% - 12px)`,
                opacity: gone ? 0 : 1,
                transition: 'left .6s cubic-bezier(.45,0,.25,1), opacity .6s',
                background: tone === 'active' ? 'var(--active-soft)' : 'var(--surface)',
                border: `2px solid ${tone === 'active' ? 'var(--active)' : tone === 'fail' ? 'var(--fail)' : 'var(--line-strong)'}`,
                borderRadius: 12, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)' }}>{k}</span>
              <span className="muted" style={{ fontSize: 14 }}>{values[k] ?? ''}</span>
              {tone === 'warn' && <span style={{ fontSize: 12, color: 'var(--fail)' }}>next to go</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
