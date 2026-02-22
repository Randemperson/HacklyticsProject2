import { useEffect, useRef, useState } from 'react';

function severityColor(t, alpha = 0.85) {
  if (t === null || t === undefined) return `rgba(60,90,120,${alpha})`;
  t = Math.max(0, Math.min(1, t));

  const stops = [
    [20,  40,  70 ],
    [230, 210, 0  ],
    [240, 100, 0  ],
    [200, 0,   0  ],
  ];

  const scaled = t * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  return `rgba(${Math.round(r1+(r2-r1)*f)},${Math.round(g1+(g2-g1)*f)},${Math.round(b1+(b2-b1)*f)},${alpha})`;
}

function fundingColor(t, alpha = 0.85) {
  if (t === null || t === undefined) return `rgba(60,90,120,${alpha})`;
  t = Math.max(0, Math.min(1, t));

  const stops = [
    [20,  40,  70 ],
    [0,   180, 100],
    [0,   220, 60 ],
  ];

  const scaled = t * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  return `rgba(${Math.round(r1+(r2-r1)*f)},${Math.round(g1+(g2-g1)*f)},${Math.round(b1+(b2-b1)*f)},${alpha})`;
}

function pickColor(category, t, alpha) {
  return category === 'funding' ? fundingColor(t, alpha) : severityColor(t, alpha);
}

const NO_DATA_COLOR = 'rgba(60,90,120,0.6)';
const HOVERED_COLOR = 'rgba(255,255,180,0.95)';
const FADE_DURATION = 600;

function categoryLabel(cat) {
  const labels = {
    conflict:        'Conflict Severity',
    climate:         'Climate Vulnerability',
    food_insecurity: 'Food Insecurity',
    poverty:         'Poverty Index',
    disease:         'Disease Burden',
    funding:         'Funding',
  };
  return labels[cat] || cat;
}

function buildSeverityMap(data, category) {
  const map = {};
  data
      .filter((d) => d.category === category)
      .forEach((d) => {
        map[d.country?.trim().toLowerCase()] = Math.max(0, Math.min(1, Number(d.value) / 100));
      });
  return map;
}

function buildAverageSeverityMap(data) {
  // funding is excluded from the composite average
  const CATEGORY_KEYS = ['conflict', 'climate', 'food_insecurity', 'poverty', 'disease'];
  const totals = {};

  data.forEach((d) => {
    if (!CATEGORY_KEYS.includes(d.category)) return;
    const key = d.country?.trim().toLowerCase();
    if (!key) return;
    const val = Math.max(0, Math.min(1, Number(d.value) / 100));
    if (!totals[key]) totals[key] = {};
    totals[key][d.category] = val;
  });

  const map = {};
  for (const key in totals) {
    const sum = CATEGORY_KEYS.reduce((s, cat) => s + (totals[key][cat] ?? 0), 0);
    map[key] = sum / CATEGORY_KEYS.length;
  }
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
  const containerRef   = useRef(null);
  const globeRef       = useRef(null);
  const [globeReady, setGlobeReady]             = useState(false);
  const [countriesGeoJson, setCountriesGeoJson] = useState(null);
  const [hoveredCountry, setHoveredCountry]     = useState(null);

  const fromMapRef    = useRef({});
  const toMapRef      = useRef({});
  const fadeStartRef  = useRef(null);
  const rafRef        = useRef(null);
  const progressRef   = useRef(1);
  const categoryRef   = useRef(category);

  // Keep categoryRef in sync so applyColors closure always has latest value
  useEffect(() => { categoryRef.current = category; }, [category]);

  useEffect(() => {
    fetch(GEOJSON_URL)
        .then((res) => res.json())
        .then((geojson) => {
          setCountriesGeoJson(geojson.features.filter((d) => d.properties.ISO_A2 !== 'AQ'));
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const canvas = container.querySelector('canvas');
      if (canvas) canvas.remove();
      globeRef.current = null;
      setGlobeReady(false);
    };
  }, []);

  useEffect(() => {
    if (!globeReady || !globeRef.current || !countriesGeoJson) return;

    const newMap = category
        ? buildSeverityMap(data, category)
        : buildAverageSeverityMap(data);

    // Snapshot current interpolated state as the "from" map
    const snapshot = {};
    if (progressRef.current < 1) {
      const prog = progressRef.current;
      const from = fromMapRef.current;
      const to   = toMapRef.current;
      const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);
      for (const k of allKeys) {
        const a = from[k] ?? null;
        const b = to[k]   ?? null;
        if (a !== null && b !== null) snapshot[k] = a + (b - a) * prog;
        else snapshot[k] = b ?? a ?? null;
      }
    } else {
      Object.assign(snapshot, toMapRef.current);
    }

    fromMapRef.current   = snapshot;
    toMapRef.current     = newMap;
    progressRef.current  = 0;
    fadeStartRef.current = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function applyColors(progress) {
      if (!globeRef.current) return;
      const from = fromMapRef.current;
      const to   = toMapRef.current;
      const cat  = categoryRef.current;

      globeRef.current
          .polygonCapColor((d) => {
            if (d === hoveredCountry) return HOVERED_COLOR;
            const tFrom = matchCountry(d.properties, from);
            const tTo   = matchCountry(d.properties, to);
            if (tFrom === null && tTo === null) return NO_DATA_COLOR;
            const tA = tFrom ?? tTo;
            const tB = tTo   ?? tFrom;
            const t  = tA + (tB - tA) * progress;
            return pickColor(cat, t);
          })
          .polygonSideColor((d) => {
            if (d === hoveredCountry) return 'rgba(255,255,180,0.5)';
            const tFrom = matchCountry(d.properties, from);
            const tTo   = matchCountry(d.properties, to);
            if (tFrom === null && tTo === null) return 'rgba(60,90,120,0.2)';
            const tA = tFrom ?? tTo;
            const tB = tTo   ?? tFrom;
            const t  = tA + (tB - tA) * progress;
            return pickColor(cat, t, 0.4);
          })
          .polygonsData([...countriesGeoJson]);
    }

    function tick(now) {
      const elapsed  = now - fadeStartRef.current;
      const progress = Math.min(elapsed / FADE_DURATION, 1);
      progressRef.current = progress;
      applyColors(progress);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    }

    globeRef.current
        .polygonsData(countriesGeoJson)
        .polygonAltitude((d) => (d === hoveredCountry ? 0.1 : 0.04))
        .polygonStrokeColor(() => 'rgba(255,255,255,0.08)')
        .polygonLabel((d) => {
          const { properties: pp } = d;
          const countryRows = data.filter((row) =>
              [pp.ADMIN, pp.NAME, pp.NAME_LONG]
                  .filter(Boolean)
                  .map((s) => s.trim().toLowerCase())
                  .includes(row.country?.trim().toLowerCase())
          );
          let detailHtml = '';
          if (category) {
            const row = countryRows.find((r) => r.category === category);
            detailHtml = row
                ? `<span style="color:#ffd700;">${categoryLabel(category)}</span>: <b>${row.value}</b>/100<br/>
                   <span style="opacity:0.8;font-size:11px;">${row.description || ''}</span>`
                : `<span style="opacity:0.5;">No data for this category</span>`;
          } else {
            detailHtml = countryRows.length
                ? countryRows
                    .filter(r => r.category !== 'funding')
                    .map((r) =>
                        `<span style="color:#aac8e0;">${categoryLabel(r.category)}</span>: <b>${r.value}</b>/100`
                    ).join('<br/>')
                : `<span style="opacity:0.5;">No data available</span>`;
          }
          return `<div style="background:rgba(0,0,0,0.88);color:#e8eaf0;padding:10px 13px;border-radius:7px;font-family:sans-serif;font-size:13px;max-width:250px;pointer-events:none;border:1px solid rgba(255,255,255,0.08);">
            <b style="font-size:14px;display:block;margin-bottom:5px;">${pp.ADMIN}</b>
            ${detailHtml}
            <span style="display:block;margin-top:6px;opacity:0.35;font-size:10px;">Click to explore</span>
          </div>`;
        })
        .polygonsTransitionDuration(400)
        .onPolygonHover((hoverD) => setHoveredCountry(hoverD || null))
        .onPolygonClick((polygon) => {
          if (!onCountryClick) return;
          const { properties: pp } = polygon;
          const t = matchCountry(pp, toMapRef.current);
          const dataPoint = category
              ? data.find(
                  (row) =>
                      row.category === category &&
                      [pp.ADMIN, pp.NAME, pp.NAME_LONG]
                          .filter(Boolean)
                          .map((s) => s.trim().toLowerCase())
                          .includes(row.country?.trim().toLowerCase())
              )
              : null;
          onCountryClick({
            name: pp.ADMIN,
            iso: pp.ISO_A2,
            severity: t,
            value: dataPoint?.value ?? null,
            description: dataPoint?.description ?? null,
            category: category || 'overall',
            geometry: polygon.geometry,
            properties: pp,
            lat: pp.LABEL_Y || 0,
            lng: pp.LABEL_X || 0,
          });
        });

    rafRef.current = requestAnimationFrame(tick);

  }, [globeReady, countriesGeoJson, data, category, hoveredCountry, onCountryClick]);

  return (
      <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
          aria-label="Interactive world globe crisis heatmap"
      />
  );
}