/**
 * GlobeWrapper.jsx
 *
 * Wraps your Globe component and animates it to the top-right corner
 * when a country is selected. Drop this into src/components/.
 *
 * Usage in App.jsx:
 *   <GlobeWrapper selectedCountry={selectedCountry}>
 *     <Globe ... />
 *   </GlobeWrapper>
 */

import { useEffect, useState } from 'react';

export default function GlobeWrapper({ selectedCountry, children }) {
    const [phase, setPhase] = useState('idle'); // idle | shrinking | mini

    useEffect(() => {
        if (selectedCountry) {
            setPhase('shrinking');
            const t = setTimeout(() => setPhase('mini'), 500);
            return () => clearTimeout(t);
        } else {
            setPhase('idle');
        }
    }, [selectedCountry]);

    const styles = getStyles(phase);

    return (
        <>
            <style>{`
        @keyframes globeShrink {
          from {
            transform: scale(1) translate(0, 0);
            opacity: 1;
          }
          to {
            transform: scale(0.28) translate(calc(100vw - 320px), calc(-100vh + 320px));
            opacity: 0.75;
          }
        }
        @keyframes globeExpand {
          from {
            transform: scale(0.28) translate(calc(100vw - 320px), calc(-100vh + 320px));
            opacity: 0.75;
          }
          to {
            transform: scale(1) translate(0, 0);
            opacity: 1;
          }
        }
        .globe-mini-pulse {
          animation: globePulse 2.5s ease-in-out infinite;
        }
        @keyframes globePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(80,140,220,0); }
          50%       { box-shadow: 0 0 0 8px rgba(80,140,220,0.15); }
        }
      `}</style>

            <div style={styles.wrapper} className={phase === 'mini' ? 'globe-mini-pulse' : ''}>
                {children}
            </div>
        </>
    );
}

function getStyles(phase) {
    const base = {
        wrapper: {
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            transformOrigin: 'center center',
            transition: phase === 'idle'
                ? 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s ease, border-radius 0.4s ease, width 0.55s cubic-bezier(0.22,1,0.36,1), height 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1), right 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease'
                : 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s ease, border-radius 0.4s ease, width 0.55s cubic-bezier(0.22,1,0.36,1), height 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1), right 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease',
        },
    };

    if (phase === 'idle') {
        return {
            wrapper: {
                ...base.wrapper,
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                top: 0,
                right: 0,
                borderRadius: 0,
                opacity: 1,
                pointerEvents: 'auto',
                boxShadow: 'none',
            },
        };
    }

    if (phase === 'shrinking' || phase === 'mini') {
        return {
            wrapper: {
                ...base.wrapper,
                position: 'fixed',
                top: '16px',
                right: '16px',
                width: '220px',
                height: '220px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1px solid rgba(80,140,220,0.3)',
                boxShadow: '0 0 32px rgba(20,60,120,0.5), 0 4px 24px rgba(0,0,0,0.5)',
                opacity: 0.85,
                pointerEvents: 'none',
                zIndex: 200,
                inset: 'unset',
            },
        };
    }

    return base;
}