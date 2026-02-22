import { useState } from 'react';
import Papa from 'papaparse';

const CATEGORIES = [
  { key: 'conflict',        label: 'Conflict',      color: '#e05a4e' },
  { key: 'climate',         label: 'Climate',       color: '#e0a030' },
  { key: 'food_insecurity', label: 'Food Security', color: '#e07830' },
  { key: 'poverty',         label: 'Poverty',       color: '#a055c0' },
  { key: 'disease',         label: 'Disease',       color: '#30a860' },
];

const SPECIAL_CATEGORIES = [
  {
    key: 'funding',
    label: 'Funding',
    color: '#2ecc71',
    tag: '$',
    tagColor: 'rgba(46,204,113,0.45)',
    tagBg: 'rgba(46,204,113,0.08)',
    dividerColor: 'rgba(46,204,113,0.1)',
    hoverBorder: 'rgba(46,204,113,0.35)',
    idleText: '#4a9a6a',
    idleDot: 'rgba(46,204,113,0.25)',
  },
  {
    key: 'disparity',
    label: 'Disparity',
    color: '#9b6dff',
    tag: '△',
    tagColor: 'rgba(155,109,255,0.45)',
    tagBg: 'rgba(155,109,255,0.08)',
    dividerColor: 'rgba(155,109,255,0.1)',
    hoverBorder: 'rgba(155,109,255,0.35)',
    idleText: '#7a5ab8',
    idleDot: 'rgba(155,109,255,0.25)',
  },
];

export default function Controls({ category, onCategoryChange, onDataLoad, rowCount }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => onDataLoad(results.data),
    });
    e.target.value = '';
  }

  function handleCategoryClick(key) {
    onCategoryChange(category === key ? null : key);
  }

  function renderCatButton(cat) {
    const active  = category === cat.key;
    const hovered = hoveredKey === cat.key;
    let borderLeftColor = 'transparent';
    if (active) borderLeftColor = cat.color;
    else if (hovered) borderLeftColor = 'rgba(255,255,255,0.3)';

    return (
        <button
            key={cat.key}
            onClick={() => handleCategoryClick(cat.key)}
            onMouseEnter={() => setHoveredKey(cat.key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              ...s.catBtn,
              borderLeftColor,
              ...(active ? {
                color: '#f0f4f8',
                background: `linear-gradient(90deg, ${cat.color}22 0%, ${cat.color}08 100%)`,
              } : {}),
            }}
        >
        <span style={{
          ...s.catIndicator,
          background: active ? cat.color : 'rgba(255,255,255,0.1)',
          boxShadow: active ? `0 0 6px ${cat.color}88` : 'none',
        }} />
          <span style={s.catText}>{cat.label}</span>
          {active && <span style={s.activeTag}>SELECTED</span>}
        </button>
    );
  }

  function renderSpecialButton(cat) {
    const active  = category === cat.key;
    const hovered = hoveredKey === cat.key;
    let borderLeftColor = 'transparent';
    if (active) borderLeftColor = cat.color;
    else if (hovered) borderLeftColor = cat.hoverBorder;

    return (
        <button
            key={cat.key}
            onClick={() => handleCategoryClick(cat.key)}
            onMouseEnter={() => setHoveredKey(cat.key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              ...s.catBtn,
              borderLeftColor,
              background: active
                  ? `linear-gradient(90deg, ${cat.color}22 0%, ${cat.color}08 100%)`
                  : `${cat.color}08`,
              color: active ? '#f0f4f8' : cat.idleText,
            }}
        >
        <span style={{
          ...s.catIndicator,
          background: active ? cat.color : cat.idleDot,
          boxShadow: active ? `0 0 6px ${cat.color}88` : 'none',
        }} />
          <span style={s.catText}>{cat.label}</span>
          {active
              ? <span style={s.activeTag}>SELECTED</span>
              : <span style={{ ...s.specialTag, color: cat.tagColor, background: cat.tagBg }}>{cat.tag}</span>
          }
        </button>
    );
  }

  return (
      <aside style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.wordmark}>
            <span style={s.wordmarkVide}>Vide</span><span style={s.wordmarkPax}>Pax</span>
          </div>
          <div style={s.wordmarkSub}>GLOBAL CRISIS MONITOR</div>
          <div style={s.headerLine} />
        </div>

        {/* Category */}
        <div style={s.section}>
          <div style={s.label}>VIEW BY</div>
          <div style={s.categoryList}>
            {CATEGORIES.map(renderCatButton)}
            {SPECIAL_CATEGORIES.map((cat) => (
                <div key={cat.key}>
                  <div style={{ height: '1px', background: cat.dividerColor, margin: '4px 4px' }} />
                  {renderSpecialButton(cat)}
                </div>
            ))}
          </div>
          {category === null && (
              <p style={s.overallNote}>Showing overall average severity</p>
          )}
        </div>

        <div style={s.rule} />

        {/* Stats */}
        <div style={s.section}>
          <div style={s.label}>DATASET</div>
          <div style={s.statBlock}>
            <span style={s.statNum}>{rowCount.toLocaleString()}</span>
            <span style={s.statUnit}>entries</span>
          </div>
        </div>

        <div style={s.rule} />

        {/* Upload */}
        <div style={s.section}>
          <div style={s.label}>IMPORT DATA</div>
          <label style={s.uploadBtn} htmlFor="csv-upload">
            Upload CSV
          </label>
          <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
          />
          <p style={s.hint}>
            Required: country, lat, lng,<br />category, value, description
          </p>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <div style={s.rule} />
          <span style={s.footerText}>Drag · Rotate · Click to explore</span>
        </div>

      </aside>
  );
}

const s = {
  panel: {
    width: '210px',
    minWidth: '200px',
    flexShrink: 0,
    background: '#060d1a',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    zIndex: 10,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  header: {
    padding: '24px 20px 20px',
  },
  wordmark: {
    fontSize: '1.6rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    lineHeight: 1,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  wordmarkVide: { color: '#dce8f0' },
  wordmarkPax:  { color: '#3a8fd4', marginLeft: '1px' },
  wordmarkSub: {
    fontSize: '0.5rem',
    letterSpacing: '0.2em',
    color: '#1e4060',
    marginTop: '5px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  headerLine: {
    marginTop: '16px',
    height: '1px',
    background: 'linear-gradient(90deg, rgba(58,143,212,0.5) 0%, transparent 100%)',
  },
  section: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.55rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: '#2a4a62',
    marginBottom: '4px',
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  catBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(255,255,255,0.02)',
    border: 'none',
    borderLeft: '2px solid transparent',
    color: '#6a8ea8',
    padding: '9px 10px',
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    letterSpacing: '0.01em',
    transition: 'border-left-color 0.2s ease, color 0.15s ease, background 0.15s ease',
    borderRadius: '0 6px 6px 0',
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    width: '100%',
  },
  catIndicator: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  catText: { flex: 1 },
  activeTag: {
    fontSize: '0.5rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#3a6a80',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px',
    padding: '2px 5px',
  },
  specialTag: {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: '3px',
    padding: '2px 6px',
  },
  overallNote: {
    margin: '4px 0 0',
    fontSize: '0.62rem',
    color: '#2a6080',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  rule: {
    height: '1px',
    background: 'rgba(255,255,255,0.04)',
    margin: '0 20px',
  },
  statBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  statNum: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#7ec8f5',
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },
  statUnit: {
    fontSize: '0.65rem',
    color: '#2a5070',
    letterSpacing: '0.08em',
    fontWeight: 500,
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '5px',
    color: '#5a8aa8',
    padding: '9px',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  hint: {
    margin: 0,
    fontSize: '0.6rem',
    color: '#1e3a50',
    lineHeight: 1.7,
    fontFamily: 'monospace',
  },
  footer: {
    marginTop: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  footerText: {
    fontSize: '0.58rem',
    color: '#1a3040',
    letterSpacing: '0.06em',
  },
};