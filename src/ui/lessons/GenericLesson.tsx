/**
 * Generic stepped lesson reader. Each lesson chooses its visual format (diagram, timeline,
 * chart, comparison, layer stack) while navigation, captions and activities stay consistent.
 * See docs/LESSON_GUIDE.md.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GENERIC_LESSONS } from '../../content/lessons';
import type { Block, Check, GenericLesson as GL, LessonStep, StepView } from '../../content/lessonTypes';
import { topicById, MODULES } from '../../content/curriculum';
import { Diagram, type DNode, type DEdge } from '../components/Diagram';
import { Timeline, Chart, Compare } from '../components/Visuals';
import { LayerStack } from '../components/LayerStack';
import { Caption, Controls, LessonShell, More, NextLesson, Question, Sources, useReplay, useStep } from '../components/Lesson';
import { EvidenceScope, LinePick, ShortAnswer, Snippet, useOutcome, useRoundKey } from '../components/Exercise';
import { RevisionBanner } from '../components/Revision';
import { CodeBlock } from '../components/Code';
import { Rich } from '../components/Rich';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { Icon } from '../components/Icon';

export default function GenericLesson({ id }: { id: string }) {
  const lesson = GENERIC_LESSONS[id];
  const topic = topicById(id)!;
  const { store } = useProgress();
  const [replayKey, replay] = useReplay();
  const count = lesson.steps.length + 1; // last step: practice
  const practiceStep = lesson.steps.length;
  const [answers, setAnswers] = useState(0);
  // Steps with a prediction must be answered before moving on: Next, → and the step list all stop there.
  const predictKeys = lesson.steps.map((s) => (s.predict ? `quiz:${id}:${s.predict.id}` : null));
  const firstUnanswered = predictKeys.findIndex((k) => k !== null && !store.get<{ attempts: unknown[] }>(k)?.attempts?.length);
  void answers;
  const { step, next, back, go, reachable } = useStep(id, count, { onReplay: replay, reachable: firstUnanswered >= 0 ? firstUnanswered : undefined });
  const cur = lesson.steps[step] as LessonStep | undefined;
  const predictAnswered = step < reachable || !cur?.predict;

  useEffect(() => {
    if (step === practiceStep) raiseStatus(store, id, 'studied');
  }, [step, practiceStep, store, id]);

  const module = MODULES.find((m) => m.id === topic.module);

  return (
    <LessonShell
      id={id}
      crumbs={<><Link to={`/topics#${topic.module}`}>{module?.title ?? lesson.area}</Link><span className="sep">/</span>{topic.short ?? topic.title}</>}
      title={topic.title}
      opening={<Rich text={lesson.opening} />}
    >
      {step < practiceStep && cur && (
        <>
          <StepStage lesson={lesson} step={step} replayKey={replayKey} />
          <Caption key={step} kicker={cur.kicker} title={cur.title} changes={cur.changes?.map((c) => ({ kind: c.kind, text: <Rich text={c.text} />, from: c.from, to: c.to }))}>
            {cur.body.map((p, i) => <p key={i}><Rich text={p} /></p>)}
            {cur.callout && (
              <div className={`callout ${cur.callout.tone === 'warn' ? 'warn' : ''}`}>
                <strong>{cur.callout.title}</strong>
                <Rich text={cur.callout.text} />
              </div>
            )}
          </Caption>
          {cur.code && (
            <details className="more" open={cur.code.open} key={`code-${step}`}>
              <summary>See it in Python</summary>
              <div className="more-body" style={{ paddingLeft: 0 }}>
                <Snippet code={cur.code.code} highlight={cur.code.highlight} caption={cur.code.caption} />
              </div>
            </details>
          )}
          {cur.predict && (
            <Question
              key={cur.predict.id}
              required={step >= reachable}
              isPrediction={!cur.predict.correct}
              recordKey={`${id}:${cur.predict.id}`}
              prompt={<Rich text={cur.predict.prompt} />}
              choices={cur.predict.choices.map((c) => ({ id: c.id, text: <Rich text={c.text} /> }))}
              correct={cur.predict.correct}
              onAnswered={() => setAnswers((x) => x + 1)}
              explain={(p) => <p><Rich text={cur.predict!.choices.find((c) => c.id === p)?.why ?? ''} /></p>}
            />
          )}
        </>
      )}

      {step === practiceStep && <Practice lesson={lesson} />}

      <Controls
        step={step}
        count={count}
        onBack={back}
        onNext={next}
        onReplay={step < practiceStep ? replay : undefined}
        nextLabel={step + 1 < practiceStep ? lesson.steps[step + 1].title : step + 1 === practiceStep ? 'Check yourself' : undefined}
        nextDisabled={!predictAnswered}
        nextHint={!predictAnswered ? 'Answer the question above to continue' : undefined}
        steps={[...lesson.steps.map((x) => x.title), 'Check yourself']}
        reachable={reachable}
        onJump={go}
      />

      <More summary={`Worked example: ${lesson.worked.title}`}>
        <Blocks blocks={lesson.worked.blocks} />
      </More>
      {lesson.deeper && lesson.deeper.length > 0 && (
        <More summary="Go deeper">
          <Blocks blocks={lesson.deeper} />
        </More>
      )}
      {step === practiceStep && lesson.next && topicById(lesson.next.id) && (
        <NextLesson to={topicById(lesson.next.id)!.route} title={topicById(lesson.next.id)!.title} reason={<Rich text={lesson.next.reason} />} />
      )}
      <Sources sources={topic.sources} />
    </LessonShell>
  );
}

function applyView(spec: { nodes: DNode[]; edges: DEdge[] }, v: StepView = {}) {
  const nodes = spec.nodes.map((n) => ({
    ...n,
    state: v.hide?.includes(n.id) ? ('ghost' as const) : v.dim?.includes(n.id) ? ('dim' as const) : v.states?.[n.id] ?? n.state,
    value: v.values?.[n.id] ?? n.value,
    sub: v.subs?.[n.id] ?? n.sub,
    tag: v.tags && n.id in v.tags ? v.tags[n.id] : n.tag,
  }));
  const edges = spec.edges.map((e) => ({ ...e, state: v.edgeStates?.[e.id] ?? e.state }));
  return { nodes, edges };
}

function StepStage({ lesson, step, replayKey }: { lesson: GL; step: number; replayKey: number }) {
  const s = lesson.steps[step];
  const exp = lesson.experiment && lesson.experiment.step === step ? lesson.experiment : undefined;
  const [val, setVal] = useRecord<number>(`sim:${lesson.id}`, exp?.initial ?? 0);
  const result = useMemo(() => (exp ? exp.compute(val) : null), [exp, val]);
  const v = lesson.visual;
  if (v.kind === 'none' && !exp) return null;

  let visual: React.ReactNode = null;
  if (v.kind === 'diagram') {
    const view = result?.diagram ?? s.view;
    const { nodes, edges } = applyView(v.spec, view);
    const tokens = (view?.tokens ?? []).map((t, i) => ({ ...t, id: `${step}-${i}-${replayKey}` }));
    visual = (
      <Diagram nodes={nodes} edges={edges} tokens={tokens} wide={v.spec.wide} narrow={v.spec.narrow} depth={v.spec.depth} description={s.alt ?? s.title} />
    );
  } else if (v.kind === 'timeline') {
    const tv = result?.timeline ?? s.timeline ?? { upTo: 0 };
    visual = <Timeline lanes={v.lanes} events={v.events} upTo={tv.upTo} focus={tv.focus} unit={v.unit} note={v.note} description={s.alt ?? s.title} />;
  } else if (v.kind === 'chart') {
    const cv = result?.chart ?? s.chart;
    visual = cv ? <Chart series={cv.series} marks={cv.marks} thresholds={cv.thresholds} xLabel={v.xLabel} yLabel={v.yLabel} kind={v.chartKind} yMax={v.yMax} yLog={v.yLog} categories={v.categories} note={v.note} description={s.alt ?? s.title} /> : null;
  } else if (v.kind === 'compare') {
    const c = result?.compare ?? s.compare;
    visual = c ? (
      <Compare
        focus={c.focus}
        left={{ title: c.left.title, verdict: c.left.verdict, tone: c.left.tone, body: <ul>{c.left.points.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul> }}
        right={{ title: c.right.title, verdict: c.right.verdict, tone: c.right.tone, body: <ul>{c.right.points.map((p, i) => <li key={i}><Rich text={p} /></li>)}</ul> }}
      />
    ) : null;
  } else if (v.kind === 'stack') {
    const sv = result?.stack ?? s.stack ?? {};
    const layers = v.layers.map((l) => ({ ...l, tone: sv.tones?.[l.id] ?? l.tone, detail: sv.details?.[l.id] ?? l.detail }));
    visual = <LayerStack layers={layers} ghost={sv.ghost} focus={sv.focus} separation={sv.separation} description={s.alt ?? s.title} />;
  }
  if (!visual && !exp) return null;
  return (
    <section className="stage" aria-label="Visual">
      {visual}
      {exp && result && (
        <div className="control-panel">
          <label className="range-row" style={{ fontSize: 15 }}>
            <span style={{ minWidth: 140, fontWeight: 600 }}>{exp.label}</span>
            <input type="range" min={exp.min} max={exp.max} step={exp.stepSize} value={val} onChange={(e) => setVal(Number(e.target.value))} aria-valuetext={`${val} ${exp.unit}`} />
            <span className="mono" style={{ minWidth: 96, textAlign: 'right' }}>{val.toLocaleString()} {exp.unit}</span>
          </label>
          <p className="result" aria-live="polite"><Rich text={result.text} /></p>
          <p className="model-note">Model: {exp.assumptions.join(' ')}</p>
        </div>
      )}
    </section>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return <p key={i}><Rich text={b.text} /></p>;
          case 'h':
            return <h3 key={i}>{b.text}</h3>;
          case 'list':
            return b.ordered ? <ol key={i}>{b.items.map((t, j) => <li key={j}><Rich text={t} /></li>)}</ol> : <ul key={i}>{b.items.map((t, j) => <li key={j}><Rich text={t} /></li>)}</ul>;
          case 'code':
            return <CodeBlock key={i} code={b.code} lang={b.lang} caption={b.caption} />;
          case 'codeTabs':
            return <CodeBlock key={i} code={b.tabs[0].code} lang={b.tabs[0].lang} caption={b.tabs[0].label} />;
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table className="data">
                  <thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Rich text={c} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case 'callout':
            return <div key={i} className={`callout ${b.tone === 'warn' ? 'warn' : ''}`}><strong>{b.title}</strong><Rich text={b.text} /></div>;
          case 'formula':
            return (
              <div key={i} className="formula">
                <p style={{ fontWeight: 650, margin: '0 0 6px' }}>{b.title}</p>
                <p className="muted" style={{ margin: '0 0 4px', fontSize: 15 }}>Assumptions</p>
                <ul>{b.assumptions.map((a, j) => <li key={j}><Rich text={a} /></li>)}</ul>
                <ol className="mono" style={{ fontSize: 14.5 }}>{b.steps.map((st, j) => <li key={j}><Rich text={st} /></li>)}</ol>
                <p style={{ margin: '6px 0' }}><strong>Result:</strong> <Rich text={b.result} /></p>
                {b.changed && <p className="muted" style={{ margin: 0 }}><strong>If an input changes:</strong> <Rich text={b.changed} /></p>}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function Practice({ lesson }: { lesson: GL }) {
  const required = lesson.checks.map((c) => c.id);
  return (
    <EvidenceScope required={required}>
      <Caption kicker="Practice" title="Check yourself">
        <p>
          {lesson.checks.length === 1 ? 'One check' : `${lesson.checks.length} checks`} on the main idea, then one short explanation in your own words. Right first time
          counts as solved independently; anything you miss goes to your mistake notebook and comes back later.
        </p>
      </Caption>
      <RevisionBanner topicId={lesson.id} />
      {lesson.checks.map((c) => <CheckView key={c.id} lessonId={lesson.id} check={c} />)}
      <ShortAnswer lessonId={lesson.id} spec={lesson.exercise} />
    </EvidenceScope>
  );
}

function CheckView({ lessonId, check }: { lessonId: string; check: Check }) {
  const record = useOutcome(lessonId);
  const key = useRoundKey(lessonId, `${lessonId}:${check.id}`);
  if (check.kind === 'choice') {
    return (
      <Question
        key={key}
        recordKey={key}
        prompt={<Rich text={check.prompt} />}
        choices={check.choices.map((c) => ({ id: c.id, text: <Rich text={c.text} /> }))}
        correct={check.correct}
        onAnswered={(p) => record(check.id, p === check.correct, false, check.prompt.replace(/[*`]/g, ''))}
        explain={(p) => <p><Rich text={check.choices.find((c) => c.id === p)?.why ?? ''} /></p>}
      />
    );
  }
  if (check.kind === 'line') {
    return <LinePick lessonId={lessonId} spec={check} />;
  }
  if (check.kind === 'numeric') return <NumericCheck key={key} lessonId={lessonId} check={check} />;
  return <OrderCheck key={key} lessonId={lessonId} check={check} />;
}

function NumericCheck({ lessonId, check }: { lessonId: string; check: Extract<Check, { kind: 'numeric' }> }) {
  const record = useOutcome(lessonId);
  const key = useRoundKey(lessonId, `quiz:${lessonId}:${check.id}`);
  const [st, setSt] = useRecord<{ value: string; checked?: boolean; correct?: boolean; shown?: boolean }>(key, { value: '' });
  const value = typeof st.value === 'string' ? st.value : '';
  const num = Number(value.replace(/[, _]/g, ''));
  const submit = () => {
    const correct = Number.isFinite(num) && Math.abs(num - check.answer) <= Math.abs(check.answer) * check.tolerance;
    setSt({ ...st, checked: true, correct });
    record(check.id, correct, !!st.shown, check.prompt.replace(/[*`]/g, ''));
  };
  return (
    <section className="question" aria-label="Estimate">
      <p className="step-kicker" style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>Estimate</p>
      <h3><Rich text={check.prompt} /></h3>
      <div className="range-row">
        <input type="text" inputMode="decimal" value={value} onChange={(e) => setSt({ ...st, value: e.target.value, checked: false })} onKeyDown={(e) => e.key === 'Enter' && submit()} style={{ maxWidth: 200 }} aria-label={`Answer in ${check.unit}`} />
        <span>{check.unit}</span>
        <button className="btn btn-small btn-primary" onClick={submit} disabled={!value.trim()}>Check</button>
      </div>
      {st.checked && (
        <div className="feedback">
          {st.correct ? <p className="verdict ok"><Icon name="check" size={16} strokeWidth={2.4} /> Within {Math.round(check.tolerance * 100)}% of {check.answer.toLocaleString()} {check.unit}.</p> : <p><span className="verdict fail"><Icon name="x" size={16} strokeWidth={2.4} /> Not quite.</span> Estimates within {Math.round(check.tolerance * 100)}% count. Change your number and check again.</p>}
        </div>
      )}
      {(st.checked || st.shown) ? (
        <ol className="mono" style={{ fontSize: 14.5 }}>{check.solution.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>
      ) : (
        <button className="btn btn-small btn-quiet" onClick={() => setSt({ ...st, shown: true })}>Show the working (counts as help)</button>
      )}
    </section>
  );
}

function OrderCheck({ lessonId, check }: { lessonId: string; check: Extract<Check, { kind: 'order' }> }) {
  const record = useOutcome(lessonId);
  const key = useRoundKey(lessonId, `quiz:${lessonId}:${check.id}`);
  // Deterministic shuffle so the starting order is stable across visits.
  const initial = useMemo(() => {
    const idx = check.items.map((_, i) => i);
    let seed = [...check.id].reduce((a, c) => a + c.charCodeAt(0), 7);
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = seed % (i + 1);
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (idx.every((v, i) => v === i)) idx.reverse();
    return idx;
  }, [check]);
  const [st, setSt] = useRecord<{ order: number[]; checked?: boolean; correct?: boolean }>(key, { order: initial });
  const order = Array.isArray(st.order) && st.order.length === check.items.length ? st.order : initial;
  const move = (i: number, d: number) => {
    const o = [...order];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setSt({ order: o });
  };
  const submit = () => {
    const correct = order.every((v, i) => v === i);
    setSt({ order, checked: true, correct });
    record(check.id, correct, false, check.prompt.replace(/[*`]/g, ''));
  };
  return (
    <section className="question" aria-label="Put in order">
      <p className="step-kicker" style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>Put in order</p>
      <h3><Rich text={check.prompt} /></h3>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {order.map((itemIdx, i) => (
          <li key={itemIdx} className={`choice ${st.checked ? (itemIdx === i ? 'right' : 'wrong') : ''}`} style={{ cursor: 'default', alignItems: 'center' }}>
            <span className="mark" aria-hidden="true">{i + 1}</span>
            <span style={{ flex: 1 }}><Rich text={check.items[itemIdx]} /></span>
            <button className="btn btn-small btn-quiet" onClick={() => move(i, -1)} disabled={i === 0 || st.checked} aria-label="Move up"><Icon name="arrow-right" size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
            <button className="btn btn-small btn-quiet" onClick={() => move(i, 1)} disabled={i === order.length - 1 || st.checked} aria-label="Move down"><Icon name="arrow-right" size={15} style={{ transform: 'rotate(90deg)' }} /></button>
          </li>
        ))}
      </ol>
      <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
        <button className="btn btn-small btn-primary" onClick={submit}>Check order</button>
      </div>
      {st.checked && (
        <div className="feedback">
          <p className={`verdict ${st.correct ? 'ok' : 'fail'}`}><Icon name={st.correct ? 'check' : 'x'} size={16} strokeWidth={2.4} /> {st.correct ? 'Right order.' : 'Not this order.'}</p>
          <p><Rich text={check.explain} /></p>
          {!st.correct && <button className="btn btn-small btn-quiet" onClick={() => setSt({ order, checked: false })}><Icon name="replay" size={15} /> Try again</button>}
        </div>
      )}
    </section>
  );
}
