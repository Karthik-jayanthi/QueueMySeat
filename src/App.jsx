import { useState, useEffect, useCallback } from 'react';

// ─── Gemini Config ─────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
import {
  initiateSpotifyLogin, exchangeCodeForToken, getValidToken, logout,
  fetchSpotifyProfile, fetchTopArtists, fetchRecentlyPlayed,
} from './spotify.js';
import { CONCERTS, INR, fmtDate, remaining, fillPct } from './concerts.js';
import { calcFanScoreDetailed, calcFanScore, calcQueuePosition, TIER_INFO } from './fanScore.js';

// ─── Design tokens ────────────────────────────────────────
const T = {
  bg: '#000',
  surface: '#0a0a0a',
  border: '#1a1a1a',
  borderHover: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#555',
  textSub: '#333',
  green: '#1DB954',
  white: '#ffffff',
};

// ─── Primitives ───────────────────────────────────────────
const Avatar = ({ src, initials, color, size }) => {
  const [err, setErr] = useState(false);
  const sz = size || 44;
  const base = {
    width: sz, height: sz, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: Math.round(sz * 0.33), color: '#000',
    background: color || '#fff', letterSpacing: 0.5, overflow: 'hidden',
  };
  if (src && !err) return <img src={src} alt={initials} style={{ ...base, objectFit: 'cover' }} onError={() => setErr(true)} />;
  return <div style={base}>{initials}</div>;
};

const Chip = ({ label, color }) => (
  <span style={{
    background: 'transparent', color: color || '#555',
    border: `1px solid ${color || '#333'}`,
    fontSize: 9, fontWeight: 700, padding: '2px 7px',
    borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase',
  }}>{label}</span>
);

const ProgBar = ({ pct, color, height }) => (
  <div style={{ background: '#111', borderRadius: 2, height: height || 2, overflow: 'hidden' }}>
    <div style={{ width: Math.min(100, pct) + '%', background: color || '#fff', height: '100%', borderRadius: 2 }} />
  </div>
);

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, flexDirection: 'column', gap: 16 }}>
    <div style={{ width: 32, height: 32, border: '2px solid #222', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const SpotifyIcon = ({ size }) => (
  <svg width={size || 14} height={size || 14} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

// ─── Score Breakdown ──────────────────────────────────────
function ScoreBreakdown({ scoreData, concert }) {
  if (!scoreData || !scoreData.breakdown) return null;
  const { total, breakdown, tier } = scoreData;
  const ti = TIER_INFO[tier];
  const rows = [
    { label: 'Artist match', pts: breakdown.artistMatch, max: 50, note: breakdown.artistMatchReason },
    { label: 'Popularity weight', pts: breakdown.popularityWeight, max: 20, note: breakdown.matchedArtist ? breakdown.matchedArtist.popularity + '/100 on Spotify' : 'N/A' },
    { label: 'Listening recency', pts: breakdown.listeningRecency, max: 20, note: breakdown.recencyReason },
    { label: 'Genre depth', pts: breakdown.genreDepth, max: 10, note: breakdown.genreDepthReason },
  ];
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      {/* Score header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.textMuted, textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>fan verification — {concert.artist}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: 56, fontWeight: 900, color: T.text, lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 20, color: T.textMuted, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ti.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{ti.label}</div>
            <div style={{ fontSize: 10, color: T.textMuted }}>
              {tier === 'elite' ? 'Loyalty bonus unlocked' : tier === 'verified' ? 'Priority queue access' : tier === 'growing' ? (85 - total) + ' pts to Elite' : 'Below 85 minimum'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgBar pct={total} color={ti.color} height={3} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.textSub, marginTop: 4 }}>
            <span>0</span><span style={{ color: T.textMuted }}>85 threshold</span><span>100</span>
          </div>
        </div>
      </div>
      {/* Breakdown rows */}
      <div>
        {rows.map((row, i) => (
          <div key={row.label} style={{ padding: '12px 20px', borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T.text, fontWeight: 500, marginBottom: 3 }}>{row.label}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{row.note}</div>
            </div>
            <div style={{ width: 80 }}>
              <ProgBar pct={(row.pts / row.max) * 100} color={row.pts > 0 ? ti.color : '#222'} height={2} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: row.pts > 0 ? T.text : T.textMuted, minWidth: 40, textAlign: 'right' }}>{row.pts}/{row.max}</div>
          </div>
        ))}
      </div>
      {/* Status bar */}
      {tier === 'casual' && (
        <div style={{ padding: '12px 20px', borderTop: `1px solid #ef444422`, background: '#ef44440a' }}>
          <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Early-bird blocked — score below 85 minimum</div>
          <div style={{ fontSize: 10, color: '#ef444488', marginTop: 3 }}>Listen to more {concert.artist} on Spotify to increase your score.</div>
        </div>
      )}
    </div>
  );
}

// ─── Why This Show (Gemini) ───────────────────────────────
function WhyThisShow({ concert, topArtists, recentTracks }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState(null);
  const [error, setError] = useState(null);

  const fetchReason = useCallback(async () => {
    if (reason || loading) return;
    setLoading(true);
    setError(null);
    try {
      const topNames = (topArtists || []).slice(0, 5).map(a => a.name).join(', ') || 'various artists';
      const topGenres = [...new Set((topArtists || []).flatMap(a => a.genres || []))].slice(0, 6).join(', ') || 'various genres';
      const recentNames = (recentTracks || []).slice(0, 5).map(t => t.name + ' by ' + t.artist).join('; ') || 'recent tracks';
      const prompt = `You are a music concierge for QueueMySeat, a Spotify-verified early-bird concert booking platform.

A user's Spotify data shows:
- Top artists: ${topNames}
- Top genres: ${topGenres}
- Recently played: ${recentNames}

Concert they are viewing:
- Artist: ${concert.artist}
- Genre: ${concert.genre.join(', ')}
- Venue: ${concert.venue}, ${concert.city}
- Date: ${concert.date}

Write a single punchy 2-sentence reason why THIS specific user would love this show. 
Be personal, reference their actual listening habits. Be enthusiastic but concise.
Do not use quotes or asterisks. Start with "You'll love this because" or a similar hook.`;

      if (!GEMINI_API_KEY) throw new Error('API key not set');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 120 },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'API error ' + res.status);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Empty response');
      setReason(text);
    } catch (e) {
      setError(e.message || 'Could not load recommendation.');
    } finally {
      setLoading(false);
    }
  }, [concert, topArtists, recentTracks, reason, loading]);

  const handleClick = () => {
    const next = !open;
    setOpen(next);
    if (next && !reason && !loading) fetchReason();
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={handleClick}
        style={{
          width: '100%',
          background: open ? '#0f0f0f' : 'transparent',
          border: `1px solid ${open ? '#2a2a2a' : '#1a1a1a'}`,
          borderRadius: 7,
          padding: '7px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Gemini star icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.09 9.26L21 12L14.09 14.74L12 22L9.91 14.74L3 12L9.91 9.26L12 2Z" fill="#4f8ef7"/>
            <path d="M12 2L13.5 8.5L19 12L13.5 15.5L12 22L10.5 15.5L5 12L10.5 8.5L12 2Z" fill="#a0c4ff" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4f8ef7', letterSpacing: 0.3 }}>
            Why this show?
          </span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          borderLeft: `2px solid #4f8ef722`,
          marginTop: 6,
          padding: '8px 12px',
          background: '#050508',
          borderRadius: '0 6px 6px 0',
        }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12, height: 12, border: '1.5px solid #222',
                borderTop: '1.5px solid #4f8ef7', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: '#555' }}>Personalizing for your taste…</span>
            </div>
          )}
          {error && <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>}
          {reason && (
            <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{reason}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Concert Card ─────────────────────────────────────────
function ConcertCard({ concert, onBook, topArtists, recentTracks, loggedIn }) {
  const scoreData = calcFanScoreDetailed(concert, topArtists, recentTracks);
  const { total: fanScore, tier } = scoreData;
  const ti = TIER_INFO[tier];
  const rem = remaining(concert);
  const pct = fillPct(concert);
  const isSoldOut = rem <= 0;
  const isAlmost = rem > 0 && rem <= 20;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.bg,
        border: `1px solid ${hovered ? '#333' : T.border}`,
        borderRadius: 12, overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}>
      {/* Artist color strip */}
      <div style={{ height: 2, background: concert.accent }} />

      <div style={{ padding: 18 }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: concert.accent + '18',
              border: `1px solid ${concert.accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: concert.accent,
            }}>{concert.initials}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{concert.artist}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{concert.city}</div>
            </div>
          </div>
          {loggedIn && fanScore > 0 && (
            <Chip label={ti.label} color={ti.color} />
          )}
        </div>

        {/* Details */}
        <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: '10px 0', margin: '0 0 12px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Date</div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{fmtDate(concert.date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Venue</div>
            <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{concert.venue}</div>
          </div>
        </div>

        {/* Fan score bar on card */}
        {loggedIn && fanScore > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
              <span style={{ color: T.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Fan score</span>
              <span style={{ color: ti.color, fontWeight: 700 }}>{fanScore}/100</span>
            </div>
            <ProgBar pct={fanScore} color={ti.color} height={2} />
          </div>
        )}

        {/* Availability */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
            <span style={{ color: T.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>Availability</span>
            <span style={{ color: isSoldOut ? '#ef4444' : isAlmost ? '#f59e0b' : T.textMuted, fontWeight: isAlmost || isSoldOut ? 700 : 400 }}>
              {isSoldOut ? 'Sold out' : isAlmost ? rem + ' left' : rem + ' remaining'}
            </span>
          </div>
          <ProgBar pct={pct} color={isSoldOut ? '#333' : concert.accent} height={2} />
        </div>

        {/* Why this show — Gemini AI */}
        {loggedIn && !isSoldOut && (
          <WhyThisShow concert={concert} topArtists={topArtists} recentTracks={recentTracks} />
        )}

        {/* Price + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{INR(concert.earlyBirdPrice)}</div>
            <div style={{ fontSize: 10, color: T.textMuted }}><s>{INR(concert.basePrice)}</s> early-bird</div>
          </div>
          <button
            onClick={() => onBook(concert)}
            disabled={isSoldOut}
            style={{
              background: isSoldOut ? T.surface : T.white,
              color: isSoldOut ? T.textMuted : T.bg,
              border: `1px solid ${isSoldOut ? T.border : T.white}`,
              borderRadius: 7, padding: '9px 16px',
              fontWeight: 800, fontSize: 12, cursor: isSoldOut ? 'not-allowed' : 'pointer',
              letterSpacing: 0.3,
            }}>
            {isSoldOut ? 'Sold Out' : 'Book Early-Bird'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Modal ────────────────────────────────────────
function BookingModal({ concert, topArtists, recentTracks, onClose, onSuccess, loyaltyUsed, setLoyaltyUsed }) {
  const [step, setStep] = useState(1);
  const [addFriends, setAddFriends] = useState(false);
  const [extraTickets, setExtraTickets] = useState(0);
  const [processing, setProcessing] = useState(false);

  const scoreData = calcFanScoreDetailed(concert, topArtists, recentTracks);
  const { total: fanScore, tier } = scoreData;
  const ti = TIER_INFO[tier];
  const canBook = ti.canBook;
  const canLoyalty = tier === 'elite' && !loyaltyUsed[concert.artist];
  const queuePos = calcQueuePosition(concert, fanScore);
  const rem = remaining(concert);
  const tickets = 1 + (addFriends ? 2 : 0) + extraTickets;
  const total = tickets * concert.earlyBirdPrice;
  const savings = tickets * (concert.basePrice - concert.earlyBirdPrice);
  const friendsPenalty = addFriends ? 8 : 0;
  const extraPenalty = extraTickets * 6;
  const totalPenalty = friendsPenalty + extraPenalty;
  const newScore = Math.max(0, fanScore - totalPenalty);

  const confirmBooking = () => {
    setProcessing(true);
    setTimeout(() => {
      if (addFriends || extraTickets > 0) setLoyaltyUsed(prev => ({ ...prev, [concert.artist]: true }));
      onSuccess({ concert, queuePos, tickets, total, addFriends, extraTickets, fanScore, newScore });
    }, 1600);
  };

  const OL = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  };
  const BOX = {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: 28, maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto',
  };
  const PrimaryBtn = ({ onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? T.surface : T.white, color: disabled ? T.textMuted : T.bg,
      border: `1px solid ${disabled ? T.border : T.white}`,
      borderRadius: 8, padding: '13px 24px', fontWeight: 800, fontSize: 14,
      cursor: disabled ? 'not-allowed' : 'pointer', width: '100%', marginTop: 8, letterSpacing: 0.3,
    }}>{children}</button>
  );
  const SecondaryBtn = ({ onClick, children }) => (
    <button onClick={onClick} style={{
      background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '11px 20px', fontWeight: 500, fontSize: 13,
      cursor: 'pointer', width: '100%', marginTop: 8,
    }}>{children}</button>
  );
  const Row = ({ label, value, valueColor }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor || T.text }}>{value}</span>
    </div>
  );

  return (
    <div style={OL} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={BOX}>

        {/* Processing */}
        {processing && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spinner />
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>Securing your seats...</div>
            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>Locking your early-bird position</div>
          </div>
        )}

        {/* Step 1 — Fan verification */}
        {!processing && step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Step 1 of 3</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Fan verification</div>
              </div>
              <button onClick={onClose} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 7, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>

            <ScoreBreakdown scoreData={scoreData} concert={concert} />

            {canBook
              ? <PrimaryBtn onClick={() => setStep(2)}>{tier === 'elite' ? 'Elite Fan — Continue' : 'Verified — Continue'}</PrimaryBtn>
              : <PrimaryBtn disabled>Booking blocked — score below 85</PrimaryBtn>
            }
            <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          </>
        )}

        {/* Step 2 — Ticket selection */}
        {!processing && step === 2 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Step 2 of 3</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Select tickets</div>
              </div>
              <button onClick={() => setStep(1)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 7, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
            </div>

            {/* Concert info strip */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ height: 2, background: concert.accent, borderRadius: 1, marginBottom: 14 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{concert.artist}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{fmtDate(concert.date)} · {concert.venue}, {concert.city}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 2 }}>Queue position</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.text }}>#{queuePos}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Fan score</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: ti.color }}>{fanScore}/100</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: ti.color }}>{ti.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Seats left</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{rem}</div>
                </div>
              </div>
            </div>

            {/* +2 friends */}
            <div
              onClick={() => setAddFriends(!addFriends)}
              style={{
                border: `1px solid ${addFriends ? '#333' : T.border}`,
                borderRadius: 10, padding: 16, marginBottom: 12, cursor: 'pointer',
                background: addFriends ? '#111' : 'transparent',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4,
                  border: `1px solid ${addFriends ? T.white : T.border}`,
                  background: addFriends ? T.white : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {addFriends && <span style={{ fontSize: 11, color: T.bg, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Queue +2 Friends</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>2 extra seats at {INR(concert.earlyBirdPrice)} each · fan score −8 pts</div>
                </div>
              </div>
            </div>

            {/* Loyalty bonus */}
            {canLoyalty && (
              <div style={{ border: `1px solid #f59e0b33`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Elite Fan Loyalty Bonus</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Purchase up to 2 extra tickets at early-bird price. Each reduces your score by 6 pts.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4 }}>Extra:</span>
                  {[0, 1, 2].map(n => (
                    <button key={n} onClick={() => setExtraTickets(n)} style={{
                      background: extraTickets === n ? T.white : T.surface,
                      color: extraTickets === n ? T.bg : T.textMuted,
                      border: `1px solid ${extraTickets === n ? T.white : T.border}`,
                      borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontWeight: 800, fontSize: 14,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            )}

            {loyaltyUsed[concert.artist] && (
              <div style={{ fontSize: 11, color: T.textMuted, padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>Loyalty bonus already used for {concert.artist}.</div>
            )}

            {/* Score impact */}
            {totalPenalty > 0 && (
              <div style={{ border: `1px solid #f59e0b22`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Score after booking</span>
                  <span style={{ fontWeight: 700 }}>{fanScore} → {newScore} (−{totalPenalty} pts)</span>
                </div>
              </div>
            )}

            {/* Price summary */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
              <Row label="Tickets" value={`${tickets} × ${INR(concert.earlyBirdPrice)}`} />
              {savings > 0 && <Row label="You save" value={INR(savings)} valueColor="#1DB954" />}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900 }}>{INR(total)}</span>
              </div>
            </div>

            <PrimaryBtn onClick={() => setStep(3)}>Continue to payment →</PrimaryBtn>
            <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          </>
        )}

        {/* Step 3 — Confirm */}
        {!processing && step === 3 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Step 3 of 3</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Confirm & pay</div>
              </div>
              <button onClick={() => setStep(2)} style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 7, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
            </div>

            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              {[
                ['Artist', concert.artist],
                ['Date', fmtDate(concert.date) + ' · ' + concert.time],
                ['Venue', concert.venue + ', ' + concert.city],
                ['Tickets', tickets + (addFriends ? ' (you + 2 friends)' : '') + (extraTickets > 0 ? ' + ' + extraTickets + ' loyalty' : '')],
                ['Queue position', '#' + queuePos],
                ['Fan score', fanScore + '/100 — ' + ti.label],
              ].map(([k, v]) => <Row key={k} label={k} value={v} valueColor={k === 'Queue position' ? '#888' : k === 'Fan score' ? ti.color : T.text} />)}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900 }}>{INR(total)}</span>
              </div>
            </div>

            {totalPenalty > 0 && (
              <div style={{ border: `1px solid #f59e0b22`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#f59e0b' }}>Fan score after booking: {newScore}/100 (−{totalPenalty} pts deducted)</div>
              </div>
            )}

            <div style={{ border: `1px solid #1DB95422`, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#1DB954' }}>Secure checkout · Early-bird price locked · Instant e-ticket</div>
            </div>

            <PrimaryBtn onClick={confirmBooking}>Confirm booking — {INR(total)}</PrimaryBtn>
            <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Success Modal ────────────────────────────────────────
function SuccessModal({ data, onClose, onViewTickets }) {
  const ti = TIER_INFO[data.fanScore >= 85 ? 'elite' : data.fanScore >= 70 ? 'verified' : 'growing'];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 10, letterSpacing: 4, color: T.textMuted, textTransform: 'uppercase', marginBottom: 20 }}>Booking confirmed</div>
        <div style={{ fontSize: 72, fontWeight: 900, color: T.text, lineHeight: 1, marginBottom: 4 }}>#{data.queuePos}</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 4 }}>Your queue position</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{data.concert.artist}</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 28 }}>{fmtDate(data.concert.date)} · {data.concert.city}</div>

        <div style={{ display: 'flex', gap: 0, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          {[['Tickets', data.tickets], ['Total', INR(data.total)], ['Score', data.newScore + '/100']].map(([l, v], i) => (
            <div key={l} style={{ flex: 1, padding: '14px 8px', borderRight: i < 2 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>

        {totalPenalty => totalPenalty > 0 && data.extraTickets > 0 && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 16 }}>Score reduced by {data.extraTickets * 6 + (data.addFriends ? 8 : 0)} pts due to extra tickets.</div>
        )}

        <button onClick={onViewTickets} style={{ background: T.white, color: T.bg, border: 'none', borderRadius: 8, padding: '13px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer', width: '100%', marginBottom: 8, letterSpacing: 0.3 }}>View my tickets</button>
        <button onClick={onClose} style={{ background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 8, padding: '11px 20px', fontSize: 13, cursor: 'pointer', width: '100%' }}>Continue browsing</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home');
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [bookingModal, setBookingModal] = useState(null);
  const [successModal, setSuccessModal] = useState(null);
  const [bookedList, setBookedList] = useState([]);
  const [loyaltyUsed, setLoyaltyUsed] = useState({});
  const [filterCity, setFilterCity] = useState('All');
  const [filterGenre, setFilterGenre] = useState('All');
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(false);

  const loadSpotifyData = async (t) => {
    setDataLoading(true);
    try {
      const [p, a, r] = await Promise.all([fetchSpotifyProfile(t), fetchTopArtists(t), fetchRecentlyPlayed(t)]);
      setProfile(p); setTopArtists(a.items || []); setRecentTracks(r.items || []);
    } catch (e) { console.error(e); }
    setDataLoading(false); setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) { window.history.replaceState({}, '', '/'); setLoading(false); return; }
    if (code) {
      window.history.replaceState({}, '', '/');
      exchangeCodeForToken(code).then(t => { setToken(t); loadSpotifyData(t); }).catch(() => setLoading(false));
      return;
    }
    getValidToken().then(t => { if (t) { setToken(t); loadSpotifyData(t); } else setLoading(false); });
  }, []);

  const handleLogout = () => { logout(); setToken(null); setProfile(null); setTopArtists([]); setRecentTracks([]); setPage('home'); };
  const handleBook = (c) => { if (!token) { initiateSpotifyLogin(); return; } setBookingModal(c); };
  const handleSuccess = (data) => { setBookedList(p => [...p, data]); setBookingModal(null); setSuccessModal(data); };

  const cities = ['All', ...new Set(CONCERTS.map(c => c.city))];
  const genres = ['All', 'pop', 'rock', 'EDM', 'Bollywood', 'hip-hop', 'indie', 'dance', 'R&B', 'trance', 'soul'];
  const filtered = CONCERTS.filter(c => {
    if (filterCity !== 'All' && c.city !== filterCity) return false;
    if (filterGenre !== 'All' && !c.genre.some(g => g.toLowerCase().includes(filterGenre.toLowerCase()))) return false;
    if (search && !c.artist.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const avgScore = topArtists.length ? Math.round(topArtists.reduce((s, a) => s + (a.popularity || 0), 0) / topArtists.length) : 0;

  const NavBtn = ({ label, p }) => (
    <button onClick={() => setPage(p)} style={{
      background: 'transparent', color: page === p ? T.text : T.textMuted,
      border: `1px solid ${page === p ? T.border : 'transparent'}`,
      borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: page === p ? 600 : 400,
    }}>{label}</button>
  );

  const FilterEl = ({ as: Tag, value, onChange, children, style = {} }) => (
    <Tag value={value} onChange={onChange} style={{
      background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 7,
      padding: '7px 12px', color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer', ...style,
    }}>{children}</Tag>
  );

  if (loading) return <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200, height: 56,
        background: 'rgba(0,0,0,0.97)', borderBottom: `1px solid ${T.border}`,
        padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <span onClick={() => setPage('home')} style={{ fontSize: 18, fontWeight: 900, cursor: 'pointer', letterSpacing: -0.5 }}>
          QueueMySeat
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <NavBtn label="Concerts" p="home" />
          {token && <NavBtn label="My Spotify" p="dashboard" />}
          {token && <NavBtn label="Fan Profile" p="profile" />}
          {token && bookedList.length > 0 && <NavBtn label={`Tickets (${bookedList.length})`} p="tickets" />}
        </div>
        {token && profile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar src={profile.images?.[0]?.url} initials={(profile.display_name || 'U')[0].toUpperCase()} color="#fff" size={30} />
            <span style={{ fontSize: 12, color: T.textMuted, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.display_name}</span>
            <button onClick={handleLogout} style={{ background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11 }}>Log out</button>
          </div>
        ) : (
          <button onClick={initiateSpotifyLogin} style={{ background: T.green, color: '#000', border: 'none', borderRadius: 20, padding: '7px 16px', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <SpotifyIcon size={13} /> Connect Spotify
          </button>
        )}
      </nav>

      {/* ── Home ── */}
      {page === 'home' && (
        <>
          {/* Hero */}
          <div style={{ padding: '72px 28px 56px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <div style={{ fontSize: 10, letterSpacing: 5, color: T.textMuted, textTransform: 'uppercase', marginBottom: 20, fontWeight: 600 }}>India's fan-first ticket platform</div>
              <h1 style={{ fontSize: 'clamp(36px,6vw,72px)', fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginBottom: 20, color: T.text }}>
                Real fans.<br />Real access.
              </h1>
              <p style={{ fontSize: 16, color: T.textMuted, lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
                Connect your Spotify account. Prove your fandom through your listening history. Get priority early-bird access before bots and resellers.
              </p>
              {!token ? (
                <button onClick={initiateSpotifyLogin} style={{ background: T.green, color: '#000', border: 'none', borderRadius: 24, padding: '12px 26px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SpotifyIcon size={16} /> Get started — connect Spotify
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Avatar src={profile?.images?.[0]?.url} initials={(profile?.display_name || 'U')[0]} color="#fff" size={36} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.display_name}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Connected · fan score active</div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 40, marginTop: 52, paddingTop: 28, borderTop: `1px solid ${T.border}` }}>
                {[['15+', 'upcoming shows'], ['8', 'cities'], ['85+', 'score to book']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>{n}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ padding: '14px 28px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search artist or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 12px', color: T.text, fontSize: 12, outline: 'none', width: 200 }}
            />
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
              style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 12px', color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
              {cities.map(c => <option key={c} style={{ background: '#111' }}>{c}</option>)}
            </select>
            <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
              style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 12px', color: T.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
              {genres.map(g => <option key={g} style={{ background: '#111' }}>{g}</option>)}
            </select>
            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 'auto' }}>{filtered.length} shows</span>
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, padding: 0, borderBottom: `1px solid ${T.border}` }}>
            {filtered.map((concert, i) => (
              <div key={concert.id} style={{ borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: 20 }}>
                <ConcertCard concert={concert} onBook={handleBook} topArtists={topArtists} recentTracks={recentTracks} loggedIn={!!token} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Spotify Dashboard ── */}
      {page === 'dashboard' && token && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>Your data</div>
            <h2 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>Spotify Dashboard</h2>
            <p style={{ color: T.textMuted, marginTop: 6, fontSize: 14 }}>This is exactly what QueueMySeat reads to calculate your fan scores.</p>
          </div>

          {dataLoading ? <Spinner /> : (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
                {[['Top Artists', topArtists.length], ['Recent Tracks', recentTracks.length], ['Elite Artists', topArtists.filter(a => a.popularity >= 85).length], ['Avg Popularity', avgScore]].map(([l, v], i) => (
                  <div key={l} style={{ padding: '18px 20px', borderRight: i < 3 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{l}</div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Top Artists */}
              <div style={{ marginBottom: 8, fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase' }}>Top 5 Artists</div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
                {topArtists.slice(0, 5).map((artist, i) => (
                  <div key={artist.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < 4 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, width: 18 }}>{i + 1}</div>
                    <Avatar src={artist.images?.[2]?.url || artist.images?.[0]?.url} initials={artist.name[0]} color="#fff" size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{artist.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{artist.genres?.slice(0, 3).join(', ')} · {(artist.followers?.total || 0).toLocaleString()} followers</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{artist.popularity}</div>
                      <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>popularity</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent tracks */}
              <div style={{ marginBottom: 8, fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase' }}>Recently Played</div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                {recentTracks.slice(0, 8).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < 7 ? `1px solid ${T.border}` : 'none' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar src={item.track?.album?.images?.[2]?.url} initials={(item.track?.name || '?')[0]} color="#222" size={32} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.track?.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{item.track?.artists?.map(a => a.name).join(', ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>
                      {item.played_at ? new Date(item.played_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Fan Profile ── */}
      {page === 'profile' && token && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${T.border}` }}>
            <Avatar src={profile?.images?.[0]?.url} initials={(profile?.display_name || 'U')[0]} color="#fff" size={72} />
            <div>
              <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Fan profile</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>{profile?.display_name || 'Spotify User'}</div>
              <div style={{ color: T.textMuted, fontSize: 12, marginTop: 4 }}>{profile?.email} · {profile?.country}{profile?.product === 'premium' ? ' · Spotify Premium' : ''}</div>
            </div>
          </div>

          <div style={{ marginBottom: 8, fontSize: 10, color: T.textMuted, letterSpacing: 3, textTransform: 'uppercase' }}>Fan scores — all upcoming shows</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {CONCERTS.map((c, i) => {
              const sd = calcFanScoreDetailed(c, topArtists, recentTracks);
              const ti2 = TIER_INFO[sd.tier];
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < CONCERTS.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: c.accent + '18', border: `1px solid ${c.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: c.accent, flexShrink: 0 }}>{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.artist}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{fmtDate(c.date)} · {c.city}</div>
                  </div>
                  <div style={{ width: 80 }}>
                    <ProgBar pct={sd.total} color={ti2.color} height={2} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: ti2.color, minWidth: 48, textAlign: 'right' }}>{sd.total}/100</div>
                  <div style={{ fontSize: 9, color: ti2.canBook ? '#1DB954' : '#ef4444', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', minWidth: 52, textAlign: 'right' }}>{ti2.canBook ? 'Can book' : 'Blocked'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── My Tickets ── */}
      {page === 'tickets' && (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 28px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 8 }}>Booked</div>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>My Tickets</h2>
          </div>
          {bookedList.length === 0 ? (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: '48px 28px', textAlign: 'center', color: T.textMuted, fontSize: 14 }}>No tickets yet. Browse concerts and book your first show.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookedList.map((entry, i) => (
                <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 2, background: entry.concert.accent }} />
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{entry.concert.artist}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{fmtDate(entry.concert.date)} · {entry.concert.venue}, {entry.concert.city}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Queue</div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>#{entry.queuePos}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 0, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      {[['Tickets', entry.tickets], ['Total', INR(entry.total)], ['Fan Score', entry.fanScore + '/100']].map(([l, v], idx) => (
                        <div key={l} style={{ flex: 1, padding: '10px 12px', borderRight: idx < 2 ? `1px solid ${T.border}` : 'none' }}>
                          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {entry.addFriends && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10 }}>+2 friends at early-bird price included</div>}
                    {entry.extraTickets > 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Loyalty bonus: +{entry.extraTickets} extra ticket{entry.extraTickets > 1 ? 's' : ''}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bookingModal && <BookingModal concert={bookingModal} topArtists={topArtists} recentTracks={recentTracks} onClose={() => setBookingModal(null)} onSuccess={handleSuccess} loyaltyUsed={loyaltyUsed} setLoyaltyUsed={setLoyaltyUsed} />}
      {successModal && <SuccessModal data={successModal} onClose={() => setSuccessModal(null)} onViewTickets={() => { setSuccessModal(null); setPage('tickets'); }} />}
    </div>
  );
}
