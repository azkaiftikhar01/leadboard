/**
 * Line icons, 1.6 stroke, 24-box. Drawn rather than typed so nothing renders as
 * a system emoji - those pull in whatever the OS feels like and instantly make
 * an interface look like a toy.
 */
const S = ({ children, size = 18, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none' }} {...rest}
  >
    {children}
  </svg>
)

export const Icon = {
  focus:    (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1.5v2.6M12 19.9v2.6M22.5 12h-2.6M4.1 12H1.5" /></S>,
  history:  (p) => <S {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4.5V10h5.5" /><path d="M12 7.5V12l3.2 1.9" /></S>,
  gear:     (p) => <S {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.5a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1Z" /></S>,
  crown:    (p) => <S {...p}><path d="M4 18h16M4 18 3 7l5 4 4-6 4 6 5-4-1 11" /></S>,
  note:     (p) => <S {...p}><path d="M6 3.5h8.5L19 8v12.5H6z" /><path d="M14 3.5V8h5" /><path d="M9 12.5h6M9 16.5h4" /></S>,
  today:    (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  sun:      (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>,
  moon:     (p) => <S {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></S>,
  review:   (p) => <S {...p}><path d="M9 11l2 2 4-4" /><circle cx="12" cy="12" r="9" /></S>,
  inbox:    (p) => <S {...p}><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z" /></S>,
  team:     (p) => <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 5.5a3.2 3.2 0 0 1 0 6M18.5 20a6.4 6.4 0 0 0-2.2-4.8" /></S>,
  projects: (p) => <S {...p}><rect x="3" y="4" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="4" width="7.5" height="7.5" rx="2" /><rect x="3" y="14.5" width="7.5" height="5.5" rx="2" /><rect x="13.5" y="14.5" width="7.5" height="5.5" rx="2" /></S>,
  chart:    (p) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>,
  mic:      (p) => <S {...p}><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></S>,
  stop:     (p) => <S {...p}><rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" /></S>,
  check:    (p) => <S {...p}><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></S>,
  x:        (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>,
  plus:     (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>,
  arrow:    (p) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>,
  back:     (p) => <S {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></S>,
  flame:    (p) => <S {...p}><path d="M12 22c3.9 0 6.5-2.6 6.5-6 0-4.2-4-6.3-4.8-10.6C11.4 6.8 9 9.4 9 11.5c0 1 .4 1.8 1 2.4-1.7.3-4.5 1.7-4.5 4.6 0 2 1.6 3.5 3.5 3.5" /></S>,
  clock:    (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></S>,
  warn:     (p) => <S {...p}><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4M12 17.2v.1" /></S>,
  user:     (p) => <S {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></S>,
  trash:    (p) => <S {...p}><path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 13h9.4l.8-13" /></S>,
  undo:     (p) => <S {...p}><path d="M4 9h10a5 5 0 0 1 0 10h-4" /><path d="M8 5 4 9l4 4" /></S>,
  spark:    (p) => <S {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></S>,
}

/** The LeadBoard mark. Drawn rather than an <img> so it inherits the gradient
 *  and stays sharp at favicon sizes. */
export const Mark = ({ size = 32, id = 'lbm' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ flex: 'none' }}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="45%" stopColor="#E0487E" />
        <stop offset="100%" stopColor="#5B2B9E" />
      </linearGradient>
    </defs>
    <g fill="none" stroke={`url(#${id})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="13" y="12.5" width="33" height="42" rx="7" />
      <path d="M23.5 12.5V10a2.6 2.6 0 0 1 2.6-2.6h7.3A2.6 2.6 0 0 1 36 10v2.5" />
      <path d="M7.5 14.5 5 12M6.5 21H3.4M9.5 8.4 7.8 6.2" strokeWidth="3" />
      <path d="M25.5 30.5a4.6 4.6 0 0 0 8 0" strokeWidth="3" />
      <path d="M20.5 39.5h9M20.5 46.5h13" strokeWidth="3" />
      <path d="M34.5 41.2 37.6 44.4 43.5 37.5" strokeWidth="3.2" />
    </g>
    <g fill={`url(#${id})`}>
      <circle cx="29.5" cy="10.6" r="2.1" />
      <ellipse cx="25.6" cy="24.6" rx="1.9" ry="2.4" />
      <ellipse cx="33.6" cy="24.6" rx="1.9" ry="2.4" />
      <circle cx="16.6" cy="39.5" r="1.9" />
      <circle cx="16.6" cy="46.5" r="1.9" />
    </g>
  </svg>
)
