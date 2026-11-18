import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Planned } from '../App';
import { LAB_COMPONENTS } from './Labs';
import { topicById } from '../../content/curriculum';

export default function LabRouter() {
  const { id = '' } = useParams();
  const Lab = LAB_COMPONENTS[id];
  const topic = topicById(id);
  useEffect(() => {
    document.title = topic ? `${topic.short ?? topic.title} · System Design Masterclass` : 'System Design Masterclass';
    window.scrollTo(0, 0);
  }, [topic]);
  return Lab ? <Lab /> : <Planned id={id} />;
}
