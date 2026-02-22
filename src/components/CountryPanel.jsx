import { useMemo } from 'react';

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

function severityLabel(t) {
    if (t === null || t === undefined) return { text: 'No Data', color: '#7a8ca0' };
    if (t > 0.75) return { text: 'Critical', color: '#ff3030' };
    if (t > 0.5)  return { text: 'High',     color: '#ff7700' };
    if (t > 0.25) return { text: 'Moderate', color: '#ffcc00' };
    return                { text: 'Low',      color: '#64b4ff' };
}

// ─── SVG Silhouette ───────────────────────────────────────────────────────────

function projectCoord(lng, lat, bounds, svgW, svgH, padding) {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * (svgW - padding * 2);
    // Flip Y: SVG y=0 is top, lat increases upward
    const y = padding + ((maxLat - lat) / (maxLat - minLat)) * (svgH - padding * 2);
    return [x, y];
}

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

function flattenCoords(geometry) {
    const all = [];
    function walk(geom) {
        if (geom.type === 'Polygon') {
            for (const ring of geom.coordinates) all.push(...ring);
        } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates)
                for (const ring of poly) all.push(...ring);
        }
    }
    walk(geometry);
    return all;
}

function geometryToSvgPaths(geometry, bounds, svgW, svgH, padding) {
    const paths = [];

    function ringToPath(ring) {
        return ring
            .map(([lng, lat], i) => {
                const [x, y] = projectCoord(lng, lat, bounds, svgW, svgH, padding);
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ') + ' Z';
    }

    if (geometry.type === 'Polygon') {
        paths.push(ringToPath(geometry.coordinates[0]));
    } else if (geometry.type === 'MultiPolygon') {
        // Only render polygons with enough points to be visible
        const sorted = [...geometry.coordinates].sort((a, b) => b[0].length - a[0].length);
        for (const poly of sorted.slice(0, 6)) {
            paths.push(ringToPath(poly[0]));
        }
    }

    return paths;
}

function CountrySilhouette({ geometry, severity }) {
    const SVG_W = 260;
    const SVG_H = 220;
    const PADDING = 16;

    const { paths, gradientId } = useMemo(() => {
        if (!geometry) return { paths: [], gradientId: 'grad' };

        const allCoords = flattenCoords(geometry);
        const bounds = getBounds(allCoords);

        // Keep aspect ratio
        const lngRange = bounds.maxLng - bounds.minLng || 1;
        const latRange = bounds.maxLat - bounds.minLat || 1;
        const aspect = lngRange / latRange;
        let w = SVG_W - PADDING * 2;
        let h = SVG_H - PADDING * 2;
        if (aspect > w / h) {
            h = w / aspect;
        } else {
            w = h * aspect;
        }
        const offsetX = (SVG_W - w) / 2;
        const offsetY = (SVG_H - h) / 2;

        const adjustedBounds = { ...bounds };
        const computedPaths = geometryToSvgPaths(
            geometry,
            adjustedBounds,
            SVG_W,
            SVG_H,
            PADDING
        );

        return { paths: computedPaths, gradientId: 'silGrad' };
    }, [geometry]);

    // Color based on severity
    const t = severity ?? 0;
    let fillColor;
    if (t > 0.75)      fillColor = '#cc1111';
    else if (t > 0.5)  fillColor = '#dd6600';
    else if (t > 0.25) fillColor = '#ccaa00';
    else if (t > 0)    fillColor = '#3399cc';
    else               fillColor = '#2a6080';

    return (
        <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width={SVG_W}
            height={SVG_H}
            style={{ display: 'block', margin: '0 auto' }}
        >
            <defs>
                <radialGradient id={gradientId} cx="50%" cy="50%" r="60%">
                    <stop offset="0%"   stopColor={fillColor} stopOpacity="1" />
                    <stop offset="100%" stopColor={fillColor} stopOpacity="0.55" />
                </radialGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {paths.map((d, i) => (
                <path
                    key={i}
                    d={d}
                    fill={`url(#${gradientId})`}
                    stroke={fillColor}
                    strokeWidth="1"
                    strokeOpacity="0.6"
                    filter="url(#glow)"
                />
            ))}
        </svg>
    );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, color }) {
    return (
        <div style={styles.statRow}>
            <span style={styles.statLabel}>{label}</span>
            <span style={{ ...styles.statValue, color: color || '#e8eaf0' }}>{value}</span>
        </div>
    );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function CountryPanel({ country, onClose }) {
    if (!country) return null;

    const { text: sevText, color: sevColor } = severityLabel(country.severity);

    const population = country.properties?.POP_EST
        ? Number(country.properties.POP_EST).toLocaleString()
        : 'N/A';

    const gdp = country.properties?.GDP_MD_EST
        ? `$${Number(country.properties.GDP_MD_EST).toLocaleString()}M`
        : 'N/A';

    return (
        <div style={styles.panel}>
            {/* Close */}
            <button style={styles.closeBtn} onClick={onClose}>✕</button>

            {/* Country name */}
            <h2 style={styles.countryName}>{country.name}</h2>
            <p style={styles.isoTag}>{country.iso}</p>

            {/* Silhouette */}
            <div style={styles.silhouetteWrap}>
                <CountrySilhouette geometry={country.geometry} severity={country.severity} />
            </div>

            {/* Divider */}
            <div style={styles.divider} />

            {/* Stats */}
            <div style={styles.statsBlock}>
                <StatRow label="Population" value={population} />
                <StatRow label="GDP" value={gdp} />
                <StatRow
                    label={categoryLabel(country.category)}
                    value={country.value !== null ? `${country.value}/100` : 'No data'}
                    color={sevColor}
                />
                <StatRow label="Severity" value={sevText} color={sevColor} />
            </div>

            {/* Description */}
            {country.description && (
                <>
                    <div style={styles.divider} />
                    <p style={styles.descLabel}>Details</p>
                    <p style={styles.description}>{country.description}</p>
                </>
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
    panel: {
        width: '300px',
        minWidth: '280px',
        flexShrink: 0,
        background: 'rgba(8,15,30,0.97)',
        borderLeft: '1px solid rgba(80,140,220,0.25)',
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflowY: 'auto',
        position: 'relative',
        zIndex: 10,
        animation: 'slideIn 0.22s ease',
    },
    closeBtn: {
        position: 'absolute',
        top: '14px',
        right: '14px',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#c8d8e8',
        borderRadius: '6px',
        width: '28px',
        height: '28px',
        cursor: 'pointer',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countryName: {
        margin: '0 28px 0 0',
        fontSize: '1.3rem',
        fontWeight: 700,
        color: '#e8eaf0',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.2,
    },
    isoTag: {
        margin: 0,
        fontSize: '0.72rem',
        color: '#5a7a9a',
        fontFamily: 'system-ui, sans-serif',
        letterSpacing: '0.1em',
    },
    silhouetteWrap: {
        marginTop: '4px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
        padding: '8px 0',
    },
    divider: {
        height: '1px',
        background: 'rgba(80,140,220,0.12)',
        margin: '2px 0',
    },
    statsBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'system-ui, sans-serif',
    },
    statLabel: {
        fontSize: '0.75rem',
        color: '#5a7a9a',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
    },
    statValue: {
        fontSize: '0.9rem',
        fontWeight: 600,
        color: '#e8eaf0',
    },
    descLabel: {
        margin: 0,
        fontSize: '0.7rem',
        color: '#5a7a9a',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: 'system-ui, sans-serif',
    },
    description: {
        margin: 0,
        fontSize: '0.8rem',
        color: '#8a9ab0',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.6,
    },
};