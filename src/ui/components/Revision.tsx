/**
 * Spaced revision (brief §10): when a topic is due, the learner starts a new round and answers fresh copies of
 * its checks. Earlier answers stay in the record; the interval grows only if the new round is solved independently.
 */
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { startRevision, type Evidence } from '../../progress/evidence';
import { Icon } from './Icon';

export function RevisionBanner({ topicId }: { topicId: string }) {
  const { store } = useProgress();
  const [review] = useRecord<{ due: number; reps: number } | null>(`review:${topicId}`, null);
  const [ev] = useRecord<Evidence | null>(`evidence:${topicId}`, null);
  const round = ev?.round ?? 0;
  const due = review && review.due <= Date.now();
  const completedThisRound = (ev?.completed ?? []).includes(round);
  if (!due || !completedThisRound) {
    return round > 0 ? <p className="notice" style={{ maxWidth: 'var(--read)', marginTop: 16 }}><Icon name="replay" size={15} /> Revision round {round}: answer from memory before rereading.</p> : null;
  }
  return (
    <div className="notice warn" style={{ maxWidth: 'var(--read)', marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 260px' }}>Due for revision. Your earlier answers are saved; a revision round asks the same checks again, unanswered.</span>
      <button className="btn btn-small btn-primary" onClick={() => startRevision(store, topicId)}>Start revision round</button>
    </div>
  );
}
