import { useMemo, useEffect, useState, useRef, useCallback } from 'react';

const GEMINI_API_KEY = 'AIzaSyCXWJjCBBbV2kMjpbxS68aO4hVCVyaFVqQ';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const CATEGORIES = [
    { key: 'conflict',        label: 'Conflict',        color: '#e05a4e' },
    { key: 'climate',         label: 'Climate',         color: '#e0a030' },
    { key: 'food_insecurity', label: 'Food Insecurity', color: '#e07830' },
    { key: 'poverty',         label: 'Poverty',         color: '#a055c0' },
    { key: 'disease',         label: 'Disease Burden',  color: '#30a860' },
];

const CRISIS_KEYS = CATEGORIES.map(c => c.key);

const TABS = [
    { key: 'main', label: 'Details' },
    { key: 'news', label: 'News'    },
];

function severityLabel(t) {
    if (t === null || t === undefined) return { text: 'No Data', color: '#7a8ca0' };
    if (t > 0.75) return { text: 'Critical', color: '#ff3030' };
    if (t > 0.5)  return { text: 'High',     color: '#ff7700' };
    if (t > 0.25) return { text: 'Moderate', color: '#ffcc00' };
    return               { text: 'Low',      color: '#64b4ff' };
}

// ─── EXACT name normalizer — no substring matching ────────────────────────────
function norm(s) {
    return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Maps GeoJSON ADMIN names → CSV country names.
// country.name arrives from GeoJSON; CSV uses shorter/common names for many countries.
const GEOJSON_TO_CSV = {
    'democratic republic of the congo':    'democratic republic of congo',
    'republic of congo':                   'congo (republic)',
    "côte d'ivoire":                       'ivory coast',
    'united states of america':            'united states',
    'russian federation':                  'russia',
    'republic of korea':                   'south korea',
    'dem. rep. korea':                     'north korea',
    'syrian arab republic':                'syria',
    'islamic republic of iran':            'iran',
    'united republic of tanzania':         'tanzania',
    'plurinational state of bolivia':      'bolivia',
    'bolivarian republic of venezuela':    'venezuela',
    'viet nam':                            'vietnam',
    "lao people's democratic republic":    'laos',
    'republic of moldova':                 'moldova',
    'macedonia':                           'north macedonia',
    'swaziland':                           'eswatini',
    'cape verde':                          'cabo verde',
    'east timor':                          'timor-leste',
    'türkiye':                             'turkey',
    'czech republic':                      'czechia',
    'brunei darussalam':                   'brunei',
    'são tomé and príncipe':               'sao tome and principe',
};

function rowMatchesCountry(row, countryName, countryIso) {
    const rowName = norm(row.country ?? row.Country ?? row.name ?? row.COUNTRY ?? '');
    const rowIso  = norm(row.iso ?? row.ISO ?? row.iso_code ?? row.ISO_A2 ?? row.ISO_A3 ?? '');
    // Resolve GeoJSON ADMIN name → CSV name before comparing
    const cn = GEOJSON_TO_CSV[norm(countryName)] ?? norm(countryName);
    const ci = norm(countryIso);
    // Exact name match only — prevents "sudan" matching "south sudan"
    if (rowName === cn) return true;
    // ISO exact match as safe fallback
    if (ci && ci !== '-1' && rowIso && rowIso === ci) return true;
    return false;
}

// ─── World Bank Data Hook ─────────────────────────────────────────────────────

function useWorldBankData(iso2) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);
    const fetchedFor = useRef(null);

    useEffect(() => {
        if (!iso2 || iso2 === '-1' || fetchedFor.current === iso2) return;
        fetchedFor.current = iso2;
        setLoading(true);

        const base = `https://api.worldbank.org/v2/country/${iso2}/indicator`;
        const params = `?format=json&mrv=1&per_page=1`;

        const fetchIndicator = (indicator) =>
            fetch(`${base}/${indicator}${params}`)
                .then(r => r.json())
                .then(json => json?.[1]?.[0]?.value ?? null)
                .catch(() => null);

        Promise.all([
            fetchIndicator('SP.POP.TOTL'),
            fetchIndicator('NY.GDP.MKTP.CD'),
            fetchIndicator('AG.SRF.TOTL.K2'),
        ]).then(([population, gdp, area]) => {
            setData({ population, gdp, area });
        }).finally(() => setLoading(false));
    }, [iso2]);

    return { data, loading };
}

function formatPopulation(val) {
    if (val == null) return 'N/A';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
    return val.toLocaleString();
}

function formatGDP(val) {
    if (val == null) return 'N/A';
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6)  return `$${(val / 1e6).toFixed(0)}M`;
    return `$${val.toLocaleString()}`;
}

function formatArea(val) {
    if (val == null) return 'N/A';
    return `${Number(val).toLocaleString()} km²`;
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
        let largest = outerRings[0], largestArea = 0;
        for (const ring of outerRings) {
            const area = polyBboxArea(ring);
            if (area > largestArea) { largestArea = area; largest = ring; }
        }
        const fullBounds = getBounds(outerRings.flat());
        const fullLngRange = fullBounds.maxLng - fullBounds.minLng;
        const mb = getBounds(largest);
        const largestLngRange = mb.maxLng - mb.minLng;
        if (fullLngRange > largestLngRange * 2) {
            const minArea = largestArea * 0.001;
            return outerRings.filter(ring => polyBboxArea(ring) >= minArea);
        }
        const padLng = (mb.maxLng - mb.minLng) * 0.4;
        const padLat = (mb.maxLat - mb.minLat) * 0.4;
        const exp = {
            minLng: mb.minLng - padLng, maxLng: mb.maxLng + padLng,
            minLat: mb.minLat - padLat, maxLat: mb.maxLat + padLat,
        };
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

// ─── Silhouette ───────────────────────────────────────────────────────────────

function CountrySilhouette({ geometry, severity }) {
    const SVG_W = 500, SVG_H = 440, PAD = 30;

    const { paths } = useMemo(() => {
        if (!geometry) return { paths: [] };
        const rings = getRelevantPolygons(geometry);
        if (!rings.length) return { paths: [] };
        const b = getBounds(rings.flat());
        return { paths: rings.map(r => ringToPath(r, b, SVG_W, SVG_H, PAD)) };
    }, [geometry]);

    const t = severity ?? 0;
    const baseColor = t > 0.75 ? '#d20000' : t > 0.5 ? '#f05000' : t > 0.25 ? '#dcc800' : t > 0.1 ? '#14a0a0' : '#142880';

    return (
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <radialGradient id="silGrad" cx="50%" cy="45%" r="65%">
                    <stop offset="0%"   stopColor={baseColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={baseColor} stopOpacity="0.04" />
                </radialGradient>
                <filter id="glowF" x="-15%" y="-15%" width="130%" height="130%">
                    <feGaussianBlur stdDeviation="3.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="ambientF" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="20"/>
                </filter>
                <style>{`
                    @keyframes silReveal {
                        from { opacity:0; transform:scale(0.93) translateY(10px); }
                        to   { opacity:1; transform:scale(1) translateY(0); }
                    }
                    .sil-g { transform-origin:50% 50%; animation:silReveal 0.75s cubic-bezier(0.22,1,0.36,1) both; }
                `}</style>
            </defs>
            <g filter="url(#ambientF)" opacity="0.3">
                {paths.map((d,i) => <path key={i} d={d} fill={baseColor}/>)}
            </g>
            <g className="sil-g">
                {paths.map((d,i) => (
                    <path key={i} d={d} fill="url(#silGrad)" stroke={baseColor} strokeWidth="1.5" strokeOpacity="0.55" filter="url(#glowF)"/>
                ))}
            </g>
        </svg>
    );
}

// ─── News Panel ───────────────────────────────────────────────────────────────

function NewsPanel({ countryName }) {
    const [articles, setArticles] = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState(null);
    const fetchedFor = useRef(null);

    const doFetch = useCallback(() => {
        if (!countryName) return;
        fetchedFor.current = countryName;
        setLoading(true);
        setError(null);
        setArticles([]);

        const prompt = `You are a news research assistant with knowledge of world events up to early 2025. Generate a JSON array of exactly 10 realistic, representative news articles about ${countryName}. These should reflect the kinds of stories that reputable outlets like Reuters, BBC News, AP News, Al Jazeera, The Guardian, NPR, or Bloomberg would cover about this country — focusing on politics, economy, humanitarian issues, conflict, climate, or society.

Return ONLY a raw JSON array with no markdown formatting, no code blocks, no backticks, and no explanation text before or after. The response must start with [ and end with ].

Each object in the array must have exactly these fields:
{
  "title": "A realistic news headline",
  "source": "One of: Reuters, BBC News, AP News, Al Jazeera, The Guardian, NPR, Bloomberg, AFP",
  "date": "A date in 2024 or early 2025 formatted as Mon YYYY e.g. Jan 2025",
  "summary": "Two to three sentences summarizing the article content.",
  "category": "One of: Politics, Conflict, Economy, Climate, Society, Health, Humanitarian"
}`;

        fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 3000 },
            }),
        })
            .then(async r => {
                const json = await r.json();
                if (!r.ok) throw new Error(json?.error?.message || `HTTP ${r.status}`);
                return json;
            })
            .then(data => {
                const raw   = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
                const match = clean.match(/\[[\s\S]*\]/);
                if (!match) throw new Error('No JSON array found in response');
                setArticles(JSON.parse(match[0]));
            })
            .catch(err => setError(`Failed to load news: ${err.message}`))
            .finally(() => setLoading(false));
    }, [countryName]);

    useEffect(() => {
        if (!countryName || fetchedFor.current === countryName) return;
        doFetch();
    }, [countryName, doFetch]);

    const categoryColor = (cat) => ({
        Politics: '#3a8fd4', Conflict: '#e05a4e', Economy: '#e0a030',
        Climate: '#30b890', Society: '#a055c0', Health: '#30a860', Humanitarian: '#e07830',
    }[cat] || '#5a8aa8');

    if (loading) return (
        <div style={nw.centered}>
            <div style={nw.spinner} />
            <div style={nw.loadingText}>Fetching latest news for {countryName}…</div>
        </div>
    );

    if (error) return (
        <div style={nw.centered}>
            <div style={nw.errorText}>{error}</div>
            <button onClick={() => { fetchedFor.current = null; setError(null); doFetch(); }} style={nw.retryBtn}>
                Retry
            </button>
        </div>
    );

    return (
        <div style={nw.list}>
            {articles.map((a, i) => (
                <div key={i} style={nw.card}>
                    <div style={nw.cardTop}>
                        <span style={{ ...nw.catBadge, background:`${categoryColor(a.category)}22`, color:categoryColor(a.category), border:`1px solid ${categoryColor(a.category)}44` }}>
                            {a.category}
                        </span>
                        <span style={nw.date}>{a.date}</span>
                    </div>
                    <div style={nw.title}>{a.title}</div>
                    <div style={nw.summary}>{a.summary}</div>
                    <div style={nw.source}>{a.source}</div>
                </div>
            ))}
        </div>
    );
}

const nw = {
    centered:    { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'60px 20px', flex:1 },
    spinner:     { width:'28px', height:'28px', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.08)', borderTopColor:'#3a8fd4', animation:'spin 0.8s linear infinite' },
    loadingText: { fontSize:'0.75rem', color:'#3a6a8a', letterSpacing:'0.06em', textAlign:'center' },
    errorText:   { fontSize:'0.78rem', color:'#e05a4e', textAlign:'center', lineHeight:1.6 },
    retryBtn:    { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'#5a8aa8', padding:'8px 20px', fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.08em', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" },
    list:        { display:'flex', flexDirection:'column', gap:'12px' },
    card:        { background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'10px', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'8px' },
    cardTop:     { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' },
    catBadge:    { fontSize:'0.55rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', borderRadius:'4px', padding:'2px 7px' },
    date:        { fontSize:'0.62rem', color:'#2a4a62', letterSpacing:'0.04em' },
    title:       { fontSize:'0.85rem', fontWeight:700, color:'#c8dcea', lineHeight:1.4, fontFamily:"'DM Sans',sans-serif" },
    summary:     { fontSize:'0.73rem', color:'#4a6a80', lineHeight:1.65 },
    source:      { fontSize:'0.62rem', color:'#2a5a78', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' },
};

// ─── SeverityBar — now with expandable description ────────────────────────────

function SeverityBar({ label, value, color, delay, description }) {
    const [width,    setWidth]    = useState(0);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setWidth(value ?? 0), 120 + delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    const { text } = severityLabel((value ?? 0) / 100);
    const hasDesc  = !!description;

    return (
        <div style={sb.wrapper}>
            <div style={sb.row}>
                <div style={sb.topRow}>
                    <span style={sb.label}>{label}</span>
                    <div style={sb.right}>
                        <span style={{ ...sb.badge, background:`${color}22`, color, border:`1px solid ${color}44` }}>{text}</span>
                        <span style={{ ...sb.val, color }}>{value !== null && value !== undefined ? value : '—'}</span>
                        {hasDesc && (
                            <button
                                onClick={() => setExpanded(e => !e)}
                                title={expanded ? 'Hide details' : 'Show details'}
                                style={{ ...sb.expandBtn, color: expanded ? color : '#2a4a62' }}
                            >
                                {expanded ? '▲' : '▼'}
                            </button>
                        )}
                    </div>
                </div>
                <div style={sb.track}>
                    <div style={{
                        ...sb.fill,
                        width: `${width}%`,
                        background: `linear-gradient(90deg,${color}66,${color})`,
                        boxShadow: `0 0 8px ${color}55`,
                        transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
                    }}/>
                </div>
            </div>
            {/* Expandable description */}
            {hasDesc && expanded && (
                <div style={{ ...sb.desc, borderLeft: `2px solid ${color}55` }}>
                    {description}
                </div>
            )}
        </div>
    );
}

const sb = {
    wrapper:   { display:'flex', flexDirection:'column', gap:'4px' },
    row:       { display:'flex', flexDirection:'column', gap:'6px' },
    topRow:    { display:'flex', justifyContent:'space-between', alignItems:'center' },
    label:     { fontSize:'0.72rem', color:'#6a8ea8', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" },
    right:     { display:'flex', alignItems:'center', gap:'8px' },
    badge:     { fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.1em', borderRadius:'4px', padding:'2px 6px', textTransform:'uppercase' },
    val:       { fontSize:'0.9rem', fontWeight:700, fontFamily:"'DM Sans',sans-serif", minWidth:'28px', textAlign:'right' },
    track:     { height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden' },
    fill:      { height:'100%', borderRadius:'2px', width:0 },
    expandBtn: { background:'none', border:'none', cursor:'pointer', fontSize:'0.5rem', padding:'0 2px', lineHeight:1, transition:'color 0.15s' },
    desc:      { fontSize:'0.72rem', color:'#4a6a80', lineHeight:1.65, padding:'8px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'0 6px 6px 0', marginTop:'2px' },
};

function StatCard({ label, value, loading }) {
    return (
        <div style={sc.card}>
            <div style={sc.label}>{label}</div>
            <div style={{ ...sc.value, opacity: loading ? 0.4 : 1 }}>
                {loading ? '…' : value}
            </div>
        </div>
    );
}
const sc = {
    card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', padding:'12px 14px', display:'flex', flexDirection:'column', gap:'4px' },
    label: { fontSize:'0.6rem', color:'#3a6a8a', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:"'DM Sans',sans-serif" },
    value: { fontSize:'1.1rem', fontWeight:700, color:'#d0e4f4', fontFamily:"'DM Sans',sans-serif", lineHeight:1.1, transition:'opacity 0.3s' },
};

function BigScoreBlock({ label, score, color, sub, prominent }) {
    return (
        <div style={{
            display:'flex', alignItems:'center', gap:'20px',
            padding: prominent ? '16px' : '12px 16px',
            background: prominent ? 'rgba(255,255,255,0.02)' : 'transparent',
            border: `1px solid ${prominent ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)'}`,
            borderRadius:'10px', flexWrap:'wrap', opacity: prominent ? 1 : 0.7,
        }}>
            <div style={{ fontSize: prominent ? '3.5rem' : '2.2rem', fontWeight:800, lineHeight:1, letterSpacing:'-0.04em', color }}>
                {score !== null && score !== undefined ? Math.round(score) : '—'}
            </div>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'2px' }}>
                <div style={{ fontSize: prominent ? '1rem' : '0.75rem', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', color }}>{label}</div>
                <div style={{ fontSize:'0.65rem', color:'#2a4a62', letterSpacing:'0.08em' }}>{sub}</div>
            </div>
            <div style={{ width:'100%', height: prominent ? '5px' : '3px', background:'rgba(255,255,255,0.04)', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{
                    height:'100%', borderRadius:'3px',
                    width: score !== null && score !== undefined ? `${Math.min(score, 100)}%` : '0%',
                    background: `linear-gradient(90deg,${color}66,${color})`,
                    boxShadow: `0 0 12px ${color}55`,
                    transition: 'width 1s cubic-bezier(0.22,1,0.36,1) 0.3s',
                }}/>
            </div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const ANIM_MS = 380;

export default function CountryPanel({ country, onClose, allData }) {
    const [phase,     setPhase]     = useState('hidden');
    const [activeTab, setActiveTab] = useState('main');
    const timerRef = useRef(null);

    const iso2 = country?.iso ?? country?.properties?.ISO_A2 ?? null;
    const { data: wbData, loading: wbLoading } = useWorldBankData(iso2);

    useEffect(() => {
        if (country) {
            setPhase('entering');
            setActiveTab('main');
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

    // ── Collect values AND descriptions per category ──────────────────────────
    const { categoryValues, categoryDescriptions } = useMemo(() => {
        const acc   = {};   // { key: { sum, n } }
        const descs = {};   // { key: string }

        const rowsToSearch = country?.rows ?? allData ?? [];

        for (const row of rowsToSearch) {
            // Skip rows that don't belong to this country
            if (!country?.rows && !rowMatchesCountry(row, country?.name, country?.iso)) continue;

            const allCats = [
                ...CATEGORIES,
                { key: 'funding',   color: '#2ecc71' },
                { key: 'disparity', color: '#9b6dff' },
            ];
            const catKey = norm(row.category ?? row.Category ?? row.CATEGORY ?? '');
            const cat    = allCats.find(c => c.key === catKey);
            if (!cat) continue;

            const v = parseFloat(row.value);
            if (!isNaN(v)) {
                if (!acc[cat.key]) acc[cat.key] = { sum: 0, n: 0 };
                acc[cat.key].sum += v;
                acc[cat.key].n   += 1;
            }

            // ── FIX: capture the description for this category ──
            const desc = (row.description ?? row.Description ?? row.DESCRIPTION ?? '').trim();
            if (desc) descs[cat.key] = desc;
        }

        const vals = {};
        for (const key of [...CRISIS_KEYS, 'funding', 'disparity']) {
            vals[key] = acc[key] ? Math.round(acc[key].sum / acc[key].n) : null;
        }
        return { categoryValues: vals, categoryDescriptions: descs };
    }, [allData, country?.name, country?.iso]);

    if (!country || phase === 'hidden') return null;

    const show    = phase === 'visible';
    const exiting = phase === 'exiting';
    const opacity = show ? 1 : 0;
    const slideL  = show ? '0px' : '-40px';
    const slideR  = show ? '0px' : '40px';
    const trans   = `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1)`;

    const region = country.properties?.REGION_WB || country.properties?.SUBREGION || 'N/A';

    const overallSev   = CRISIS_KEYS.reduce((sum, k) => sum + (categoryValues[k] ?? 0), 0) / CRISIS_KEYS.length;
    const fundingVal   = categoryValues['funding'];
    // Disparity = inverse of funding. 0 funding = no data (not max disparity).
    const disparityVal = (fundingVal !== null && fundingVal > 0) ? Math.round(100 - fundingVal) : null;

    const { text: sevText, color: sevColor } = severityLabel(overallSev / 100);

    const population = formatPopulation(wbData?.population);
    const gdp        = formatGDP(wbData?.gdp);
    const area       = formatArea(wbData?.area);

    return (
        <>
            <style>{`
                @keyframes nameReveal { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <div
                onClick={handleBackdropClick}
                style={{ ...p.overlay, opacity, transition:`opacity ${ANIM_MS}ms ease`, pointerEvents: exiting ? 'none' : 'auto' }}
            >
                {/* LEFT */}
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
                        <CountrySilhouette geometry={country.geometry} severity={overallSev / 100} />
                    </div>
                    <div style={p.regionTag}>{region}</div>
                </div>

                {/* RIGHT */}
                <div onClick={e => e.stopPropagation()} style={{ ...p.right, opacity, transform:`translateX(${slideR})`, transition: trans }}>
                    <button style={p.closeBtn} onClick={handleClose}>✕</button>

                    <div style={p.tabBar}>
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    ...p.tabBtn,
                                    color: activeTab === tab.key ? '#c8dcea' : '#2a4a62',
                                    borderBottom: activeTab === tab.key ? '2px solid #3a8fd4' : '2px solid transparent',
                                }}
                            >
                                {tab.label}
                                {tab.key === 'news' && <span style={p.aiBadge}>AI</span>}
                            </button>
                        ))}
                    </div>

                    <div style={p.rightScroll}>
                        {activeTab === 'main' && (
                            <>
                                <div style={p.sectionLabel}>Overview</div>
                                <div style={p.statsGrid}>
                                    <StatCard label="Population" value={population} loading={wbLoading} />
                                    <StatCard label="GDP"        value={gdp}        loading={wbLoading} />
                                    <StatCard label="Area"       value={area}       loading={wbLoading} />
                                    <StatCard label="Funding"    value={fundingVal !== null ? `${fundingVal}/100` : 'N/A'} loading={false} />
                                </div>

                                <div style={p.divider}/>

                                <div style={{ ...p.sectionLabel, display:'flex', alignItems:'center', gap:'8px' }}>
                                    Crisis Indices
                                    <span style={p.hintTag}>▼ expand for details</span>
                                </div>
                                <div style={p.barsBlock}>
                                    {CATEGORIES.map((cat, i) => (
                                        <SeverityBar
                                            key={cat.key}
                                            label={cat.label}
                                            value={categoryValues[cat.key]}
                                            color={cat.color}
                                            delay={i * 80}
                                            description={categoryDescriptions[cat.key] ?? null}
                                        />
                                    ))}
                                </div>

                                <div style={p.divider}/>

                                <div style={p.sectionLabel}>Scores</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                                    <BigScoreBlock
                                        label={`${sevText} — Overall Severity`}
                                        score={Math.round(overallSev)}
                                        color={sevColor}
                                        sub="composite crisis score"
                                        prominent={false}
                                    />
                                    <BigScoreBlock
                                        label="Disparity"
                                        score={disparityVal}
                                        color="#9b6dff"
                                        sub="inequality index"
                                        prominent={true}
                                    />
                                </div>

                                {country.description && (
                                    <>
                                        <div style={p.divider}/>
                                        <div style={p.sectionLabel}>Situation</div>
                                        <p style={p.description}>{country.description}</p>
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'news' && (
                            <>
                                <div style={{ ...p.sectionLabel, display:'flex', alignItems:'center', gap:'8px' }}>
                                    Latest News
                                    <span style={p.aiTag}>Powered by Gemini</span>
                                </div>
                                <NewsPanel countryName={country.name} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

const p = {
    overlay:             { position:'fixed', inset:0, zIndex:100, display:'flex', background:'rgba(4,9,20,0.97)', fontFamily:"'DM Sans','Helvetica Neue',sans-serif", backdropFilter:'blur(2px)' },
    left:                { flex:'0 0 48%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 40px 36px', position:'relative', borderRight:'1px solid rgba(80,140,220,0.1)', background:'radial-gradient(ellipse at 50% 55%, rgba(20,40,80,0.45) 0%, transparent 70%)', gap:'14px' },
    right:               { flex:'0 0 52%', display:'flex', flexDirection:'column', position:'relative', background:'rgba(6,12,26,0.5)' },
    rightScroll:         { flex:1, overflowY:'auto', padding:'24px 40px 40px', display:'flex', flexDirection:'column', gap:'16px' },
    closeBtn:            { position:'absolute', top:'18px', right:'18px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#8ab0c8', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 },
    isoChip:             { position:'absolute', top:'24px', left:'32px', fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.2em', color:'#2a5070', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'4px', padding:'4px 8px' },
    nameBlock:           { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' },
    countryName:         { margin:0, fontSize:'clamp(1.5rem,3vw,2.6rem)', fontWeight:800, color:'#dce8f4', letterSpacing:'0.1em', textTransform:'uppercase', lineHeight:1 },
    sevBadge:            { fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', borderRadius:'6px', padding:'4px 12px' },
    silhouetteContainer: { width:'100%', maxWidth:'460px', aspectRatio:'1.15', flex:'0 0 auto' },
    regionTag:           { position:'absolute', bottom:'20px', fontSize:'0.6rem', color:'#1e3a50', letterSpacing:'0.12em', textTransform:'uppercase' },
    tabBar:              { display:'flex', borderBottom:'1px solid rgba(255,255,255,0.05)', padding:'0 40px', marginTop:'52px', gap:'4px', flexShrink:0 },
    tabBtn:              { background:'none', border:'none', borderBottom:'2px solid transparent', padding:'10px 16px', fontSize:'0.75rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'color 0.15s, border-color 0.15s', display:'flex', alignItems:'center', gap:'6px' },
    aiBadge:             { fontSize:'0.5rem', fontWeight:700, letterSpacing:'0.1em', background:'rgba(58,143,212,0.15)', color:'#3a8fd4', border:'1px solid rgba(58,143,212,0.25)', borderRadius:'3px', padding:'1px 5px' },
    sectionLabel:        { fontSize:'0.55rem', fontWeight:700, letterSpacing:'0.22em', color:'#2a4a62', textTransform:'uppercase', marginBottom:'2px' },
    statsGrid:           { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' },
    divider:             { height:'1px', background:'rgba(80,140,220,0.07)', margin:'2px 0' },
    barsBlock:           { display:'flex', flexDirection:'column', gap:'14px' },
    description:         { margin:0, fontSize:'0.82rem', color:'#6a8aa4', lineHeight:1.7 },
    aiTag:               { fontSize:'0.5rem', fontWeight:700, letterSpacing:'0.1em', background:'rgba(58,143,212,0.1)', color:'#3a8fd4', border:'1px solid rgba(58,143,212,0.2)', borderRadius:'3px', padding:'2px 6px', textTransform:'uppercase' },
    hintTag:             { fontSize:'0.5rem', color:'#1e3a50', letterSpacing:'0.06em', fontWeight:400, textTransform:'none' },
};