import { useMemo, useEffect, useState, useRef, useCallback } from 'react';

const CATEGORIES = [
    { key: 'conflict',        label: 'Conflict',        color: '#e05a4e' },
    { key: 'climate',         label: 'Climate',         color: '#e0a030' },
    { key: 'food_insecurity', label: 'Food Insecurity', color: '#e07830' },
    { key: 'poverty',         label: 'Poverty',         color: '#a055c0' },
    { key: 'disease',         label: 'Disease Burden',  color: '#30a860' },
    { key: 'funding',         label: 'Funding',         color: '#2ecc71' },
];

function severityLabel(t) {
    if (t === null || t === undefined) return { text: 'No Data', color: '#7a8ca0' };
    if (t > 0.75) return { text: 'Critical', color: '#ff3030' };
    if (t > 0.5)  return { text: 'High',     color: '#ff7700' };
    if (t > 0.25) return { text: 'Moderate', color: '#ffcc00' };
    return               { text: 'Low',      color: '#64b4ff' };
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

function getBounds(coords) {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }
    return { minLng, maxLng, minLat, maxLat };
}

function polyCentroid(ring) {
    let x = 0, y = 0;
    for (const [lng, lat] of ring) { x += lng; y += lat; }
    return [x / ring.length, y / ring.length];
}

function polyBboxArea(ring) {
    const b = getBounds(ring);
    return (b.maxLng - b.minLng) * (b.maxLat - b.minLat);
}

function getRelevantPolygons(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
    if (geometry.type === 'MultiPolygon') {
        const outerRings = geometry.coordinates.map(poly => poly[0]);

        // Find largest polygon
        let largest = outerRings[0], largestArea = 0;
        for (const ring of outerRings) {
            const area = polyBboxArea(ring);
            if (area > largestArea) { largestArea = area; largest = ring; }
        }

        // Detect archipelagos: if the full country spans more than 2x the width
        // of its largest island, treat as archipelago and show all major polygons.
        // This handles Indonesia, Philippines, Japan, etc.
        const fullBounds = getBounds(outerRings.flat());
        const fullLngRange = fullBounds.maxLng - fullBounds.minLng;
        const mb = getBounds(largest);
        const largestLngRange = mb.maxLng - mb.minLng;

        if (fullLngRange > largestLngRange * 2) {
            // Archipelago: include all polygons above 0.1% of largest area (skip tiny specks)
            const minArea = largestArea * 0.001;
            return outerRings.filter(ring => polyBboxArea(ring) >= minArea);
        }

        // Compact country (USA, France, etc.): filter to mainland bounding box
        const padLng = (mb.maxLng - mb.minLng) * 0.4;
        const padLat = (mb.maxLat - mb.minLat) * 0.4;
        const exp = { minLng: mb.minLng - padLng, maxLng: mb.maxLng + padLng, minLat: mb.minLat - padLat, maxLat: mb.maxLat + padLat };
        return outerRings.filter(ring => {
            const [cx, cy] = polyCentroid(ring);
            return cx >= exp.minLng && cx <= exp.maxLng && cy >= exp.minLat && cy <= exp.maxLat;
        });
    }
    return [];
}

function projectCoord(lng, lat, bounds, svgW, svgH, padding) {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const lngR = maxLng - minLng || 1;
    const latR = maxLat - minLat || 1;
    const drawW = svgW - padding * 2;
    const drawH = svgH - padding * 2;
    const aspect = lngR / latR;
    let w = drawW, h = drawH;
    if (aspect > drawW / drawH) h = drawW / aspect;
    else w = drawH * aspect;
    const offX = (svgW - w) / 2;
    const offY = (svgH - h) / 2;
    return [offX + ((lng - minLng) / lngR) * w, offY + ((maxLat - lat) / latR) * h];
}

function ringToPath(ring, bounds, svgW, svgH, padding) {
    return ring.map(([lng, lat], i) => {
        const [x, y] = projectCoord(lng, lat, bounds, svgW, svgH, padding);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + ' Z';
}

// ─── Silhouette + Heatmap ─────────────────────────────────────────────────────

function CountrySilhouette({ geometry, severity, heatPoints }) {
    const SVG_W = 500, SVG_H = 440, PAD = 30;

    const { paths, bounds } = useMemo(() => {
        if (!geometry) return { paths: [], bounds: null };
        const rings = getRelevantPolygons(geometry);
        if (!rings.length) return { paths: [], bounds: null };
        const b = getBounds(rings.flat());
        return { paths: rings.map(r => ringToPath(r, b, SVG_W, SVG_H, PAD)), bounds: b };
    }, [geometry]);

    const projectedHeat = useMemo(() => {
        if (!bounds || !heatPoints?.length) return [];
        const padLng = (bounds.maxLng - bounds.minLng) * 0.25;
        const padLat = (bounds.maxLat - bounds.minLat) * 0.25;
        return heatPoints
            .filter(pt => {
                const lng = parseFloat(pt.lng), lat = parseFloat(pt.lat);
                return lng >= bounds.minLng - padLng && lng <= bounds.maxLng + padLng &&
                    lat >= bounds.minLat - padLat && lat <= bounds.maxLat + padLat;
            })
            .map(pt => {
                const [x, y] = projectCoord(parseFloat(pt.lng), parseFloat(pt.lat), bounds, SVG_W, SVG_H, PAD);
                const val = Math.min(1, Math.max(0, parseFloat(pt.value) / 100));
                const cat = CATEGORIES.find(c => c.key === pt.category);
                return { x, y, val, color: cat?.color ?? '#ffffff' };
            });
    }, [heatPoints, bounds]);

    const t = severity ?? 0;
    const baseColor = t > 0.75 ? '#d20000' : t > 0.5 ? '#f05000' : t > 0.25 ? '#dcc800' : t > 0.1 ? '#14a0a0' : '#142880';

    return (
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <radialGradient id="silGrad" cx="50%" cy="45%" r="65%">
                    <stop offset="0%"   stopColor={baseColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={baseColor} stopOpacity="0.04" />
                </radialGradient>
                <filter id="glowF"    x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="ambientF" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="20"/></filter>
                <filter id="heatF"    x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
                <filter id="dotF"     x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <clipPath id="countryClip">{paths.map((d, i) => <path key={i} d={d}/>)}</clipPath>
                <style>{`
          @keyframes silReveal { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes heatReveal { from{opacity:0} to{opacity:1} }
          .sil-g  { transform-origin:50% 50%; animation:silReveal  0.75s cubic-bezier(0.22,1,0.36,1) both; }
          .heat-g { animation:heatReveal 0.5s ease 0.55s both; }
        `}</style>
            </defs>

            <g filter="url(#ambientF)" opacity="0.3">
                {paths.map((d,i) => <path key={i} d={d} fill={baseColor}/>)}
            </g>
            <g className="sil-g">
                {paths.map((d,i) => <path key={i} d={d} fill="url(#silGrad)" stroke={baseColor} strokeWidth="1.5" strokeOpacity="0.55" filter="url(#glowF)"/>)}
            </g>
            {projectedHeat.length > 0 && (
                <g className="heat-g">
                    <g clipPath="url(#countryClip)" filter="url(#heatF)" opacity="0.8">
                        {projectedHeat.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={24 + pt.val * 26} fill={pt.color} opacity={0.22 + pt.val * 0.5}/>)}
                    </g>
                    <g clipPath="url(#countryClip)">
                        {projectedHeat.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={2.5 + pt.val * 3} fill={pt.color} opacity={0.75 + pt.val * 0.25} filter="url(#dotF)"/>)}
                    </g>
                </g>
            )}
        </svg>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBar({ label, value, color, delay }) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setWidth(value ?? 0), 120 + delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    const { text } = severityLabel((value ?? 0) / 100);
    return (
        <div style={sb.row}>
            <div style={sb.topRow}>
                <span style={sb.label}>{label}</span>
                <div style={sb.right}>
                    <span style={{ ...sb.badge, background:`${color}22`, color, border:`1px solid ${color}44` }}>{text}</span>
                    <span style={{ ...sb.val, color }}>{value !== null && value !== undefined ? value : '—'}</span>
                </div>
            </div>
            <div style={sb.track}>
                <div style={{ ...sb.fill, width:`${width}%`, background:`linear-gradient(90deg,${color}66,${color})`, boxShadow:`0 0 8px ${color}55`, transition:'width 0.9s cubic-bezier(0.22,1,0.36,1)' }}/>
            </div>
        </div>
    );
}
const sb = {
    row:    { display:'flex', flexDirection:'column', gap:'6px' },
    topRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
    label:  { fontSize:'0.72rem', color:'#6a8ea8', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" },
    right:  { display:'flex', alignItems:'center', gap:'8px' },
    badge:  { fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.1em', borderRadius:'4px', padding:'2px 6px', textTransform:'uppercase' },
    val:    { fontSize:'0.9rem', fontWeight:700, fontFamily:"'DM Sans',sans-serif", minWidth:'28px', textAlign:'right' },
    track:  { height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' },
    fill:   { height:'100%', borderRadius:'2px', width:0 },
};

function StatCard({ label, value, sub }) {
    return (
        <div style={sc.card}>
            <div style={sc.label}>{label}</div>
            <div style={sc.value}>{value}</div>
            {sub && <div style={sc.sub}>{sub}</div>}
        </div>
    );
}
const sc = {
    card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', padding:'12px 14px', display:'flex', flexDirection:'column', gap:'4px' },
    label: { fontSize:'0.6rem', color:'#3a6a8a', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" },
    value: { fontSize:'1.1rem', fontWeight:700, color:'#d0e4f4', fontFamily:"'DM Sans',sans-serif", lineHeight:1.1 },
    sub:   { fontSize:'0.62rem', color:'#3a5a70', fontFamily:"'DM Sans',sans-serif" },
};

function HeatLegend({ activeCategories }) {
    if (!activeCategories.length) return null;
    return (
        <div style={hl.wrap}>
            <div style={hl.title}>Heatmap Legend</div>
            <div style={hl.items}>
                {activeCategories.map(cat => (
                    <div key={cat.key} style={hl.item}>
                        <div style={{ ...hl.dot, background:cat.color, boxShadow:`0 0 5px ${cat.color}` }}/>
                        <span style={hl.label}>{cat.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
const hl = {
    wrap:  { display:'flex', flexDirection:'column', gap:'6px', padding:'10px 14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'8px' },
    title: { fontSize:'0.55rem', fontWeight:700, letterSpacing:'0.2em', color:'#2a4a62', textTransform:'uppercase' },
    items: { display:'flex', flexWrap:'wrap', gap:'8px 14px' },
    item:  { display:'flex', alignItems:'center', gap:'6px' },
    dot:   { width:'7px', height:'7px', borderRadius:'50%', flexShrink:0 },
    label: { fontSize:'0.65rem', color:'#5a8aa8', fontFamily:"'DM Sans',sans-serif" },
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

const ANIM_MS = 380;

export default function CountryPanel({ country, onClose, allData }) {
    // ── ALL HOOKS MUST COME FIRST — before any conditional returns ──
    const [phase, setPhase] = useState('hidden');
    const timerRef = useRef(null);

    useEffect(() => {
        if (country) {
            setPhase('entering');
            const t = setTimeout(() => setPhase('visible'), 30);
            return () => clearTimeout(t);
        }
    }, [country?.name]);

    const handleClose = useCallback(() => {
        setPhase('exiting');
        timerRef.current = setTimeout(() => {
            setPhase('hidden');
            onClose();
        }, ANIM_MS);
    }, [onClose]);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) handleClose();
    }, [handleClose]);

    // Derived data — must also be hooks, called unconditionally
    const { categoryValues, heatPoints, activeCategories } = useMemo(() => {
        const acc = {};
        const pts = [];
        const activeCatKeys = new Set();

        const norm = (s) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
        const countryNorm = norm(country?.name);
        const isoNorm     = norm(country?.iso);

        // Use pre-filtered rows if passed directly (preferred), otherwise search allData
        const rowsToSearch = country?.rows ?? allData ?? [];

        if (!country?.rows && allData?.length) {
            // Debug: log the first few country names so mismatches are easy to spot
            const sample = [...new Set(allData.slice(0, 200).map(r => r.country ?? r.Country ?? ''))].slice(0, 8);
            console.log('[CountryPanel] Looking for:', JSON.stringify(country?.name), '| Sample CSV names:', sample);
        }

        for (const row of rowsToSearch) {
            // If using pre-filtered rows, skip the name check entirely
            if (!country?.rows) {
                const rowNorm = norm(row.country ?? row.Country ?? row.name ?? row.COUNTRY ?? '');
                const rowIso  = norm(row.iso ?? row.ISO ?? row.iso_code ?? row.ISO_A2 ?? row.ISO_A3 ?? '');
                const nameMatch = rowNorm === countryNorm || rowNorm.includes(countryNorm) || countryNorm.includes(rowNorm);
                const isoMatch  = isoNorm && rowIso && rowIso === isoNorm;
                if (!nameMatch && !isoMatch) continue;
            }
            const cat = CATEGORIES.find(c => c.key === norm(row.category ?? row.Category ?? row.CATEGORY ?? ''));
            if (!cat) continue;
            const v = parseFloat(row.value);
            if (!isNaN(v)) {
                if (!acc[cat.key]) acc[cat.key] = { sum: 0, n: 0 };
                acc[cat.key].sum += v;
                acc[cat.key].n   += 1;
            }
            if (row.lat && row.lng) {
                pts.push({ lat: row.lat, lng: row.lng, value: row.value, category: row.category });
                activeCatKeys.add(cat.key);
            }
        }
        const vals = {};
        for (const cat of CATEGORIES) {
            vals[cat.key] = acc[cat.key] ? Math.round(acc[cat.key].sum / acc[cat.key].n) : null;
        }
        return {
            categoryValues: vals,
            heatPoints: pts,
            activeCategories: CATEGORIES.filter(c => activeCatKeys.has(c.key)),
        };
    }, [allData, country?.name]);

    // ── NOW it's safe to conditionally render nothing ──
    if (!country || phase === 'hidden') return null;

    const show    = phase === 'visible';
    const exiting = phase === 'exiting';
    const opacity = show ? 1 : 0;
    const slideL  = show ? '0px' : '-40px';
    const slideR  = show ? '0px' : '40px';

    const population  = country.properties?.POP_EST    ? Number(country.properties.POP_EST).toLocaleString()    : 'N/A';
    const area        = country.properties?.AREA_KM2   ? `${Number(country.properties.AREA_KM2).toLocaleString()} km²` : country.properties?.area ? `${Number(country.properties.area).toLocaleString()} km²` : 'N/A';
    const gdp         = country.properties?.GDP_MD_EST ? `$${Number(country.properties.GDP_MD_EST).toLocaleString()}M` : 'N/A';
    const region      = country.properties?.REGION_WB  || country.properties?.SUBREGION || 'N/A';
    const incomeGroup = country.properties?.INCOME_GRP || 'N/A';
    const economy     = country.properties?.ECONOMY;

    // Composite = average across all 5 categories, missing data counts as 0
    const overallSev = CATEGORIES.reduce((sum, c) => sum + (categoryValues[c.key] ?? 0), 0) / CATEGORIES.length / 100;

    const { text: sevText, color: sevColor } = severityLabel(overallSev);
    const trans = `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1)`;

    return (
        <>
            <style>{`
        @keyframes nameReveal {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

            {/* Backdrop */}
            <div
                onClick={handleBackdropClick}
                style={{ ...p.overlay, opacity, transition:`opacity ${ANIM_MS}ms ease`, pointerEvents: exiting ? 'none' : 'auto' }}
            >
                {/* LEFT — silhouette */}
                <div style={{ ...p.left, opacity, transform:`translateX(${slideL})`, transition: trans }}>
                    <div style={p.isoChip}>{country.iso || '—'}</div>
                    <div style={p.nameBlock}>
                        <h1 style={{ ...p.countryName, animation: show ? 'nameReveal 0.65s cubic-bezier(0.22,1,0.36,1) 0.08s both' : 'none' }}>
                            {country.name}
                        </h1>
                        <div style={{ ...p.sevBadge, background:`${sevColor}22`, color:sevColor, border:`1px solid ${sevColor}44` }}>
                            {sevText} Risk
                        </div>
                    </div>

                    <div style={p.silhouetteContainer}>
                        <CountrySilhouette geometry={country.geometry} severity={overallSev} heatPoints={heatPoints}/>
                    </div>

                    {activeCategories.length > 0 && (
                        <div style={{ width:'100%', maxWidth:'420px' }}>
                            <HeatLegend activeCategories={activeCategories}/>
                        </div>
                    )}
                    <div style={p.regionTag}>{region}</div>
                </div>

                {/* RIGHT — details (stopPropagation prevents backdrop close) */}
                <div onClick={e => e.stopPropagation()} style={{ ...p.right, opacity, transform:`translateX(${slideR})`, transition: trans }}>
                    <button style={p.closeBtn} onClick={handleClose}>✕</button>
                    <div style={p.rightScroll}>

                        <div style={p.sectionLabel}>Overview</div>
                        <div style={p.statsGrid}>
                            <StatCard label="Population" value={population} />
                            <StatCard label="GDP"        value={gdp}        />
                            <StatCard label="Area"       value={area}       />
                            <StatCard label="Funding"    value={
                                categoryValues['funding'] !== null && categoryValues['funding'] !== undefined
                                    ? `${categoryValues['funding']}/100`
                                    : 'N/A'
                            } />
                        </div>

                        <div style={p.divider}/>
                        <div style={p.sectionLabel}>Crisis Indices</div>
                        <div style={p.barsBlock}>
                            {CATEGORIES.filter(cat => cat.key !== 'funding').map((cat, i) => (
                                <SeverityBar key={cat.key} label={cat.label} value={categoryValues[cat.key]} color={cat.color} delay={i * 80}/>
                            ))}
                        </div>

                        <div style={p.divider}/>
                        <div style={p.sectionLabel}>Overall Severity</div>
                        <div style={p.overallBlock}>
                            <div style={{ ...p.overallScore, color: sevColor }}>
                                {overallSev !== null ? Math.round(overallSev * 100) : '—'}
                            </div>
                            <div style={p.overallMeta}>
                                <div style={{ ...p.overallLabel, color: sevColor }}>{sevText}</div>
                                <div style={p.overallSub}>composite risk score</div>
                            </div>
                            <div style={p.overallBar}>
                                <div style={{ ...p.overallFill, width: overallSev !== null ? `${overallSev * 100}%` : '0%', background:`linear-gradient(90deg,${sevColor}66,${sevColor})`, boxShadow:`0 0 12px ${sevColor}55` }}/>
                            </div>
                        </div>

                        {country.description && (
                            <>
                                <div style={p.divider}/>
                                <div style={p.sectionLabel}>Situation</div>
                                <p style={p.description}>{country.description}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const p = {
    overlay:     { position:'fixed', inset:0, zIndex:100, display:'flex', background:'rgba(4,9,20,0.97)', fontFamily:"'DM Sans','Helvetica Neue',sans-serif", backdropFilter:'blur(2px)' },
    left:        { flex:'0 0 48%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 40px 36px', position:'relative', borderRight:'1px solid rgba(80,140,220,0.1)', background:'radial-gradient(ellipse at 50% 55%, rgba(20,40,80,0.45) 0%, transparent 70%)', gap:'14px' },
    right:       { flex:'0 0 52%', display:'flex', flexDirection:'column', position:'relative', background:'rgba(6,12,26,0.5)' },
    rightScroll: { flex:1, overflowY:'auto', padding:'52px 40px 40px', display:'flex', flexDirection:'column', gap:'16px' },
    closeBtn:    { position:'absolute', top:'18px', right:'18px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#8ab0c8', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 },
    isoChip:     { position:'absolute', top:'24px', left:'32px', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.2em', color:'#2a5070', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'4px 8px' },
    nameBlock:   { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' },
    countryName: { margin:0, fontSize:'clamp(1.5rem,3vw,2.6rem)', fontWeight:800, color:'#dce8f4', letterSpacing:'0.1em', textTransform:'uppercase', lineHeight:1 },
    sevBadge:    { fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', borderRadius:'6px', padding:'4px 12px' },
    silhouetteContainer: { width:'100%', maxWidth:'460px', aspectRatio:'1.15', flex:'0 0 auto' },
    regionTag:   { position:'absolute', bottom:'20px', fontSize:'0.6rem', color:'#1e3a50', letterSpacing:'0.12em', textTransform:'uppercase' },
    sectionLabel:{ fontSize:'0.55rem', fontWeight:700, letterSpacing:'0.22em', color:'#2a4a62', textTransform:'uppercase', marginBottom:'2px' },
    statsGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' },
    divider:     { height:'1px', background:'rgba(80,140,220,0.07)', margin:'2px 0' },
    barsBlock:   { display:'flex', flexDirection:'column', gap:'14px' },
    overallBlock:{ display:'flex', alignItems:'center', gap:'20px', padding:'16px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'10px', flexWrap:'wrap' },
    overallScore:{ fontSize:'3.5rem', fontWeight:800, lineHeight:1, letterSpacing:'-0.04em' },
    overallMeta: { flex:1, display:'flex', flexDirection:'column', gap:'2px' },
    overallLabel:{ fontSize:'1rem', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase' },
    overallSub:  { fontSize:'0.65rem', color:'#2a4a62', letterSpacing:'0.08em' },
    overallBar:  { width:'100%', height:'5px', background:'rgba(255,255,255,0.04)', borderRadius:'3px', overflow:'hidden' },
    overallFill: { height:'100%', borderRadius:'3px', transition:'width 1s cubic-bezier(0.22,1,0.36,1) 0.3s' },
    description: { margin:0, fontSize:'0.82rem', color:'#6a8aa4', lineHeight:1.7 },
};