import { useState } from 'react';

const GRADIENT_STOPS = [
  { pct: 0,   color: 'rgba(30,100,200,0.4)' },
  { pct: 33,  color: 'rgba(255,200,0,0.7)'  },
  { pct: 66,  color: 'rgba(255,100,0,0.85)' },
  { pct: 100, color: 'rgba(200,0,0,1)'      },
];

const CATEGORY_INFO = {
  conflict: {
    title: 'Armed Conflict',
    description: 'Measures ongoing armed conflicts, deaths, displacement, and civilian harm.',
    source: 'ACLED, UNOCHA 2024',
  },
  climate: {
    title: 'Climate Vulnerability',
    description: 'Combines exposure to extreme weather, sea level rise, drought, and adaptive capacity.',
    source: 'ND-GAIN Country Index 2024',
  },
  food_insecurity: {
    title: 'Food Insecurity',
    description: 'Measures percentage of population lacking reliable access to sufficient, safe food.',
    source: 'IPC / FAO 2024',
  },
  poverty: {
    title: 'Poverty Index',
    description: 'Reflects percentage of population living below national and international poverty lines.',
    source: 'World Bank Poverty Data 2024',
  },
  disease: {
    title: 'Disease Burden',
    description: 'Combines disease prevalence (malaria, HIV, TB, cholera) and healthcare system capacity.',
    source: 'WHO Global Health Observatory 2024',
  },
  overall: {
    title: 'Overall Severity',
    description: 'Average severity across all crisis categories — conflict, climate, food, poverty, and disease.',
    source: 'Composite index, all sources 2024',
  },
};

export default function Legend({ category }) {
  const [open, setOpen] = useState(false);
  const key = category || 'overall';
  const info = CATEGORY_INFO[key] || CATEGORY_INFO.overall;
  const gradientCss = `linear-gradient(to right, ${GRADIENT_STOPS.map(
      (s) => `${s.color} ${s.pct}%`
  ).join(', ')})`;

  return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      }}>
        {open && (
            <div style={{
              background: 'rgba(6,13,26,0.97)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px',
              padding: '16px 18px',
              width: '230px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            }}>
              <div>
                <div style={{ fontSize: '0.5rem', letterSpacing: '0.2em', color: '#2a4a62', fontWeight: 700, marginBottom: '5px' }}>
                  {category ? 'CATEGORY' : 'COMPOSITE'}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#dce8f0', letterSpacing: '0.01em' }}>
                  {info.title}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#4a6a80', lineHeight: 1.6 }}>
                {info.description}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ height: '10px', borderRadius: '5px', background: gradientCss }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#2a4a62', letterSpacing: '0.04em' }}>
                  <span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>CRITICAL</span>
                </div>
              </div>
              <div style={{ fontSize: '0.58rem', color: '#1e3a50', fontStyle: 'italic' }}>
                {info.source}
              </div>
            </div>
        )}
        <button
            onClick={() => setOpen((o) => !o)}
            style={{
              background: 'rgba(6,13,26,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              color: open ? '#7ec8f5' : '#4a7a9a',
              padding: '7px 16px',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
              transition: 'color 0.15s',
            }}
        >
          {open ? 'CLOSE' : 'LEGEND'}
        </button>
      </div>
  );
}