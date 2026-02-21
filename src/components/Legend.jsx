const GRADIENT_STOPS = [
  { pct: 0, color: 'rgba(30,100,200,0.4)' },
  { pct: 33, color: 'rgba(255,200,0,0.7)' },
  { pct: 66, color: 'rgba(255,100,0,0.85)' },
  { pct: 100, color: 'rgba(200,0,0,1)' },
];

const CATEGORY_INFO = {
  conflict: {
    title: '⚔️ Armed Conflict',
    description: 'Measures ongoing armed conflicts, deaths, displacement, and civilian harm.',
    source: 'Based on ACLED, UNOCHA 2024 data',
  },
  climate: {
    title: '🌡️ Climate Vulnerability',
    description: 'Combines exposure to extreme weather, sea level rise, drought, and adaptive capacity.',
    source: 'Based on ND-GAIN Country Index 2024',
  },
  food_insecurity: {
    title: '🌾 Food Insecurity',
    description: 'Measures percentage of population lacking reliable access to sufficient, safe food.',
    source: 'Based on IPC/FAO Food Insecurity 2024',
  },
  poverty: {
    title: '💰 Poverty Index',
    description: 'Reflects percentage of population living below national and international poverty lines.',
    source: 'Based on World Bank Poverty Data 2024',
  },
  disease: {
    title: '🦠 Disease Burden',
    description: 'Combines disease prevalence (malaria, HIV, TB, cholera) and healthcare system capacity.',
    source: 'Based on WHO Global Health Observatory 2024',
  },
};

export default function Legend({ category }) {
  const info = CATEGORY_INFO[category] || {};
  const gradientCss = `linear-gradient(to right, ${GRADIENT_STOPS.map(
    (s) => `${s.color} ${s.pct}%`
  ).join(', ')})`;

  return (
    <div className="legend-panel">
      <h3 className="legend-title">{info.title}</h3>
      <p className="legend-description">{info.description}</p>

      <div className="legend-gradient-wrap">
        <div
          className="legend-gradient"
          style={{ background: gradientCss }}
          aria-label="Color scale from low to high severity"
        />
        <div className="legend-labels">
          <span>Low</span>
          <span>Medium</span>
          <span>High</span>
          <span>Critical</span>
        </div>
      </div>

      <p className="legend-source">{info.source}</p>
    </div>
  );
}
