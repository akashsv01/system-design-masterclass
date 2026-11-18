import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CURRICULUM, MODULES, piecesFor } from '../../content/curriculum';

const LABEL: Record<string, string> = { planned: 'Planned', partial: 'In progress', implemented: 'Implemented', verified: 'Verified', reviewed: 'Reviewed' };

export default function Coverage() {
  useEffect(() => { document.title = 'Course coverage · System Design Masterclass'; }, []);
  const counts: Record<string, number> = {};
  for (const t of CURRICULUM) counts[t.status] = (counts[t.status] ?? 0) + 1;
  return (
    <div className="page">
      <h1 style={{ marginTop: 0 }}>How complete is this course?</h1>
      <div className="reading">
        <p>Every topic’s status is computed from what actually exists. Nobody types it in by hand.</p>
        <ul>
          <li><strong>Implemented</strong>: an explanation, an inspectable worked example, an exercise, and objective checks.</li>
          <li><strong>Verified</strong>: implemented, and automatically rendered at desktop and phone sizes with no errors, readable labels and reachable controls.</li>
          <li><strong>Reviewed</strong>: checked by an independent human editor. <em>Automation never sets this.</em></li>
        </ul>
        <p className="notice">
          {CURRICULUM.length} topics: {['reviewed', 'verified', 'implemented', 'partial', 'planned'].filter((s) => counts[s]).map((s) => `${counts[s]} ${LABEL[s].toLowerCase()}`).join(' · ')}.
          Sources are chapter-level pointers that haven’t yet been re-checked against the source text.
        </p>
      </div>
      {MODULES.map((m) => (
        <section key={m.id} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20 }}>{m.title}</h2>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Topic</th><th>Status</th><th>Format</th><th>Before this</th></tr></thead>
              <tbody>
                {CURRICULUM.filter((t) => t.module === m.id).map((t) => (
                  <tr key={t.id}>
                    <td><Link to={t.route}>{t.short ?? t.title}</Link></td>
                    <td><span className={`pill ${t.status === 'verified' || t.status === 'reviewed' ? 'ok' : t.status === 'implemented' ? 'active' : ''}`}>{LABEL[t.status]}</span></td>
                    <td className="muted">{piecesFor(t.id).format}</td>
                    <td className="muted" style={{ fontSize: 14 }}>{t.prereqs.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
