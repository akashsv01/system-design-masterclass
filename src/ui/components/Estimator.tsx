/** Back-of-the-envelope estimator (used by the capstone). */

export interface Estimates { dau: number; perUser: number; peak: number; bytes: number }

export function Estimator({ value, onChange }: { value: Estimates; onChange: (v: Estimates) => void }) {
  const avg = (value.dau * value.perUser) / 86400;
  const peak = avg * value.peak;
  const storageDay = value.dau * value.perUser * value.bytes;
  const field = (k: keyof typeof value, label: string, unit: string) => (
    <label className="field" style={{ marginBottom: 8 }}>
      <span>{label} <span className="muted">({unit})</span></span>
      <input type="number" min={0} value={value[k]} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) || 0 })} />
    </label>
  );
  const human = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
  return (
    <div className="grid-2">
      <div>
        {field('dau', 'Daily active users', 'people')}
        {field('perUser', 'Requests per user per day', 'requests')}
        {field('peak', 'Peak ÷ average', '×')}
        {field('bytes', 'Bytes stored per request', 'bytes')}
      </div>
      <div className="notice" aria-live="polite">
        <p style={{ margin: '0 0 6px' }}>Average: <strong>{Math.round(avg).toLocaleString()} req/s</strong> <span className="muted">= {value.dau.toLocaleString()} × {value.perUser} ÷ 86,400</span></p>
        <p style={{ margin: '0 0 6px' }}>Peak: <strong>{Math.round(peak).toLocaleString()} req/s</strong></p>
        <p style={{ margin: '0 0 6px' }}>Storage: <strong>{human(storageDay)}/day</strong>, {human(storageDay * 365)}/year</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>State these assumptions out loud; the interviewer cares about the reasoning more than the exact number.</p>
      </div>
    </div>
  );
}
