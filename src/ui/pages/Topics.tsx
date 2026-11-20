/**
 * All topics: the course outline (Category → Module → Lesson) as a page. Same navigator as the lesson sidebar
 * and the phone drawer, so expansion state carries between them. `/topics#data` or `/topics#data/caching`
 * opens that branch; older anchors (#labs, #cases-hld …) still land somewhere sensible.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CURRICULUM } from '../../content/curriculum';
import { LEGACY_HASH } from '../../content/outline';
import { CourseNav } from '../nav/CourseNav';
import { ContinueLink } from '../nav/CourseLayout';

export function Topics() {
  const { hash } = useLocation();
  const [reveal, setReveal] = useState<string | undefined>();
  useEffect(() => { document.title = 'All topics · System Design Masterclass'; }, []);
  useEffect(() => { const h = decodeURIComponent(hash.slice(1)); if (h) setReveal(LEGACY_HASH[h] ?? h); }, [hash]);
  return (
    <div className="page topics-page">
      <h1 className="page-title">All topics</h1>
      <p className="page-lede">
        {CURRICULUM.length} topics in eight parts, all open to you. Open a part to see its modules, open a module to see its lessons, or search for the one idea you need.
      </p>
      <ContinueLink />
      <ul className="evidence-key" aria-label="Key">
        <li><span className="cn-dot" />Not started</li>
        <li><span className="cn-dot started" />Started</li>
        <li><span className="cn-dot done" />Done</li>
      </ul>
      <CourseNav variant="page" revealKey={reveal} />
      <p className="muted" style={{ marginTop: 40, fontSize: 14 }}>
        How complete is the course, and what has been checked? See the <Link to="/coverage">coverage report</Link>.
      </p>
    </div>
  );
}
