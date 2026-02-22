import { useEffect, useRef, useState } from 'react';

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

function severityColor(t, alpha = 0.85) {
  let r, g, b;
  if (t < 0.5) {
    const f = t / 0.5;
    r = Math.round(100 + f * (255 - 100));
    g = Math.round(180 + f * (140 - 180));
    b = Math.round(255 + f * (0 - 255));
  } else {
    const f = (t - 0.5) / 0.5;
    r = Math.round(255 + f * (180 - 255));
    g = Math.round(140 + f * (0 - 140));
    b = 0;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

const NO_DATA_COLOR = 'rgba(60,90,120,0.6)';
const HOVERED_COLOR = 'rgba(255,255,180,0.95)';

function buildSeverityMap(data, category) {
  const map = {};
  data
      .filter((d) => d.category === category)
      .forEach((d) => {
        map[d.country?.trim().toLowerCase()] = Math.max(0, Math.min(1, Number(d.value) / 100));
      });
  return map;
}

function matchCountry(properties, severityMap) {
  const candidates = [
    properties.ADMIN,
    properties.NAME,
    properties.NAME_LONG,
    properties.ISO_A2,
    properties.ISO_A3,
  ]
      .filter(Boolean)
      .map((s) => s.trim().toLowerCase());
  for (const c of candidates) {
    if (severityMap[c] !== undefined) return severityMap[c];
  }
  return null;
}

const GEOJSON_URL =
    'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

export default function Globe({ data, category, onCountryClick }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [countriesGeoJson, setCountriesGeoJson] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  useEffect(() => {
    fetch(GEOJSON_URL)
        .then((res) => res.json())
        .then((geojson) => {
          setCountriesGeoJson(
              geojson.features.filter((d) => d.properties.ISO_A2 !== 'AQ')
          );
        })
        .catch((err) => console.warn('Failed to load GeoJSON:', err));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    import('globe.gl').then((module) => {
      if (cancelled || !containerRef.current) return;
      const GlobeGL = module.default;

      const globe = GlobeGL()(container)
          .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
          .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
          .width(container.clientWidth)
          .height(container.clientHeight)
          .atmosphereColor('#1a6ba0')
          .atmosphereAltitude(0.15)
          .enablePointerInteraction(true)
          .lineHoverPrecision(0);

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.4;
      globe.controls().enableZoom = true;

      globeRef.current = globe;
      setGlobeReady(true);
    });

    const handleResize = () => {
      if (containerRef.current && globeRef.current) {
        globeRef.current
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      const canvas = container.querySelector('canvas');
      if (canvas) canvas.remove();
      globeRef.current = null;
      setGlobeReady(false);
    };
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current || !countriesGeoJson) return;

    const severityMap = buildSeverityMap(data, category);

    globeRef.current
        .polygonsData(countriesGeoJson)
        .polygonAltitude((d) => (d === hoveredCountry ? 0.1 : 0.04))
        .polygonCapColor((d) => {
          if (d === hoveredCountry) return HOVERED_COLOR;
          const t = matchCountry(d.properties, severityMap);
          return t !== null ? severityColor(t) : NO_DATA_COLOR;
        })
        .polygonSideColor((d) => {
          if (d === hoveredCountry) return 'rgba(255,255,180,0.5)';
          const t = matchCountry(d.properties, severityMap);
          return t !== null ? severityColor(t, 0.4) : 'rgba(60,90,120,0.2)';
        })
        .polygonStrokeColor(() => 'rgba(255,255,255,0.08)')
        .polygonLabel((d) => {
          const { properties: p } = d;
          const t = matchCountry(p, severityMap);
          const dataPoint = t !== null
              ? data.find(
                  (row) =>
                      row.category === category &&
                      [p.ADMIN, p.NAME, p.NAME_LONG]
                          .filter(Boolean)
                          .map((s) => s.trim().toLowerCase())
                          .includes(row.country?.trim().toLowerCase())
              )
              : null;
          return `<div style="background:rgba(0,0,0,0.85);color:#fff;padding:8px 12px;border-radius:6px;font-family:sans-serif;font-size:13px;max-width:240px;pointer-events:none;">
          <b style="font-size:14px;">${p.ADMIN}</b><br/>
          ${dataPoint
              ? `<span style="color:#ffd700;">${categoryLabel(category)}</span>: <b>${dataPoint.value}</b>/100<br/>
               <span style="opacity:0.85;font-size:12px;">${dataPoint.description || ''}</span><br/>
               <span style="opacity:0.5;font-size:11px;">Click to explore</span>`
              : `<span style="opacity:0.6;font-size:12px;">No ${categoryLabel(category)} data</span>`
          }
        </div>`;
        })
        .polygonsTransitionDuration(400)
        .onPolygonHover((hoverD) => setHoveredCountry(hoverD || null))
        .onPolygonClick((polygon) => {
          if (!onCountryClick) return;
          const { properties: p } = polygon;
          const t = matchCountry(p, severityMap);
          const dataPoint = data.find(
              (row) =>
                  row.category === category &&
                  [p.ADMIN, p.NAME, p.NAME_LONG]
                      .filter(Boolean)
                      .map((s) => s.trim().toLowerCase())
                      .includes(row.country?.trim().toLowerCase())
          );
          onCountryClick({
            name: p.ADMIN,
            iso: p.ISO_A2,
            severity: t,
            value: dataPoint?.value ?? null,
            description: dataPoint?.description ?? null,
            category,
            geometry: polygon.geometry,   // for SVG silhouette
            properties: p,                // for population, GDP etc.
            lat: p.LABEL_Y || 0,
            lng: p.LABEL_X || 0,
          });
        });
  }, [globeReady, countriesGeoJson, data, category, hoveredCountry, onCountryClick]);

  return (
      <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
          aria-label="Interactive world globe crisis heatmap"
      />
  );
}