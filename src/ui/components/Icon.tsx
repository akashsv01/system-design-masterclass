/**
 * One small, consistent icon set (24-unit grid, 1.8 stroke, round caps) used in the UI and inside diagrams.
 * Replaces Unicode glyphs (▯ ⛁ ☾ ☰ …), which render as missing-character boxes on some systems.
 * Every icon is decorative: the surrounding element carries the accessible name.
 */
import type { CSSProperties } from 'react';

const P: Record<string, string[]> = {
  // Actions and navigation
  'arrow-left': ['M19 12H5', 'M11 18l-6-6 6-6'],
  'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  replay: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4.5v4.5h4.5'],
  'turn-left': ['M20 13a8 8 0 0 1-14.2 5', 'M20 13A8 8 0 0 0 7 6.8L4 9', 'M4 4.5V9h4.5'],
  'turn-right': ['M4 13a8 8 0 0 0 14.2 5', 'M4 13a8 8 0 0 1 13-6.2L20 9', 'M20 4.5V9h-4.5'],
  play: ['M7.5 5v14l11-7z'],
  pause: ['M8.5 5.5v13', 'M15.5 5.5v13'],
  reset: ['M4 12a8 8 0 1 0 8-8', 'M4 4v5h5', 'M12 8v4l2.5 2.5'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  x: ['M7 7l10 10', 'M17 7L7 17'],
  lock: ['M7 11h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 17 20H7a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 7 11z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  search: ['M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'M20 20l-4.8-4.8'],
  sun: ['M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M12 2.5v2', 'M12 19.5v2', 'M4.6 4.6L6 6', 'M18 18l1.4 1.4', 'M2.5 12h2', 'M19.5 12h2', 'M4.6 19.4L6 18', 'M18 6l1.4-1.4'],
  moon: ['M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z'],
  layers: ['M12 3.5l9 4.5-9 4.5-9-4.5z', 'M3 12.5l9 4.5 9-4.5', 'M3 16.5l9 4.5 9-4.5'],
  list: ['M8 7h12', 'M8 12h12', 'M8 17h12', 'M4 7h.01', 'M4 12h.01', 'M4 17h.01'],
  pencil: ['M4 20l4.2-1L19 8.2 15.8 5 5 15.8z', 'M13.5 7.3l3.2 3.2'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'],
  alert: ['M12 3.5L2.5 20h19z', 'M12 10v4.5', 'M12 17.2v.01'],
  info: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 11v5.5', 'M12 7.8v.01'],
  clock: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 7.5V12l3 2'],
  book: ['M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z', 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3'],
  flask: ['M9.5 3h5', 'M10.5 3v6L5 18.5A1.7 1.7 0 0 0 6.5 21h11a1.7 1.7 0 0 0 1.5-2.5L13.5 9V3', 'M7.5 15h9'],
  target: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z', 'M12 11.5v1'],
  map: ['M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z', 'M9 4.5v13', 'M15 6.5v13'],
  spark: ['M12 3v5', 'M12 16v5', 'M3 12h5', 'M16 12h5', 'M6 6l2.5 2.5', 'M15.5 15.5L18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5L6 18'],
  cloud: ['M7 18.5h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9.6 4.5 4.5 0 0 0 7 18.5z'],
  device: ['M4.5 5h15a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M9 20h6', 'M12 16.5V20'],
  flag: ['M5 21V4', 'M5 4.5h11l-2 4 2 4H5'],
  // Diagram node kinds
  phone: ['M8 2.75h8a1.75 1.75 0 0 1 1.75 1.75v15a1.75 1.75 0 0 1-1.75 1.75H8A1.75 1.75 0 0 1 6.25 19.5v-15A1.75 1.75 0 0 1 8 2.75z', 'M10.75 18h2.5'],
  server: ['M5 3.75h14a1.25 1.25 0 0 1 1.25 1.25v3.5A1.25 1.25 0 0 1 19 9.75H5A1.25 1.25 0 0 1 3.75 8.5V5A1.25 1.25 0 0 1 5 3.75z', 'M5 14.25h14a1.25 1.25 0 0 1 1.25 1.25V19A1.25 1.25 0 0 1 19 20.25H5A1.25 1.25 0 0 1 3.75 19v-3.5A1.25 1.25 0 0 1 5 14.25z', 'M7.5 6.75h.01', 'M7.5 17.25h.01'],
  database: ['M4.5 6c0-1.66 3.36-3 7.5-3s7.5 1.34 7.5 3-3.36 3-7.5 3-7.5-1.34-7.5-3z', 'M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6', 'M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3'],
  bolt: ['M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z'],
  queue: ['M3 7.5h4v9H3z', 'M10 7.5h4v9h-4z', 'M17 7.5h4v9h-4z'],
  service: ['M12 2.75l8.25 4.6v9.3L12 21.25l-8.25-4.6v-9.3z', 'M12 12l8-4.5', 'M12 12v9', 'M12 12L4 7.5'],
  globe: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M3 12h18', 'M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9c-2.5-2.6-3.5-5.6-3.5-9S9.5 5.6 12 3z'],
  split: ['M3 12h5.5', 'M8.5 12L13 6.5h7.5', 'M8.5 12l4.5 5.5h7.5', 'M17.5 3.5l3 3-3 3', 'M17.5 14.5l3 3-3 3'],
  user: ['M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5'],
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, style, strokeWidth = 1.8 }: { name: IconName; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }) {
  const paths = P[name] ?? [];
  const filled = name === 'play';
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** The same icon drawn inside another SVG (diagrams), centred on (x, y). */
export function SvgIcon({ name, x, y, size = 18, className }: { name: IconName; x: number; y: number; size?: number; className?: string }) {
  const s = size / 24;
  return (
    <g className={`svg-icon ${className ?? ''}`} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} aria-hidden="true">
      {(P[name] ?? []).map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
    </g>
  );
}
