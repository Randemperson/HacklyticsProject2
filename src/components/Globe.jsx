import { useEffect, useRef } from 'react';
import GlobeGL from 'globe.gl';

// Returns [r, g, b] components (0-255) based on severity t ∈ [0,1] and category
function getCategoryRGB(t, category) {
  switch (category) {
    case 'conflict':
      return [Math.round(220 + 35 * t), Math.round(60 * (1 - t)), Math.round(40 * (1 - t))];
    case 'climate':
      return [
        Math.round(255 * Math.min(1, 2 * t)),
        Math.round(t > 0.5 ? 255 * (2 - 2 * t) : 200),
        Math.round(30 * (1 - t)),
      ];
    case 'food_insecurity':
      return [Math.round(255 * Math.min(1, 1.5 * t)), Math.round(160 * (1 - t)), 0];
    case 'poverty':
      return [Math.round(160 + 95 * t), Math.round(50 * (1 - t)), Math.round(200 * (1 - t))];
    case 'disease':
      return [Math.round(80 + 175 * t), Math.round(190 * (1 - t)), Math.round(70 * (1 - 0.5 * t))];
    default:
      return [Math.round(220 + 35 * t), Math.round(60 * (1 - t)), Math.round(40 * (1 - t))];
  }
}

function getPointColor(value, category) {
  const t = Math.max(0, Math.min(1, Number(value) / 100));
  const [r, g, b] = getCategoryRGB(t, category);
  return `rgba(${r},${g},${b},${0.7 + 0.3 * t})`;
}

function getRingColorFn(value, category) {
  const t = Math.max(0, Math.min(1, Number(value) / 100));
  const [r, g, b] = getCategoryRGB(t, category);
  // ringPct: 0 at center → 1 at edge; fade alpha outward
  return (ringPct) =>
    `rgba(${r},${g},${b},${Math.max(0, (1 - ringPct) * 0.85).toFixed(2)})`;
}

function categoryLabel(cat) {
  const labels = {
    conflict: 'Conflict Severity',
    climate: 'Climate Vulnerability',
    food_insecurity: 'Food Insecurity',
    poverty: 'Poverty Index',
    disease: 'Disease Burden',
  };
  return labels[cat] || cat;
}

export default function Globe({ data, category }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);

  // Initialize the globe once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const globe = GlobeGL()(container)
      .globeImageUrl('/earth-blue-marble.jpg')
      .backgroundImageUrl('/night-sky.png')
      .width(container.clientWidth)
      .height(container.clientHeight)
      .atmosphereColor('#1a6ba0')
      .atmosphereAltitude(0.15)
      .enablePointerInteraction(true);

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableZoom = true;

    globeRef.current = globe;

    const handleResize = () => {
      if (containerRef.current) {
        globe.width(containerRef.current.clientWidth);
        globe.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      const canvas = container.querySelector('canvas');
      if (canvas) canvas.remove();
    };
  }, []);

  // Update visualization whenever data or category changes
  useEffect(() => {
    if (!globeRef.current) return;

    const filteredData = data.filter((d) => d.category === category);

    globeRef.current
      // Flat disc points sized and colored by severity
      .pointsData(filteredData)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(0.001)
      .pointRadius((d) => 0.5 + (Number(d.value) / 100) * 1.8)
      .pointColor((d) => getPointColor(d.value, category))
      .pointLabel(
        (d) =>
          `<div style="background:rgba(0,0,0,0.8);color:#fff;padding:8px 12px;border-radius:6px;font-family:sans-serif;font-size:13px;max-width:220px;pointer-events:none;">
            <b style="font-size:14px;">${d.country}</b><br/>
            <span style="color:#ffd700;">${categoryLabel(d.category)}</span>:
            <b>${d.value}</b>/100<br/>
            <span style="opacity:0.85;font-size:12px;">${d.description}</span>
          </div>`
      )
      // Pulsing rings for extra heatmap effect
      .ringsData(filteredData)
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d) => 2 + (Number(d.value) / 100) * 5)
      .ringPropagationSpeed(0.6)
      .ringRepeatPeriod(1400)
      .ringColor((d) => getRingColorFn(d.value, category));
  }, [data, category]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      aria-label="Interactive world globe heatmap"
    />
  );
}
