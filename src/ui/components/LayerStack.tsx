/**
 * Interactive layered view (docs/LESSON_GUIDE.md §3). Shows a stack of layers in an
 * isometric 3D view that the learner can rotate and pull apart. A flat, fully labelled
 * list is always available, and it is the default under reduced motion.
 */
import { useEffect, useState } from 'react';

export interface Layer {
  id: string;
  label: string;
  /** Short content shown on the layer face, e.g. "GET /seats/F12". */
  detail?: string;
  tone?: 'plain' | 'active' | 'ok' | 'fail' | 'accent';
}

function prefersReduced() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function LayerStack({
  layers,
  separation = 0.6,
  focus,
  description,
  ghost = [],
}: {
  /** Top layer first. */
  layers: Layer[];
  /** 0 = stacked flush, 1 = fully pulled apart. The learner can change it. */
  separation?: number;
  focus?: string;
  description: string;
  /** Layer ids reserved but not shown yet (keeps positions stable as layers are revealed). */
  ghost?: string[];
}) {
  const [sep, setSep] = useState(separation);
  const [turn, setTurn] = useState(-35);
  const [flat, setFlat] = useState(prefersReduced);
  useEffect(() => setSep(separation), [separation]);

  const n = layers.length;
  const visible = layers.filter((l) => !ghost.includes(l.id));

  return (
    <div>
      {flat ? (
        <ol className="layer-flat" aria-label={description}>
          {visible.map((l) => (
            <li key={l.id} className={`layer-flat-item ${l.tone ?? ''} ${focus === l.id ? 'focus' : ''}`}>
              <strong>{l.label}</strong>
              {l.detail && <span className="mono">{l.detail}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <div className="layer-scene" role="img" aria-label={description}>
          <div className="layer-stack" style={{ transform: `rotateX(58deg) rotateZ(${turn}deg)` }}>
            {layers.map((l, i) => {
              const hidden = ghost.includes(l.id);
              const z = (n - 1 - i) * (16 + sep * 70);
              return (
                <div
                  key={l.id}
                  className={`layer-plate ${l.tone ?? ''} ${focus === l.id ? 'focus' : ''}`}
                  style={{ transform: `translateZ(${z}px)`, opacity: hidden ? 0 : 1 }}
                  aria-hidden="true"
                >
                  <span className="layer-label">{l.label}</span>
                  {l.detail && <span className="layer-detail">{l.detail}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="toolbar" style={{ justifyContent: 'center', marginTop: 8, marginBottom: 0 }}>
        {!flat && (
          <>
            <label className="range-row" style={{ fontSize: 14, flex: '0 1 260px' }}>
              <span>Pull apart</span>
              <input type="range" min={0} max={1} step={0.05} value={sep} onChange={(e) => setSep(Number(e.target.value))} />
            </label>
            <button className="btn btn-small" onClick={() => setTurn((t) => t - 20)} aria-label="Rotate left">⟲</button>
            <button className="btn btn-small" onClick={() => setTurn((t) => t + 20)} aria-label="Rotate right">⟳</button>
          </>
        )}
        <button className="btn btn-small btn-quiet" onClick={() => setFlat(!flat)}>{flat ? '3D view' : 'Flat view'}</button>
      </div>
    </div>
  );
}
