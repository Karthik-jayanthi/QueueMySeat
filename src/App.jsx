import { useState, useEffect } from 'react';
import {
  initiateSpotifyLogin, exchangeCodeForToken, getValidToken, logout,
  fetchSpotifyProfile, fetchTopArtists, fetchRecentlyPlayed, fetchArtistTopTracks,
} from './spotify.js';
import { CONCERTS, INR, fmtDate, remaining, fillPct } from './concerts.js';
import { calcFanScoreDetailed, calcFanScore, calcQueuePosition, TIER_INFO } from './fanScore.js';

// ─── Primitives ───────────────────────────────────────────
const Avatar = ({ src, initials, color, size }) => {
  const [err, setErr] = useState(false);
  const sz = size || 44;
  const s = { width:sz, height:sz, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:Math.round(sz*0.33), color:'#fff', background:color||'#7b2ff7', letterSpacing:1, overflow:'hidden' };
  if (src && !err) return <img src={src} alt={initials} style={{...s,objectFit:'cover'}} onError={()=>setErr(true)} />;
  return <div style={s}>{initials}</div>;
};
const Badge = ({ label, color }) => (
  <span style={{ background:(color||'#7b2ff7')+'22', color:color||'#7b2ff7', border:'1px solid '+(color||'#7b2ff7')+'44', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{label}</span>
);
const ProgBar = ({ pct, color, height }) => (
  <div style={{ background:'#ffffff18', borderRadius:4, height:height||5, overflow:'hidden' }}>
    <div style={{ width:Math.min(100,Math.max(0,isNaN(pct)?0:pct))+'%', background:color||'#7b2ff7', height:'100%', borderRadius:4, transition:'width 0.5s ease' }} />
  </div>
);
const Spinner = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, flexDirection:'column', gap:16 }}>
    <div style={{ width:36, height:36, border:'3px solid #333', borderTop:'3px solid #7b2ff7', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);
const SpotifyIcon = ({ size }) => (
  <svg width={size||16} height={size||16} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

// ─── Artist Profile Modal ─────────────────────────────────
function ArtistProfileModal({ artist, recentTracks, token, onClose }) {
  const [topTracks, setTopTracks] = useState([]);
  const [fullArtist, setFullArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artist || !token) return;
    setLoading(true);
    Promise.all([
      fetch('https://api.spotify.com/v1/artists/' + artist.id, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch('https://api.spotify.com/v1/artists/' + artist.id + '/top-tracks?market=IN', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ]).then(([artistData, tracksData]) => {
      setFullArtist(artistData);
      setTopTracks(tracksData.tracks || []);
      setLoading(false);
    }).catch(() => {
      setFullArtist(artist);
      setLoading(false);
    });
  }, [artist, token]);

  if (!artist) return null;

  const displayArtist = fullArtist || artist;
  const popularity = typeof displayArtist.popularity === 'number' ? displayArtist.popularity : null;
  const followers = displayArtist.followers?.total;

  // Count plays in recent history
  const artistRecentTracks = recentTracks.filter(item =>
    item.track?.artists?.some(a => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase())
  );
  const playCount = artistRecentTracks.length;
  // Estimate minutes from actual track durations
  const totalMs = artistRecentTracks.reduce((sum, item) => sum + (item.track?.duration_ms || 210000), 0);
  const estimatedMinutes = Math.round(totalMs / 60000);

  // Most repeated song
  const songCounts = {};
  artistRecentTracks.forEach(item => {
    const name = item.track?.name;
    if (name) songCounts[name] = (songCounts[name] || 0) + 1;
  });
  const mostRepeated = Object.entries(songCounts).sort((a,b) => b[1]-a[1])[0];

  // Most & least popular from top tracks
  const sortedByPop = [...topTracks].sort((a,b) => (b.popularity||0) - (a.popularity||0));
  const mostPopular = sortedByPop[0];
  const leastPopular = sortedByPop[sortedByPop.length - 1];

  const fmtMs = (ms) => {
    const m = Math.floor((ms||0)/60000);
    const s = Math.floor(((ms||0)%60000)/1000).toString().padStart(2,'0');
    return m+':'+s;
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#141414', border:'1px solid #2a2a2a', borderRadius:20, padding:24, maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', gap:14, alignItems:'center' }}>
            <Avatar src={displayArtist.images?.[0]?.url} initials={displayArtist.name[0]} color="#7b2ff7" size={64} />
            <div>
              <div style={{ fontSize:22, fontWeight:900 }}>{displayArtist.name}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:3 }}>{displayArtist.genres?.slice(0,3).join(', ') || 'Loading genres...'}</div>
              {followers > 0 && <div style={{ fontSize:12, color:'#1DB954', marginTop:4 }}>{followers.toLocaleString()} followers on Spotify</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
        </div>

        {loading ? <Spinner /> : (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
              {[
                ['Popularity', popularity !== null ? popularity + '/100' : 'N/A'],
                ['Times Played', playCount > 0 ? playCount + 'x recently' : 'Not in history'],
                ['Est. Minutes', estimatedMinutes > 0 ? estimatedMinutes + ' min' : 'Not tracked'],
              ].map(([l,v]) => (
                <div key={l} style={{ background:'#1a1a1a', borderRadius:10, padding:'12px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#666', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#a78bfa' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Popularity bar */}
            {popularity !== null && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:4 }}>
                  <span>Spotify Popularity</span><span style={{ color:'#a78bfa', fontWeight:700 }}>{popularity}/100</span>
                </div>
                <ProgBar pct={popularity} color="#7b2ff7" height={6} />
              </div>
            )}

            {/* Most repeated */}
            {mostRepeated && (
              <div style={{ background:'#7b2ff711', border:'1px solid #7b2ff733', borderRadius:10, padding:12, marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#a78bfa', fontWeight:700, marginBottom:4 }}>🔁 Most Repeated in Your History</div>
                <div style={{ fontWeight:600, fontSize:14 }}>{mostRepeated[0]}</div>
                <div style={{ fontSize:11, color:'#888' }}>Played {mostRepeated[1]}x in your recent tracks</div>
              </div>
            )}

            {topTracks.length > 0 && (
              <>
                {/* Most popular track */}
                {mostPopular && (
                  <div style={{ background:'#10b98111', border:'1px solid #10b98133', borderRadius:10, padding:12, marginBottom:10 }}>
                    <div style={{ fontSize:11, color:'#10b981', fontWeight:700, marginBottom:6 }}>🔥 Most Popular Track</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {mostPopular.album?.images?.[2]?.url && <img src={mostPopular.album.images[2].url} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:'cover' }} />}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{mostPopular.name}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{mostPopular.album?.name} · {fmtMs(mostPopular.duration_ms)}</div>
                      </div>
                      <div style={{ color:'#10b981', fontWeight:700, fontSize:13 }}>{mostPopular.popularity}/100</div>
                    </div>
                  </div>
                )}

                {/* Least popular track */}
                {leastPopular && leastPopular.id !== mostPopular?.id && (
                  <div style={{ background:'#ef444411', border:'1px solid #ef444433', borderRadius:10, padding:12, marginBottom:14 }}>
                    <div style={{ fontSize:11, color:'#ef4444', fontWeight:700, marginBottom:6 }}>💎 Deep Cut (Least Mainstream)</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {leastPopular.album?.images?.[2]?.url && <img src={leastPopular.album.images[2].url} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:'cover' }} />}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{leastPopular.name}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{leastPopular.album?.name} · {fmtMs(leastPopular.duration_ms)}</div>
                      </div>
                      <div style={{ color:'#ef4444', fontWeight:700, fontSize:13 }}>{leastPopular.popularity}/100</div>
                    </div>
                  </div>
                )}

                {/* Top 5 tracks */}
                <div style={{ fontSize:13, fontWeight:700, color:'#888', marginBottom:8 }}>Top Tracks on Spotify</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {topTracks.slice(0,5).map((track, i) => (
                    <div key={track.id} style={{ display:'flex', alignItems:'center', gap:10, background:'#1a1a1a', borderRadius:8, padding:'8px 12px' }}>
                      <div style={{ color:'#555', fontWeight:700, width:18, fontSize:12 }}>#{i+1}</div>
                      {track.album?.images?.[2]?.url && <img src={track.album.images[2].url} alt="" style={{ width:34, height:34, borderRadius:5, objectFit:'cover' }} />}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:500, fontSize:13 }}>{track.name}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{fmtMs(track.duration_ms)}</div>
                      </div>
                      <div style={{ color:'#a78bfa', fontSize:12, fontWeight:600 }}>{track.popularity}/100</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Score Breakdown Card ─────────────────────────────────
function ScoreBreakdown({ scoreData, concert }) {
  if (!scoreData || !scoreData.breakdown) return null;
  const { total, breakdown, tier } = scoreData;
  const ti = TIER_INFO[tier];
  const safeTotal = isNaN(total) ? 0 : total;
  const rows = [
    { label: 'Artist Match',       pts: breakdown.artistMatch||0,      max: 50, reason: breakdown.artistMatchReason },
    { label: 'Popularity Weight',  pts: breakdown.popularityWeight||0, max: 20, reason: breakdown.matchedArtist ? breakdown.matchedArtist.popularity + '/100 popularity on Spotify' : 'N/A' },
    { label: 'Listening Recency',  pts: breakdown.listeningRecency||0, max: 20, reason: breakdown.recencyReason },
    { label: 'Genre Depth',        pts: breakdown.genreDepth||0,       max: 10, reason: breakdown.genreDepthReason },
  ];
  return (
    <div style={{ background:'#0f0f0f', border:'1px solid #2a2a2a', borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>Your Fan Score for {concert.artist}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <span style={{ fontSize:36, fontWeight:900, color:ti.color }}>{safeTotal}</span>
            <span style={{ fontSize:14, color:'#555' }}>/100</span>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <Badge label={ti.label.toUpperCase()} color={ti.color} />
          {tier === 'casual' && <div style={{ fontSize:10, color:'#ef4444', marginTop:6, maxWidth:120, textAlign:'right' }}>Score must be 85+ to book early-bird</div>}
          {tier !== 'casual' && tier !== 'no_data' && <div style={{ fontSize:10, color:'#888', marginTop:6 }}>Queue priority: high</div>}
        </div>
      </div>
      <ProgBar pct={safeTotal} color={ti.color} height={8} />
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#555', marginTop:4, marginBottom:12 }}>
        <span>0</span><span style={{ color:ti.color, fontWeight:700 }}>{safeTotal}</span><span>100</span>
      </div>
      {rows.map(row => (
        <div key={row.label} style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:12, color:'#aaa' }}>{row.label}</span>
            <span style={{ fontSize:12, fontWeight:700, color: row.pts > 0 ? '#f0f0f0' : '#444' }}>{row.pts}/{row.max}</span>
          </div>
          <ProgBar pct={(row.pts/row.max)*100} color={row.pts>0?ti.color:'#2a2a2a'} height={4} />
          <div style={{ fontSize:10, color:'#555', marginTop:3 }}>{row.reason}</div>
        </div>
      ))}
      {tier === 'casual' && (
        <div style={{ background:'#ef444411', border:'1px solid #ef444433', borderRadius:8, padding:10, marginTop:8 }}>
          <div style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>⛔ Early-bird access blocked</div>
          <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>Your fan score ({safeTotal}/100) is below the 85 minimum required for early-bird booking. Listen to more {concert.artist} music on Spotify to increase your score.</div>
        </div>
      )}
      {tier === 'growing' && (
        <div style={{ background:'#7b2ff711', border:'1px solid #7b2ff733', borderRadius:8, padding:10, marginTop:8 }}>
          <div style={{ fontSize:11, color:'#a78bfa' }}>You can book but you're {85 - safeTotal} points away from Elite Fan status and the loyalty bonus.</div>
        </div>
      )}
    </div>
  );
}

// ─── Concert Card ─────────────────────────────────────────
function ConcertCard({ concert, onBook, topArtists, recentTracks, loggedIn }) {
  const scoreData = calcFanScoreDetailed(concert, topArtists, recentTracks);
  const { total: fanScoreRaw, tier } = scoreData;
  const fanScore = isNaN(fanScoreRaw) ? 0 : fanScoreRaw;
  const ti = TIER_INFO[tier];
  const rem = remaining(concert);
  const pct = fillPct(concert);
  const isSoldOut = rem <= 0;
  const isAlmost = rem > 0 && rem <= 20;
  const [hovered, setHovered] = useState(false);

  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ background:'linear-gradient(140deg,'+concert.color+' 0%,#111 100%)', border:'1px solid '+(hovered?concert.accent+'55':'#ffffff12'), borderRadius:16, overflow:'hidden', transition:'all 0.22s', transform:hovered?'translateY(-4px)':'none', boxShadow:hovered?'0 18px 40px '+concert.accent+'28':'none' }}>
      <div style={{ background:concert.accent+'1a', borderBottom:'1px solid '+concert.accent+'22', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:5 }}>
          {concert.genre.slice(0,2).map(g => <span key={g} style={{ background:concert.accent+'22', color:concert.accent, border:'1px solid '+concert.accent+'33', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5 }}>{g}</span>)}
        </div>
        {loggedIn && fanScore > 0 && <Badge label={ti.label.toUpperCase()} color={ti.color} />}
      </div>
      <div style={{ padding:18 }}>
        <div style={{ display:'flex', gap:13, marginBottom:14, alignItems:'flex-start' }}>
          <Avatar initials={concert.initials} color={concert.accent} size={50} />
          <div>
            <div style={{ fontSize:19, fontWeight:800, lineHeight:1.2 }}>{concert.artist}</div>
            <div style={{ fontSize:12, color:'#aaa', marginTop:3 }}>🏟 {concert.venue}</div>
            <div style={{ fontSize:12, color:'#aaa' }}>📍 {concert.city}</div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1e1e1e', fontSize:12 }}>
          <span style={{ color:'#888' }}>📅 {fmtDate(concert.date)}</span>
          <span style={{ color:'#888' }}>⏰ {concert.time}</span>
        </div>
        {loggedIn && fanScore > 0 && (
          <div style={{ margin:'10px 0 4px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
              <span style={{ color:'#888' }}>Fan Score</span>
              <span style={{ color:ti.color, fontWeight:700 }}>{fanScore}/100</span>
            </div>
            <ProgBar pct={fanScore} color={ti.color} height={4} />
          </div>
        )}
        <div style={{ margin:'10px 0 6px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:5 }}>
            <span>Early-bird seats</span>
            <span style={{ color:isSoldOut?'#ef4444':isAlmost?'#f59e0b':'#888', fontWeight:isAlmost||isSoldOut?700:400 }}>
              {isSoldOut?'Sold Out':isAlmost?'Only '+rem+' left!':rem+' remaining'}
            </span>
          </div>
          <ProgBar pct={pct} color={concert.accent} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:concert.accent }}>{INR(concert.earlyBirdPrice)}</div>
            <div style={{ fontSize:10, color:'#666' }}><s>{INR(concert.basePrice)}</s> GA early-bird</div>
          </div>
          <button onClick={()=>onBook(concert)} disabled={isSoldOut}
            style={{ background:isSoldOut?'#2a2a2a':concert.accent, color:isSoldOut?'#555':'#fff', border:'none', borderRadius:10, padding:'10px 16px', fontWeight:700, fontSize:13, cursor:isSoldOut?'not-allowed':'pointer' }}>
            {isSoldOut?'Sold Out':'🎟 Book Early-Bird'}
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

  const scoreData = calcFanScoreDetailed(concert, topArtists, recentTracks);
  const { total: fanScoreRaw, tier } = scoreData;
  const fanScore = isNaN(fanScoreRaw) ? 0 : fanScoreRaw;
  const ti = TIER_INFO[tier];
  const canBook = ti.canBook;
  const canLoyalty = tier === 'elite' && !loyaltyUsed[concert.artist];
  const queuePos = calcQueuePosition(concert, fanScore);
  const rem = remaining(concert);
  const tickets = 1 + (addFriends?2:0) + extraTickets;
  const total = tickets * concert.earlyBirdPrice;
  const savings = tickets * (concert.basePrice - concert.earlyBirdPrice);

  const friendsPenalty = addFriends ? 8 : 0;
  const extraPenalty = extraTickets * 6;
  const totalPenalty = friendsPenalty + extraPenalty;
  const newScore = Math.max(0, fanScore - totalPenalty);

  const confirmBooking = () => {
    setStep(4);
    setTimeout(() => {
      if (addFriends || extraTickets > 0) {
        setLoyaltyUsed(prev => ({ ...prev, [concert.artist]: true }));
      }
      onSuccess({ concert, queuePos, tickets, total, addFriends, extraTickets, fanScore, newScore });
    }, 1800);
  };

  const OL = { position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 };
  const BOX = { background:'#141414', border:'1px solid #2a2a2a', borderRadius:20, padding:26, maxWidth:480, width:'100%', maxHeight:'92vh', overflowY:'auto' };
  const PB = (disabled) => ({ background:disabled?'#2a2a2a':'#7b2ff7', color:disabled?'#555':'#fff', border:'none', borderRadius:10, padding:'13px 24px', fontWeight:700, fontSize:15, cursor:disabled?'not-allowed':'pointer', width:'100%', marginTop:8 });
  const SB = { background:'transparent', color:'#aaa', border:'1px solid #2a2a2a', borderRadius:10, padding:'11px 20px', fontWeight:500, fontSize:14, cursor:'pointer', width:'100%', marginTop:8 };
  const IR = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1e1e1e', fontSize:13 };

  return (
    <div style={OL} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={BOX}>
        {step===4 && (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <Spinner />
            <div style={{ fontSize:16, fontWeight:600, marginTop:8 }}>Securing your seats...</div>
            <div style={{ color:'#888', fontSize:13, marginTop:6 }}>Locking your early-bird position</div>
          </div>
        )}
        {step===1 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:11, color:'#7b2ff7', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Fan Verification</div>
                <h2 style={{ fontSize:20, fontWeight:900, margin:0 }}>Your Fan Score</h2>
              </div>
              <button onClick={onClose} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ background:concert.color, border:'1px solid '+concert.accent+'33', borderRadius:12, padding:14, marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
              <Avatar initials={concert.initials} color={concert.accent} size={44} />
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>{concert.artist}</div>
                <div style={{ fontSize:12, color:'#bbb' }}>{fmtDate(concert.date)} · {concert.city}</div>
              </div>
            </div>
            <ScoreBreakdown scoreData={{...scoreData, total: fanScore}} concert={concert} />
            {canBook ? (
              <button style={PB(false)} onClick={()=>setStep(2)}>
                {tier==='elite'?'🌟 Elite Fan — Continue to Book':'✓ Verified — Continue to Book'}
              </button>
            ) : (
              <>
                <div style={{ background:'#1a1a1a', borderRadius:10, padding:14, marginBottom:12 }}>
                  <div style={{ fontSize:13, color:'#aaa', lineHeight:1.6 }}>To unlock early-bird booking, listen to more <strong style={{ color:'#fff' }}>{concert.artist}</strong> on Spotify. Your score needs to reach <strong style={{ color:'#7b2ff7' }}>85+</strong>.</div>
                </div>
                <button style={SB} onClick={onClose}>Close</button>
              </>
            )}
          </>
        )}
        {step===2 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:900, margin:0 }}>Ticket Details</h2>
              <button onClick={onClose} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ background:'#1a1a1a', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={IR}><span style={{ color:'#888' }}>Queue Position</span><span style={{ fontWeight:700, color:'#7b2ff7' }}>#{queuePos}</span></div>
              <div style={IR}><span style={{ color:'#888' }}>Fan Score</span><span style={{ fontWeight:700, color:ti.color }}>{fanScore}/100</span></div>
              <div style={{ ...IR, borderBottom:'none' }}><span style={{ color:'#888' }}>Price per ticket</span><span style={{ fontWeight:700 }}>{INR(concert.earlyBirdPrice)}</span></div>
            </div>
            <div style={{ background:'#1a1a1a', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:600 }}>+ 2 Friends</div>
                  <div style={{ fontSize:11, color:'#888' }}>Add 2 more at early-bird price</div>
                  <div style={{ fontSize:10, color:'#ef4444', marginTop:2 }}>-8 pts fan score penalty</div>
                </div>
                <button onClick={()=>setAddFriends(!addFriends)} style={{ background:addFriends?'#7b2ff7':'#2a2a2a', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontWeight:600, fontSize:13 }}>{addFriends?'✓ Added':'Add'}</button>
              </div>
              {canLoyalty && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #2a2a2a', paddingTop:10 }}>
                  <div>
                    <div style={{ fontWeight:600, color:'#f59e0b' }}>🌟 Loyalty Bonus</div>
                    <div style={{ fontSize:11, color:'#888' }}>Elite fan: extra tickets</div>
                    <div style={{ fontSize:10, color:'#ef4444', marginTop:2 }}>-6 pts per extra ticket</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button onClick={()=>setExtraTickets(Math.max(0,extraTickets-1))} style={{ background:'#2a2a2a', color:'#fff', border:'none', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16 }}>-</button>
                    <span style={{ fontWeight:700, minWidth:20, textAlign:'center' }}>{extraTickets}</span>
                    <button onClick={()=>setExtraTickets(Math.min(3,extraTickets+1))} style={{ background:'#2a2a2a', color:'#fff', border:'none', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16 }}>+</button>
                  </div>
                </div>
              )}
            </div>
            {totalPenalty > 0 && (
              <div style={{ background:'#ef444411', border:'1px solid #ef444433', borderRadius:8, padding:10, marginBottom:14, fontSize:12, color:'#f87171' }}>
                ⚠️ Score penalty: -{totalPenalty} pts → New score: {newScore}/100
              </div>
            )}
            <button style={PB(false)} onClick={()=>setStep(3)}>Continue → {tickets} ticket{tickets>1?'s':''} · {INR(total)}</button>
            <button style={SB} onClick={()=>setStep(1)}>← Back</button>
          </>
        )}
        {step===3 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:900, margin:0 }}>Confirm & Pay</h2>
              <button onClick={onClose} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ background:'#1a1a1a', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={IR}><span style={{ color:'#888' }}>Artist</span><span style={{ fontWeight:600 }}>{concert.artist}</span></div>
              <div style={IR}><span style={{ color:'#888' }}>Date</span><span>{fmtDate(concert.date)} · {concert.time}</span></div>
              <div style={IR}><span style={{ color:'#888' }}>Venue</span><span>{concert.venue}, {concert.city}</span></div>
              <div style={IR}><span style={{ color:'#888' }}>Tickets</span><span style={{ fontWeight:600 }}>{tickets}</span></div>
              <div style={IR}><span style={{ color:'#888' }}>You save</span><span style={{ color:'#10b981', fontWeight:600 }}>{INR(savings)}</span></div>
              <div style={{ ...IR, borderBottom:'none' }}><span style={{ fontWeight:700, fontSize:15 }}>Total</span><span style={{ fontWeight:900, fontSize:18, color:'#7b2ff7' }}>{INR(total)}</span></div>
            </div>
            <button style={PB(false)} onClick={confirmBooking}>✓ Confirm Booking</button>
            <button style={SB} onClick={()=>setStep(2)}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Success Modal ────────────────────────────────────────
function SuccessModal({ data, onClose, onViewTickets }) {
  const { concert, queuePos, tickets, total, fanScore, newScore } = data;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:350, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#141414', border:'1px solid '+concert.accent+'44', borderRadius:20, padding:28, maxWidth:420, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
        <div style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>You're In!</div>
        <div style={{ color:'#888', marginBottom:20, fontSize:14 }}>Early-bird spot secured for {concert.artist}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
          {[['Queue', '#'+queuePos],['Tickets', tickets],['Total', INR(total)]].map(([l,v])=>(
            <div key={l} style={{ background:'#1a1a1a', borderRadius:10, padding:'10px 8px' }}>
              <div style={{ fontSize:10, color:'#666', marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:16, fontWeight:800, color:concert.accent }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'#1a1a1a', borderRadius:10, padding:12, marginBottom:18, fontSize:12, color:'#888' }}>
          Fan score: {fanScore} → {newScore}/100 after booking
        </div>
        <button onClick={onViewTickets} style={{ background:concert.accent, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer', width:'100%', marginBottom:8 }}>View My Tickets</button>
        <button onClick={onClose} style={{ background:'transparent', color:'#aaa', border:'1px solid #2a2a2a', borderRadius:10, padding:'10px 20px', fontWeight:500, fontSize:13, cursor:'pointer', width:'100%' }}>Close</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [bookedList, setBookedList] = useState([]);
  const [bookingModal, setBookingModal] = useState(null);
  const [successModal, setSuccessModal] = useState(null);
  const [loyaltyUsed, setLoyaltyUsed] = useState({});
  const [filterCity, setFilterCity] = useState('All');
  const [filterGenre, setFilterGenre] = useState('All');
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showAllArtists, setShowAllArtists] = useState(false);

  const loadSpotifyData = async (accessToken) => {
    setDataLoading(true);
    try {
      const [p, a, r] = await Promise.all([
        fetchSpotifyProfile(accessToken),
        fetchTopArtists(accessToken),
        fetchRecentlyPlayed(accessToken),
      ]);
      setProfile(p);
      setTopArtists(a.items || []);
      setRecentTracks(r.items || []);
    } catch (err) { console.error(err); }
    setDataLoading(false);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) { window.history.replaceState({},'',' /'); setLoading(false); return; }
    if (code) {
      window.history.replaceState({}, '', '/');
      exchangeCodeForToken(code).then(t => { setToken(t); loadSpotifyData(t); }).catch(() => setLoading(false));
      return;
    }
    getValidToken().then(t => { if (t) { setToken(t); loadSpotifyData(t); } else setLoading(false); });
  }, []);

  const handleLogout = () => { logout(); setToken(null); setProfile(null); setTopArtists([]); setRecentTracks([]); setPage('home'); };
  const handleBook = (concert) => { if (!token) { initiateSpotifyLogin(); return; } setBookingModal(concert); };
  const handleSuccess = (data) => { setBookedList(prev => [...prev, data]); setBookingModal(null); setSuccessModal(data); };

  const cities = ['All', ...new Set(CONCERTS.map(c => c.city))];
  const genres = ['All','pop','rock','EDM','Bollywood','hip-hop','indie','dance','R&B','trance','soul'];
  const filtered = CONCERTS.filter(c => {
    if (filterCity !== 'All' && c.city !== filterCity) return false;
    if (filterGenre !== 'All' && !c.genre.some(g => g.toLowerCase().includes(filterGenre.toLowerCase()))) return false;
    if (search && !c.artist.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const avgScore = topArtists.length ? Math.round(topArtists.reduce((s,a)=>s+(a.popularity||0),0)/topArtists.length) : 0;
  const NB = (active) => ({ background:active?'#7b2ff722':'transparent', color:active?'#a78bfa':'#aaa', border:active?'1px solid #7b2ff744':'1px solid transparent', borderRadius:8, padding:'5px 13px', cursor:'pointer', fontSize:13, fontWeight:500 });

  // Filter today's recently played
  const todayStr = new Date().toDateString();
  const todayTracks = recentTracks.filter(item => {
    if (!item.played_at) return false;
    return new Date(item.played_at).toDateString() === todayStr;
  });
  const displayTracks = todayTracks.length > 0 ? todayTracks : recentTracks.slice(0, 10);
  const showingToday = todayTracks.length > 0;

  if (loading) return <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner /></div>;

  const artistsToShow = showAllArtists ? topArtists : topArtists.slice(0, 5);

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', color:'#f0f0f0' }}>
      <nav style={{ position:'sticky', top:0, zIndex:200, height:58, background:'rgba(13,13,13,0.95)', backdropFilter:'blur(14px)', borderBottom:'1px solid #ffffff15', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <span style={{ fontSize:20, fontWeight:900, cursor:'pointer', color:'#fff', letterSpacing:-0.5 }} onClick={()=>setPage('home')}>Queue<span style={{ color:'#7b2ff7' }}>My</span>Seat</span>
        <div style={{ display:'flex', gap:4 }}>
          <button style={NB(page==='home')} onClick={()=>setPage('home')}>Concerts</button>
          {token && <button style={NB(page==='dashboard')} onClick={()=>setPage('dashboard')}>My Spotify</button>}
          {token && <button style={NB(page==='profile')} onClick={()=>setPage('profile')}>Fan Profile</button>}
          {token && bookedList.length>0 && <button style={NB(page==='tickets')} onClick={()=>setPage('tickets')}>My Tickets ({bookedList.length})</button>}
        </div>
        {token && profile ? (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Avatar src={profile.images?.[0]?.url} initials={(profile.display_name||'U')[0].toUpperCase()} color="#7b2ff7" size={34} />
            <span style={{ fontSize:13, color:'#ccc', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.display_name}</span>
            <button onClick={handleLogout} style={{ background:'transparent', color:'#aaa', border:'1px solid #2a2a2a', borderRadius:8, padding:'5px 11px', cursor:'pointer', fontSize:12 }}>Logout</button>
          </div>
        ) : (
          <button onClick={initiateSpotifyLogin} style={{ background:'#1DB954', color:'#fff', border:'none', borderRadius:24, padding:'8px 18px', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
            <SpotifyIcon size={16} /> Connect Spotify
          </button>
        )}
      </nav>

      {page==='home' && (
        <>
          <div style={{ background:'linear-gradient(135deg,#1a0a2e 0%,#0d0d0d 55%,#0a1628 100%)', padding:'64px 24px 48px', textAlign:'center', borderBottom:'1px solid #ffffff0d' }}>
            <div style={{ fontSize:11, letterSpacing:4, color:'#7b2ff7', textTransform:'uppercase', marginBottom:14, fontWeight:700 }}>India's Fan-First Ticket Platform</div>
            <h1 style={{ fontSize:'clamp(30px,5.5vw,58px)', fontWeight:900, letterSpacing:-2, lineHeight:1.1, marginBottom:14 }}>
              <span style={{ color:'#7b2ff7' }}>Real fans</span> get<br /><span style={{ color:'#fff' }}>real access.</span>
            </h1>
            <p style={{ fontSize:16, color:'#aaa', maxWidth:520, margin:'0 auto 28px', lineHeight:1.65 }}>Connect Spotify. Prove your fandom. Skip the bots.</p>
            {!token && <button onClick={initiateSpotifyLogin} style={{ background:'#1DB954', color:'#fff', border:'none', borderRadius:24, padding:'13px 30px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:8, margin:'0 auto' }}><SpotifyIcon size={20} /> Get Started — Connect Spotify</button>}
            <div style={{ display:'flex', gap:36, justifyContent:'center', marginTop:36 }}>
              {[['15+','Shows'],['8','Cities'],['85+','Score to Book']].map(([n,l])=>(
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#7b2ff7' }}>{n}</div>
                  <div style={{ fontSize:11, color:'#777', marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, padding:'12px 20px', flexWrap:'wrap', borderBottom:'1px solid #ffffff0d', background:'#0f0f0f', alignItems:'center' }}>
            <input style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, outline:'none', width:190 }} placeholder="Search artist or city..." value={search} onChange={e=>setSearch(e.target.value)} />
            <select style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, cursor:'pointer', outline:'none' }} value={filterCity} onChange={e=>setFilterCity(e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select>
            <select style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, cursor:'pointer', outline:'none' }} value={filterGenre} onChange={e=>setFilterGenre(e.target.value)}>{genres.map(g=><option key={g}>{g}</option>)}</select>
            <span style={{ fontSize:12, color:'#555', marginLeft:'auto' }}>{filtered.length} shows</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:18, padding:22 }}>
            {filtered.map(concert=><ConcertCard key={concert.id} concert={concert} onBook={handleBook} topArtists={topArtists} recentTracks={recentTracks} loggedIn={!!token} />)}
          </div>
        </>
      )}

      {page==='dashboard' && token && (
        <div style={{ padding:24, maxWidth:880, margin:'0 auto' }}>
          <h2 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Your Spotify Data</h2>
          <p style={{ color:'#888', marginBottom:24, fontSize:14 }}>This is what QueueMySeat reads to calculate your fan score.</p>
          {dataLoading ? <Spinner /> : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
                {[['Top Artists',topArtists.length],['Recent Tracks',recentTracks.length],['Elite Artists',topArtists.filter(a=>a.popularity>=85).length],['Avg Popularity',avgScore]].map(([l,v])=>(
                  <div key={l} style={{ background:'#1a1a1a', borderRadius:11, padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:'#777', marginBottom:6 }}>{l}</div>
                    <div style={{ fontSize:26, fontWeight:900, color:'#7b2ff7' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Top Artists — all, clickable */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:17, fontWeight:700, margin:0 }}>Your Top Artists ({topArtists.length})</h3>
                {topArtists.length > 5 && (
                  <button onClick={()=>setShowAllArtists(!showAllArtists)}
                    style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', color:'#a78bfa', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    {showAllArtists ? 'Show Less ▲' : 'Show All ▼'}
                  </button>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
                {artistsToShow.map((artist,i)=>(
                  <div key={artist.id}
                    onClick={()=>setSelectedArtist(artist)}
                    style={{ background:'#141414', border:'1px solid #1e1e1e', borderRadius:12, padding:13, display:'flex', alignItems:'center', gap:13, cursor:'pointer', transition:'border-color 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#7b2ff7'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#1e1e1e'}>
                    <div style={{ color:'#444', fontWeight:800, width:20, fontSize:13 }}>#{i+1}</div>
                    <Avatar src={artist.images?.[2]?.url||artist.images?.[0]?.url} initials={artist.name[0]} color="#7b2ff7" size={46} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{artist.name}</div>
                      <div style={{ fontSize:11, color:'#888' }}>{artist.genres?.slice(0,3).join(', ') || 'tap to see details'}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {typeof artist.popularity === 'number' && <div style={{ color:'#a78bfa', fontWeight:700, fontSize:13 }}>{artist.popularity}/100</div>}
                      {(artist.popularity||0)>=85&&<Badge label="ELITE" color="#f59e0b"/>}
                      {(artist.popularity||0)>=70&&(artist.popularity||0)<85&&<Badge label="TOP" color="#10b981"/>}
                    </div>
                    <div style={{ color:'#555', fontSize:11 }}>→</div>
                  </div>
                ))}
              </div>

              {/* Recently Played — today only */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:17, fontWeight:700, margin:0 }}>Recently Played</h3>
                <span style={{ fontSize:11, color: showingToday ? '#10b981' : '#888', background: showingToday ? '#10b98122' : '#1a1a1a', border:'1px solid '+(showingToday?'#10b98133':'#2a2a2a'), borderRadius:20, padding:'3px 10px' }}>
                  {showingToday ? '✓ Today\'s tracks' : 'Latest available'}
                </span>
              </div>
              <div style={{ background:'#141414', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' }}>
                {displayTracks.length === 0 ? (
                  <div style={{ padding:24, textAlign:'center', color:'#555' }}>No tracks played yet today</div>
                ) : displayTracks.map((item,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px', borderBottom:i<displayTracks.length-1?'1px solid #1a1a1a':'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar src={item.track?.album?.images?.[2]?.url} initials={(item.track?.name||'?')[0]} color="#333" size={34} />
                      <div>
                        <div style={{ fontWeight:500, fontSize:14 }}>{item.track?.name}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{item.track?.artists?.map(a=>a.name).join(', ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'#444', alignSelf:'center' }}>
                      {item.played_at ? new Date(item.played_at).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {page==='profile' && token && (
        <div style={{ padding:24, maxWidth:840, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:28 }}>
            <Avatar src={profile?.images?.[0]?.url} initials={(profile?.display_name||'U')[0]} color="#7b2ff7" size={72} />
            <div>
              <div style={{ fontSize:26, fontWeight:900 }}>{profile?.display_name||'Spotify User'}</div>
              <div style={{ color:'#888', fontSize:13 }}>{profile?.email} · {profile?.country}</div>
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                <Badge label={'AVG SCORE: '+avgScore+'/100'} color="#7b2ff7" />
                {profile?.product==='premium'&&<Badge label="SPOTIFY PREMIUM" color="#1DB954"/>}
              </div>
            </div>
          </div>
          <h3 style={{ fontSize:17, fontWeight:700, marginBottom:12 }}>Your Fan Scores for Upcoming Shows</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {CONCERTS.map(c=>{
              const sd = calcFanScoreDetailed(c, topArtists, recentTracks);
              const safeTotal = isNaN(sd.total) ? 0 : sd.total;
              const ti2 = TIER_INFO[sd.tier];
              return (
                <div key={c.id} style={{ background:'#141414', border:'1px solid '+c.accent+'22', borderRadius:12, padding:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                    <Avatar initials={c.initials} color={c.accent} size={40} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700 }}>{c.artist}</div>
                      <div style={{ fontSize:11, color:'#888' }}>{fmtDate(c.date)} · {c.city}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:18, fontWeight:900, color:ti2.color }}>{safeTotal}/100</div>
                      <Badge label={ti2.label.toUpperCase()} color={ti2.color} />
                    </div>
                  </div>
                  <ProgBar pct={safeTotal} color={ti2.color} height={4} />
                  <div style={{ fontSize:10, color:'#555', marginTop:4 }}>
                    {ti2.canBook ? (sd.tier==='elite'?'✓ Elite — booking + loyalty bonus unlocked':'✓ Can book early-bird') : '⛔ Score below 85 — cannot book early-bird'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {page==='tickets' && (
        <div style={{ padding:24, maxWidth:680, margin:'0 auto' }}>
          <h2 style={{ fontSize:24, fontWeight:900, marginBottom:20 }}>My Tickets</h2>
          {bookedList.length===0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#555', fontSize:16 }}>No tickets yet. Go book some concerts!</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {bookedList.map((entry,i)=>(
                <div key={i} style={{ background:entry.concert.color, border:'1px solid '+entry.concert.accent+'44', borderRadius:16, overflow:'hidden' }}>
                  <div style={{ background:entry.concert.accent+'22', padding:'10px 18px', display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Badge label="EARLY-BIRD" color={entry.concert.accent} />
                    <Badge label={'QUEUE #'+entry.queuePos} color={entry.concert.accent} />
                    <Badge label={'SCORE: '+entry.fanScore} color={entry.concert.accent} />
                  </div>
                  <div style={{ padding:18 }}>
                    <div style={{ fontSize:20, fontWeight:800 }}>{entry.concert.artist}</div>
                    <div style={{ color:'#aaa', fontSize:13 }}>{fmtDate(entry.concert.date)} · {entry.concert.venue}, {entry.concert.city}</div>
                    <div style={{ display:'flex', gap:20, marginTop:12 }}>
                      <div><div style={{ fontSize:18, fontWeight:900, color:entry.concert.accent }}>{entry.tickets}</div><div style={{ fontSize:10, color:'#888' }}>Tickets</div></div>
                      <div><div style={{ fontSize:18, fontWeight:900, color:entry.concert.accent }}>{INR(entry.total)}</div><div style={{ fontSize:10, color:'#888' }}>Total Paid</div></div>
                      <div><div style={{ fontSize:18, fontWeight:900, color:entry.concert.accent }}>{entry.newScore}</div><div style={{ fontSize:10, color:'#888' }}>New Score</div></div>
                    </div>
                    {entry.addFriends&&<div style={{ fontSize:11, color:'#a78bfa', marginTop:8 }}>+2 friends at early-bird price</div>}
                    {entry.extraTickets>0&&<div style={{ fontSize:11, color:'#f59e0b', marginTop:4 }}>Fan loyalty: +{entry.extraTickets} extra tickets</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bookingModal&&<BookingModal concert={bookingModal} topArtists={topArtists} recentTracks={recentTracks} onClose={()=>setBookingModal(null)} onSuccess={handleSuccess} loyaltyUsed={loyaltyUsed} setLoyaltyUsed={setLoyaltyUsed} />}
      {successModal&&<SuccessModal data={successModal} onClose={()=>setSuccessModal(null)} onViewTickets={()=>{setSuccessModal(null);setPage('tickets');}} />}
      {selectedArtist&&<ArtistProfileModal artist={selectedArtist} recentTracks={recentTracks} token={token} onClose={()=>setSelectedArtist(null)} />}
    </div>
  );
}