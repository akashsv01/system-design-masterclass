import { useEffect } from 'react';
import { useProgress } from './ProgressProvider';
import { STATUS_ORDER, type LessonStatus } from '../../shared/progress';

/** Records that a lesson was opened and remembers it for "Continue learning". */
export function useMarkStarted(id: string) {
  const { store } = useProgress();
  useEffect(() => {
    if (!store.get(`status:${id}`)) store.set(`status:${id}`, 'started');
    store.set('pref:last-activity', { id, at: Date.now() });
  }, [store, id]);
}

/** Raise a lesson's status; never lowers evidence already recorded. */
export function raiseStatus(store: ReturnType<typeof useProgress>['store'], id: string, status: LessonStatus) {
  const cur = store.get<LessonStatus>(`status:${id}`);
  if (!cur || STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf(cur)) store.set(`status:${id}`, status);
}
