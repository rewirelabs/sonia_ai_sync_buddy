'use client';
import React, { useState } from 'react';
import { RankedTrack } from '@/lib/core/ranker';

interface TrackCardProps {
  track: RankedTrack;
  rank: parseInt;
}

export function TrackCard({ track, rank }: TrackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [stems, setStems] = useState<{ vocals?: string, instrumental?: string } | null>(null);
  const [stemError, setStemError] = useState<string | null>(null);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  };

  const durSec = Math.floor(track.durationMs / 1000);
  const wsSec = Math.floor(track.alignment.startMs / 1000);
  const weSec = Math.floor(track.alignment.endMs / 1000);
  const mtSec = Math.floor(track.alignment.moneyLineTimestampMs / 1000);
  
  const rankLabel = '0' + rank;
  const durLabel = fmt(durSec);
  const winLabel = fmt(wsSec) + '–' + fmt(weSec);
  const moneyTime = fmt(mtSec);
  const moneyLine = track.alignment.moneyLine || "Instrumental drop";

  const safe = track.safetyLevel === 'safe';
  const safetyColor = safe ? '#38e0c8' : '#ffb43d';
  
  // Create SVG curve
  const curve = track.curve || [0.5, 0.5]; // fallback if not available yet
  const W = 100;
  const H = 42;
  const ptsArr = curve.map((y: number, i: number) => {
    const x = (i / (curve.length - 1)) * W;
    const yy = H - 2 - y * (H - 6);
    return x.toFixed(1) + ',' + yy.toFixed(1);
  });
  const points = ptsArr.join(' ');
  const areaPath = `M0,${H} L${ptsArr.join(' L')} L${W},${H} Z`;

  const winL = (wsSec / durSec) * 100;
  const winW = ((weSec - wsSec) / durSec) * 100;
  const moneyL = (mtSec / durSec) * 100;

  const handleSplit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.previewUrl) {
      setStemError("No audio preview.");
      return;
    }
    setIsSplitting(true);
    setStemError(null);
    try {
      const res = await fetch('/api/stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewUrl: track.previewUrl })
      });
      if (!res.ok) throw new Error('API Error LALAL.AI');
      setStems(await res.json());
    } catch (err: any) {
      setStemError(err.message);
    } finally {
      setIsSplitting(false);
    }
  };

  const marks = track.safetyVerdicts?.filter(v => v.severity !== 'low').map(v => ({
    pos: v.timestampMs / 1000,
    sev: v.severity,
    evidence: v.evidence,
    category: v.category
  })) || [];

  return (
    <div 
      onClick={() => setExpanded(!expanded)}
      className="cursor-pointer rounded-[var(--radius)] bg-[var(--glass)] border p-[17px_19px] transition-all duration-250 animate-[sx-fadeup_0.5s_ease_both]"
      style={{
        borderColor: expanded ? 'rgba(255,138,61,0.35)' : 'var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        backdropFilter: 'blur(var(--blur))',
        WebkitBackdropFilter: 'blur(var(--blur))'
      }}
    >
      {/* top row */}
      <div className="flex gap-[16px] items-center">
        <div className="font-mono text-[13px] text-[#e9ecf3]/40 w-[20px] shrink-0">{rankLabel}</div>
        
        {/* cover */}
        <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] overflow-hidden relative border border-white/5 bg-white/5">
          {track.coverUrl ? (
            <img src={track.coverUrl} className="w-full h-full object-cover" alt="cover" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-[#ff8a3d]/20 to-[#c63dff]/15"></div>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 6px, transparent 6px 12px)', mixBlendMode: 'overlay' }}></div>
              <div className="absolute inset-0 flex items-center justify-center text-white/70 text-[17px]">♫</div>
            </>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[9px] flex-wrap">
            <span className="text-[16px] font-semibold tracking-[-0.01em]">{track.title}</span>
            <span className="font-mono text-[9.5px] tracking-[0.06em] text-[#e9ecf3]/55 bg-white/5 border border-white/10 rounded-[5px] px-[6px] py-[2px]">{track.lang.toUpperCase()}</span>
            <span 
              className="font-mono text-[9.5px] tracking-[0.04em] rounded-[6px] px-[8px] py-[3px]"
              style={{
                color: safetyColor,
                background: safe ? 'rgba(56,224,200,0.12)' : 'rgba(255,180,61,0.14)',
                border: `1px solid ${safe ? 'rgba(56,224,200,0.3)' : 'rgba(255,180,61,0.35)'}`
              }}
            >
              {safe ? '✓ Safe · Market' : '⚠ Review'}
            </span>
          </div>
          <div className="text-[13px] text-[#e9ecf3]/55 mt-[2px]">{track.artist} · {durLabel}</div>
        </div>
        
        {/* fit */}
        <div className="shrink-0 text-right flex items-center gap-[14px]">
          <div>
            <div className="text-[27px] font-semibold leading-[1] tracking-[-0.02em] text-[var(--ink)]">{Math.round(track.alignment.fitScore)}</div>
            <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-[#e9ecf3]/40 text-right">fit</div>
          </div>
          <span className={`text-[18px] text-[#e9ecf3]/45 transition-transform duration-250 ${expanded ? 'rotate-180' : 'rotate-0'}`}>⌄</span>
        </div>
      </div>

      {/* timeline */}
      <div className="mt-[16px]">
        <div className="flex justify-between font-mono text-[10px] text-[#e9ecf3]/40 mb-[6px]">
          <span>0:00</span>
          <span className="text-accent">◆ window {winLabel}</span>
          <span>{durLabel}</span>
        </div>
        <div className="relative h-[44px]">
          <div className="absolute inset-0 rounded-[9px] overflow-hidden bg-white/5 border border-white/10">
            <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <defs>
                <linearGradient id="sxSpectrum" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#ff8a3d"></stop>
                  <stop offset="0.3" stopColor="#ff3d7f"></stop>
                  <stop offset="0.6" stopColor="#c63dff"></stop>
                  <stop offset="0.82" stopColor="#7b3dff"></stop>
                  <stop offset="1" stopColor="#3ddfff"></stop>
                </linearGradient>
                <linearGradient id="sxVert" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stopColor="#ff8a3d" stopOpacity="0.05"></stop>
                  <stop offset="1" stopColor="#ff3d7f" stopOpacity="0.55"></stop>
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#sxVert)"></path>
              <polyline points={points} fill="none" stroke="url(#sxSpectrum)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round"></polyline>
            </svg>
            
            <div className="absolute top-0 bottom-0 border-l border-r border-[#ff8a3d]/50 z-10 flex items-center justify-center overflow-hidden" style={{
              left: `${winL}%`, width: `${winW}%`,
              background: 'linear-gradient(180deg,rgba(255,138,61,0.11),rgba(255,61,127,0.06))',
              boxShadow: 'inset 0 0 16px rgba(255,138,61,0.07)'
            }}>
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#ff8a3d] opacity-60 whitespace-nowrap px-1">
                {winW > 15 ? 'SYNC WINDOW' : ''}
              </span>
            </div>
          </div>
          
          <div className="absolute top-0 bottom-0 w-[1.5px] bg-[#ff3d7f]/85 z-20 group" style={{
            left: `${moneyL}%`,
            boxShadow: '0 0 7px rgba(255,61,127,0.55)'
          }}>
            <div className="absolute top-[-15px] -translate-x-1/2 whitespace-nowrap text-[8.5px] font-mono text-[#ff3d7f] tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
              MONEY LINE
            </div>
            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-[#ff3d7f]"></div>
          </div>

          {marks.map((m, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-[3px] z-30 group" style={{
              left: `${(m.pos / durSec) * 100}%`,
              background: m.sev === 'high' ? '#ff4d4d' : '#ffb43d',
              boxShadow: `0 0 8px ${m.sev === 'high' ? 'rgba(255,77,77,0.7)' : 'rgba(255,180,61,0.7)'}`
            }}>
               <div className="absolute top-[-34px] left-1/2 -translate-x-1/2 w-max max-w-[200px] whitespace-normal bg-[#07080c]/95 border px-[8px] py-[6px] rounded-[6px] text-[9.5px] leading-[1.3] opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none" style={{ color: m.sev === 'high' ? '#ff4d4d' : '#ffb43d', borderColor: m.sev === 'high' ? 'rgba(255,77,77,0.3)' : 'rgba(255,180,61,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                 <div className="font-mono uppercase tracking-wider mb-[2px] opacity-80">{m.category}</div>
                 <div className="text-white/80 italic">"{m.evidence}"</div>
               </div>
            </div>
          ))}
        </div>
        
        {/* money line */}
        <div className="flex items-center gap-[9px] mt-[11px]">
          <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-accent shrink-0">Money line · {moneyTime}</span>
          <span className="text-[14px] italic text-[#e9ecf3]/90">"{moneyLine}"</span>
        </div>
      </div>

      {/* expanded detail */}
      {expanded && (
        <div className="mt-[18px] pt-[18px] border-t border-white/10 animate-[sx-fadeup_0.4s_ease]" onClick={e => e.stopPropagation()}>
          <div className="flex gap-[24px] flex-wrap">
            <div className="flex-[2] min-w-[260px]">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#e9ecf3]/40 mb-[8px]">Why this window</div>
              <p className="text-[13.5px] leading-[1.6] text-[#e9ecf3]/80 m-0 mb-[14px]">{track.alignment.fitRationale}</p>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#e9ecf3]/40 mb-[8px]">Brand safety</div>
              <div className="rounded-[10px] p-[12px_14px] border" style={{
                background: safe ? 'rgba(56,224,200,0.07)' : 'rgba(255,180,61,0.08)',
                borderColor: safe ? 'rgba(56,224,200,0.22)' : 'rgba(255,180,61,0.3)'
              }}>
                <div className="text-[13px] font-semibold mb-[3px]" style={{ color: safetyColor }}>
                  {safe ? 'Clear across all markets' : `${marks.length} lines flagged`}
                </div>
                <div className="text-[12px] leading-[1.5] text-[#e9ecf3]/60">
                  {safe ? 'Every line passed the ruleset. No explicit, drug or violence references.' : 'A line carries a risky image. Recommend a quick human sign-off before clearing.'}
                </div>
              </div>

              {track.alignment.vibeWarning && (
                <div className="mt-3 rounded-[10px] p-[12px_14px] border" style={{ background: 'rgba(255,100,100,0.08)', borderColor: 'rgba(255,100,100,0.3)' }}>
                  <div className="text-[13px] font-semibold text-[#ff6464] mb-[3px]">Audio Vibe Penalty</div>
                  <div className="text-[12px] leading-[1.5] text-[#e9ecf3]/60">{track.alignment.vibeWarning}</div>
                </div>
              )}

              <div className="flex flex-col gap-[8px] mt-[14px]">
                {/* LALAL AI BUTTON */}
                <div className="flex gap-[8px]">
                  {stems ? (
                     <div className="flex-1 flex flex-col gap-1 text-xs">
                       <a href={stems.vocals} target="_blank" className="font-sans text-accent hover:underline">🎤 Acapella Stem</a>
                       <a href={stems.instrumental} target="_blank" className="font-sans text-accent hover:underline">🎸 Instrumental Stem</a>
                     </div>
                  ) : (
                    <button 
                      onClick={handleSplit} 
                      disabled={isSplitting || !track.previewUrl}
                      title={!track.previewUrl ? 'Audio preview not available from Spotify' : ''}
                      className="flex-1 font-sans text-[12.5px] font-semibold text-[#0a0a0c] bg-gradient-to-r from-accent to-[#ff3d7f] border-0 rounded-[9px] p-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSplitting ? 'Splitting...' : 'Extract Stems'}
                    </button>
                  )}
                  {track.spotifyId && (
                    <a 
                      href={`https://open.spotify.com/track/${track.spotifyId}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="font-sans text-[12.5px] flex items-center justify-center text-[#1db954] font-semibold bg-white/5 border border-[#1db954]/20 rounded-[9px] px-[14px] py-[10px] cursor-pointer hover:bg-[#1db954]/10 transition-colors no-underline"
                    >
                      ▶ Play in Spotify
                    </a>
                  )}
                </div>
                {stemError && <span className="text-xs text-red-400">{stemError}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
