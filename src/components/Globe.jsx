import { useEffect, useRef, useState } from 'react';

function lerpColor(t0, t1, progress) {
  // Interpolate two severity values and return a color
  const t = t0 + (t1 - t0) * progress;
  return severityColor(t);
}

function severityColor(t, alpha = 0.85) {
  if (t === null || t === undefined) return `rgba(60,90,120,${alpha})`;
  // 4-stop gradient: dark-blue → teal → yellow → orange → red
  // 0.0  → (20,  40, 120)  deep blue
  // 0.25 → (20, 160, 160)  teal
  // 0.5  → (220,200,  0)   yellow
  // 0.75 → (240, 80,  0)   orange
  // 1.0  → (210,  0,  0)   red
  let r, g, b;
  if (t < 0.25) {
    const f = t / 0.25;
    r = Math.round(20  + f * (20  - 20));
    g = Math.round(40  + f * (160 - 40));
    b = Math.round(120 + f * (160 - 120));
  } else if (t < 0.5) {
    const f = (t - 0.25) / 0.25;
    r = Math.round(20  + f * (220 - 20));
    g = Math.round(160 + f * (200 - 160));
    b = Math.round(160 + f * (0   - 160));
  } else if (t < 0.75) {
    const f = (t - 0.5) / 0.25;
    r = Math.round(220 + f * (240 - 220));
    g = Math.round(200 + f * (80  - 200));
    b = 0;
  } else {
    const f = (t - 0.75) / 0.25;
    r = Math.round(240 + f * (210 - 240));
    g = Math.round(80  + f * (0   - 80));
    b = 0;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

const NO_DATA_COLOR = 'rgba(60,90,120,0.6)';
const HOVERED_COLOR = 'rgba(255,255,180,0.95)';
const FADE_DURATION = 600; // ms

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
  const totals = {};
  const counts = {};
  data.forEach((d) => {
    const key = d.country?.trim().toLowerCase();
    if (!key) return;
    const val = Math.max(0, Math.min(1, Number(d.value) / 100));
    if (!totals[key]) { totals[key] = 0; counts[key] = 0; }
    totals[key] += val;
    counts[key] += 1;
  });
  const map = {};
  for (const key in totals) map[key] = totals[key] / counts[key];
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
  const [globeReady, setGlobeReady]         = useState(false);
  const [countriesGeoJson, setCountriesGeoJson] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // Fade state — we keep refs so the rAF loop can read latest values
  const fromMapRef   = useRef({});  // severity map we're fading FROM
  const toMapRef     = useRef({});  // severity map we're fading TO
  const fadeStartRef = useRef(null);
  const rafRef       = useRef(null);
  const progressRef  = useRef(1);   // 1 = fully at toMap (no fade in progress)

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

  // When data or category changes, start a fade from current map → new map
  useEffect(() => {
    if (!globeReady || !globeRef.current || !countriesGeoJson) return;

    // Always build average map — used as fallback for countries with no data in selected category
    const avgMap = buildAverageSeverityMap(data);
    const newMap = category
        ? buildSeverityMap(data, category)
        : avgMap;

    // Merge: for any country missing from newMap, fall back to avgMap value
    const mergedMap = { ...avgMap };
    for (const key in newMap) mergedMap[key] = newMap[key];

    // Snapshot current interpolated map as the "from"
    const snapshot = {};
    if (progressRef.current < 1) {
      // Mid-fade: capture the current blended value for each country
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
      // Fully settled — from map is just the current toMap
      Object.assign(snapshot, toMapRef.current);
    }

    fromMapRef.current  = snapshot;
    toMapRef.current    = mergedMap;
    progressRef.current = 0;
    fadeStartRef.current = performance.now();

    // Cancel any existing animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Animate colors
    function tick(now) {
      const elapsed  = now - fadeStartRef.current;
      const progress = Math.min(elapsed / FADE_DURATION, 1);
      progressRef.current = progress;

      // Rebuild color functions with current progress and refresh the globe
      applyColors(progress);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    }

    function applyColors(progress) {
      if (!globeRef.current) return;
      const from = fromMapRef.current;
      const to   = toMapRef.current;

      globeRef.current
          .polygonCapColor((d) => {
            if (d === hoveredCountry) return HOVERED_COLOR;
            const tFrom = matchCountry(d.properties, from);
            const tTo   = matchCountry(d.properties, to);
            if (tFrom === null && tTo === null) return NO_DATA_COLOR;
            const tA = tFrom ?? tTo;
            const tB = tTo   ?? tFrom;
            const t  = tA + (tB - tA) * progress;
            return severityColor(t);
          })
          .polygonSideColor((d) => {
            if (d === hoveredCountry) return 'rgba(255,255,180,0.5)';
            const tFrom = matchCountry(d.properties, from);
            const tTo   = matchCountry(d.properties, to);
            if (tFrom === null && tTo === null) return 'rgba(60,90,120,0.2)';
            const tA = tFrom ?? tTo;
            const tB = tTo   ?? tFrom;
            const t  = tA + (tB - tA) * progress;
            return severityColor(t, 0.4);
          })
          // globe.gl only re-evaluates accessor functions when polygonsData changes.
          // Passing a new array reference on every tick forces it to re-render.
          .polygonsData([...countriesGeoJson]);
    }

    // Set up all the static polygon config only once per data/category change
    globeRef.current
        .polygonsData(countriesGeoJson)
        .polygonAltitude((d) => (d === hoveredCountry ? 0.1 : 0.04))
        .polygonStrokeColor(() => 'rgba(255,255,255,0.08)')
        .polygonLabel((d) => {
          const { properties: pp } = d;
          const t = matchCountry(pp, toMapRef.current);
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
                ? countryRows.map((r) =>
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

    // Kick off the animation
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