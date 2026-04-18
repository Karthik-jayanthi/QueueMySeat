import { useState, useEffect } from 'react';
import {
  initiateSpotifyLogin, exchangeCodeForToken, getValidToken, logout,
  fetchSpotifyProfile, fetchTopArtists, fetchRecentlyPlayed,
} from './spotify.js';
import { CONCERTS, INR, fmtDate, remaining, fillPct, calcFanScore, calcQueuePosition } from './concerts.js';

const Avatar = ({ src, initials, color, size }) => {
  const [err, setErr] = useState(false);
  const sz = size || 44;
  const s = { width: sz, height: sz, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.round(sz * 0.33), color: '#fff', background: color || '#7b2ff7', letterSpacing: 1, overflow: 'hidden' };
  if (src && !err) return <img src={src} alt={initials} style={{ ...s, objectFit: 'cover' }} onError={() => setErr(true)} />;
  return <div style={s}>{initials}</div>;
};

const Badge = ({ label, color }) => (
  <span style={{ background: (color||'#7b2ff7')+'22', color: color||'#7b2ff7', border:'1px solid '+(color||'#7b2ff7')+'44', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{label}</span>
);

const ProgBar = ({ pct, color }) => (
  <div style={{ background:'#ffffff18', borderRadius:4, height:5, overflow:'hidden' }}>
    <div style={{ width:pct+'%', background:color||'#7b2ff7', height:'100%', borderRadius:4 }} />
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

function ConcertCard({ concert, onBook, fanScore, loggedIn }) {
  const rem = remaining(concert);
  const pct = fillPct(concert);
  const isVerified = fanScore >= 70;
  const isSoldOut = rem <= 0;
  const isAlmost = rem > 0 && rem <= 20;
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background:'linear-gradient(140deg,'+concert.color+' 0%,#111 100%)', border:'1px solid '+(hovered?concert.accent+'55':'#ffffff12'), borderRadius:16, overflow:'hidden', transition:'all 0.22s', transform:hovered?'translateY(-4px)':'none', boxShadow:hovered?'0 18px 40px '+concert.accent+'28':'none' }}>
      <div style={{ background:concert.accent+'1a', borderBottom:'1px solid '+concert.accent+'22', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:5 }}>
          {concert.genre.slice(0,2).map(g => <span key={g} style={{ background:concert.accent+'22', color:concert.accent, border:'1px solid '+concert.accent+'33', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5 }}>{g}</span>)}
        </div>
        {loggedIn && isVerified && <Badge label="VERIFIED FAN" color={concert.accent} />}
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
        <div style={{ margin:'12px 0 6px' }}>
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
          <button onClick={() => onBook(concert)} disabled={isSoldOut}
            style={{ background:isSoldOut?'#2a2a2a':concert.accent, color:isSoldOut?'#555':'#fff', border:'none', borderRadius:10, padding:'10px 16px', fontWeight:700, fontSize:13, cursor:isSoldOut?'not-allowed':'pointer' }}>
            {isSoldOut?'Sold Out':'🎟 Book Early-Bird'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({ concert, topArtists, onClose, onSuccess, loyaltyUsed, setLoyaltyUsed }) {
  const [step, setStep] = useState(1);
  const [addFriends, setAddFriends] = useState(false);
  const [extraTickets, setExtraTickets] = useState(0);
  const [processing, setProcessing] = useState(false);
  const fanScore = calcFanScore(concert, topArtists);
  const isVerifiedFan = fanScore >= 70;
  const canLoyalty = fanScore >= 85 && !loyaltyUsed[concert.artist];
  const queuePos = calcQueuePosition(concert, fanScore);
  const rem = remaining(concert);
  const tickets = 1 + (addFriends?2:0) + extraTickets;
  const total = tickets * concert.earlyBirdPrice;
  const savings = tickets * (concert.basePrice - concert.earlyBirdPrice);
  const confirm = () => {
    setProcessing(true);
    setTimeout(() => {
      if (extraTickets > 0) setLoyaltyUsed(prev => ({ ...prev, [concert.artist]: true }));
      onSuccess({ concert, queuePos, tickets, total, addFriends, extraTickets });
    }, 1800);
  };
  const OL = { position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 };
  const BOX = { background:'#141414', border:'1px solid #2a2a2a', borderRadius:20, padding:26, maxWidth:460, width:'100%', maxHeight:'92vh', overflowY:'auto' };
  const PB = { background:'#7b2ff7', color:'#fff', border:'none', borderRadius:10, padding:'13px 24px', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', marginTop:8 };
  const SB = { background:'transparent', color:'#aaa', border:'1px solid #2a2a2a', borderRadius:10, padding:'11px 20px', fontWeight:500, fontSize:14, cursor:'pointer', width:'100%', marginTop:8 };
  const IR = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1e1e1e', fontSize:13 };
  return (
    <div style={OL} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={BOX}>
        {processing && (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <Spinner />
            <div style={{ marginTop:8, fontSize:16, fontWeight:600 }}>Securing your seats...</div>
            <div style={{ color:'#888', fontSize:13, marginTop:6 }}>Locking your early-bird position</div>
          </div>
        )}
        {!processing && step===1 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <div style={{ fontSize:11, color:'#7b2ff7', fontWeight:700, letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>Early-Bird Booking</div>
                <h2 style={{ fontSize:21, fontWeight:900, margin:0 }}>{concert.artist}</h2>
              </div>
              <button onClick={onClose} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ background:concert.color, border:'1px solid '+concert.accent+'33', borderRadius:12, padding:16, marginBottom:18 }}>
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <Avatar initials={concert.initials} color={concert.accent} size={48} />
                <div>
                  <div style={{ fontWeight:800, fontSize:17 }}>{concert.artist}</div>
                  <div style={{ fontSize:13, color:'#bbb' }}>{fmtDate(concert.date)} · {concert.time}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{concert.venue}, {concert.city}</div>
                </div>
              </div>
            </div>
            <div style={{ background:'#7b2ff711', border:'1px solid #7b2ff733', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:12, color:'#a78bfa', fontWeight:700, marginBottom:6 }}>🎫 Early-Bird Pass Includes</div>
              <div style={{ fontSize:13, color:'#ccc', marginBottom:10 }}>Your pass lets you queue <strong style={{ color:'#fff' }}>1 + 2 friends</strong> at the same early-bird price.</div>
              <div style={{ display:'flex', gap:20 }}>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:900, color:'#a78bfa' }}>#{queuePos}</div><div style={{ fontSize:10, color:'#888' }}>Your position</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:900, color:'#a78bfa' }}>{rem}</div><div style={{ fontSize:10, color:'#888' }}>Seats left</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:900, color:'#a78bfa' }}>{fanScore}/100</div><div style={{ fontSize:10, color:'#888' }}>Fan score</div></div>
              </div>
              {isVerifiedFan && <div style={{ marginTop:8, fontSize:11, color:'#10b981', fontWeight:600 }}>✓ Verified Fan — priority queue position granted</div>}
            </div>
            <div style={{ background:'#1a1a1a', borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                <span style={{ fontSize:12, color:'#888' }}>Fan loyalty score</span>
                <span style={{ fontSize:13, fontWeight:700, color:fanScore>=70?'#10b981':'#f59e0b' }}>{fanScore}/100</span>
              </div>
              <ProgBar pct={fanScore} color={fanScore>=70?'#10b981':fanScore>=40?'#f59e0b':'#555'} />
              <div style={{ fontSize:11, color:'#666', marginTop:6 }}>
                {fanScore>=85?'Elite fan — loyalty bonus unlocked!':fanScore>=70?'Verified fan ✓':fanScore>=40?'Growing fan — keep listening!':'Listen more to unlock verified status'}
              </div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:12, border:'1px solid '+(addFriends?'#7b2ff755':'#222'), background:addFriends?'#7b2ff70a':'transparent', borderRadius:10, padding:14, marginBottom:12, cursor:'pointer' }}>
              <input type="checkbox" checked={addFriends} onChange={e => setAddFriends(e.target.checked)} style={{ width:17, height:17, accentColor:'#7b2ff7', cursor:'pointer' }} />
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>Queue +2 Friends 👯</div>
                <div style={{ fontSize:11, color:'#888' }}>Reserve 2 extra seats at the same price ({INR(concert.earlyBirdPrice)} each)</div>
              </div>
            </label>
            {canLoyalty && (
              <div style={{ border:'1px solid #f59e0b44', borderRadius:10, padding:14, marginBottom:12, background:'#f59e0b06' }}>
                <div style={{ fontSize:12, color:'#f59e0b', fontWeight:700, marginBottom:6 }}>⭐ Fan Loyalty Bonus Unlocked!</div>
                <div style={{ fontSize:11, color:'#ccc', marginBottom:10 }}>Score {fanScore}/100 qualifies you for up to 2 extra tickets. Each reduces your score by 6 pts.</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#888' }}>Extra tickets:</span>
                  {[0,1,2].map(n => (
                    <button key={n} onClick={() => setExtraTickets(n)}
                      style={{ background:extraTickets===n?'#f59e0b':'#1e1e1e', color:extraTickets===n?'#000':'#ccc', border:'1px solid #333', borderRadius:7, padding:'6px 12px', cursor:'pointer', fontWeight:700, fontSize:14 }}>{n}</button>
                  ))}
                </div>
                {extraTickets>0 && <div style={{ fontSize:10, color:'#f59e0b', marginTop:6 }}>⚠ Score will decrease by {extraTickets*6} pts after purchase.</div>}
              </div>
            )}
            {loyaltyUsed[concert.artist] && <div style={{ fontSize:11, color:'#666', padding:'7px 11px', background:'#1a1a1a', borderRadius:8, marginBottom:12 }}>Loyalty bonus already used for {concert.artist}.</div>}
            <div style={{ borderTop:'1px solid #1e1e1e', paddingTop:14, marginBottom:6 }}>
              <div style={IR}><span style={{ color:'#888' }}>Tickets</span><span>{tickets} × {INR(concert.earlyBirdPrice)}</span></div>
              {savings>0 && <div style={IR}><span style={{ color:'#10b981' }}>You save</span><span style={{ color:'#10b981' }}>{INR(savings)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:15 }}>Total</span>
                <span style={{ fontWeight:900, fontSize:22, color:'#7b2ff7' }}>{INR(total)}</span>
              </div>
            </div>
            <button style={PB} onClick={() => setStep(2)}>Continue to Payment →</button>
            <button style={SB} onClick={onClose}>Cancel</button>
          </>
        )}
        {!processing && step===2 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:900, margin:0 }}>Confirm & Pay</h2>
              <button onClick={() => setStep(1)} style={{ background:'#1e1e1e', border:'none', color:'#888', borderRadius:8, padding:'5px 11px', cursor:'pointer', fontSize:12 }}>← Back</button>
            </div>
            <div style={{ background:'#1a1a1a', borderRadius:12, padding:16, marginBottom:18 }}>
              {[['Artist',concert.artist],['Date',fmtDate(concert.date)],['Time',concert.time],['Venue',concert.venue+', '+concert.city],['Tickets',tickets+(addFriends?' (you + 2 friends)':'')+(extraTickets>0?' + '+extraTickets+' loyalty':'')],['Queue Position','#'+queuePos]].map(([k,v]) => (
                <div key={k} style={IR}><span style={{ color:'#888' }}>{k}</span><span style={{ fontWeight:500, color:k==='Queue Position'?'#a78bfa':'#f0f0f0' }}>{v}</span></div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0 0', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:15 }}>Total</span>
                <span style={{ fontWeight:900, fontSize:22, color:'#7b2ff7' }}>{INR(total)}</span>
              </div>
            </div>
            <div style={{ background:'#10b98111', border:'1px solid #10b98122', borderRadius:10, padding:12, marginBottom:18 }}>
              <div style={{ fontSize:12, color:'#10b981' }}>🔒 Secure checkout · Early-bird price locked · Instant e-ticket</div>
            </div>
            {extraTickets>0 && (
              <div style={{ background:'#f59e0b0d', border:'1px solid #f59e0b33', borderRadius:10, padding:12, marginBottom:12 }}>
                <div style={{ fontSize:12, color:'#f59e0b' }}>⚠ Loyalty bonus: {extraTickets} extra ticket{extraTickets>1?'s':''} · Score decreases by {extraTickets*6} pts.</div>
              </div>
            )}
            <button style={PB} onClick={confirm}>🎉 Confirm Booking — {INR(total)}</button>
            <button style={SB} onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessModal({ data, onClose, onViewTickets }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#141414', border:'1px solid #2a2a2a', borderRadius:20, padding:26, maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:64, marginBottom:12 }}>🎉</div>
        <h2 style={{ fontSize:24, fontWeight:900, marginBottom:6 }}>You're in the Queue!</h2>
        <p style={{ color:'#888', fontSize:14, marginBottom:20 }}>Your early-bird tickets are confirmed.</p>
        <div style={{ background:'#7b2ff711', border:'1px solid #7b2ff733', borderRadius:14, padding:20, marginBottom:20 }}>
          <div style={{ fontSize:48, fontWeight:900, color:'#a78bfa', lineHeight:1 }}>#{data.queuePos}</div>
          <div style={{ color:'#888', fontSize:12, marginTop:4 }}>Your queue position</div>
          <div style={{ fontWeight:700, fontSize:16, marginTop:4 }}>{data.concert.artist}</div>
          <div style={{ fontSize:12, color:'#888' }}>{fmtDate(data.concert.date)} · {data.concert.city}</div>
        </div>
        <div style={{ display:'flex', gap:20, justifyContent:'center', marginBottom:20 }}>
          <div><div style={{ fontSize:24, fontWeight:900, color:'#7b2ff7' }}>{data.tickets}</div><div style={{ fontSize:11, color:'#888' }}>Tickets</div></div>
          <div><div style={{ fontSize:24, fontWeight:900, color:'#7b2ff7' }}>{INR(data.total)}</div><div style={{ fontSize:11, color:'#888' }}>Total</div></div>
        </div>
        {data.extraTickets>0 && <div style={{ fontSize:11, color:'#f59e0b', padding:'7px 12px', background:'#f59e0b0d', borderRadius:8, marginBottom:14 }}>Fan loyalty used. Score decreased by {data.extraTickets*6} pts.</div>}
        <button onClick={onViewTickets} style={{ background:'#7b2ff7', color:'#fff', border:'none', borderRadius:10, padding:'13px 24px', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', marginBottom:8 }}>View My Tickets</button>
        <button onClick={onClose} style={{ background:'transparent', color:'#aaa', border:'1px solid #2a2a2a', borderRadius:10, padding:'11px 20px', fontWeight:500, fontSize:14, cursor:'pointer', width:'100%' }}>Continue Browsing</button>
      </div>
    </div>
  );
}

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

  const loadSpotifyData = async (accessToken) => {
    setDataLoading(true);
    try {
      const [profileData, artistsData, recentData] = await Promise.all([
        fetchSpotifyProfile(accessToken),
        fetchTopArtists(accessToken),
        fetchRecentlyPlayed(accessToken),
      ]);
      setProfile(profileData);
      setTopArtists(artistsData.items || []);
      setRecentTracks(recentData.items || []);
    } catch (err) {
      console.error('Spotify data load failed:', err);
    }
    setDataLoading(false);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (error) { window.history.replaceState({}, '', '/'); setLoading(false); return; }
    if (code) {
      window.history.replaceState({}, '', '/');
      exchangeCodeForToken(code).then(t => { setToken(t); loadSpotifyData(t); }).catch(() => setLoading(false));
      return;
    }
    getValidToken().then(t => {
      if (t) { setToken(t); loadSpotifyData(t); } else setLoading(false);
    });
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

  const avgFanScore = topArtists.length ? Math.round(topArtists.reduce((s,a) => s+(a.popularity||0),0)/topArtists.length) : 0;
  const NB = (active) => ({ background:active?'#7b2ff722':'transparent', color:active?'#a78bfa':'#aaa', border:active?'1px solid #7b2ff744':'1px solid transparent', borderRadius:8, padding:'5px 13px', cursor:'pointer', fontSize:13, fontWeight:500 });

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d', color:'#f0f0f0' }}>
      <nav style={{ position:'sticky', top:0, zIndex:200, height:58, background:'rgba(13,13,13,0.95)', backdropFilter:'blur(14px)', borderBottom:'1px solid #ffffff15', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <span style={{ fontSize:20, fontWeight:900, cursor:'pointer', color:'#fff', letterSpacing:-0.5 }} onClick={() => setPage('home')}>
          Queue<span style={{ color:'#7b2ff7' }}>My</span>Seat
        </span>
        <div style={{ display:'flex', gap:4 }}>
          <button style={NB(page==='home')} onClick={() => setPage('home')}>Concerts</button>
          {token && <button style={NB(page==='dashboard')} onClick={() => setPage('dashboard')}>My Spotify</button>}
          {token && <button style={NB(page==='profile')} onClick={() => setPage('profile')}>Fan Profile</button>}
          {token && bookedList.length>0 && <button style={NB(page==='tickets')} onClick={() => setPage('tickets')}>My Tickets ({bookedList.length})</button>}
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
            <p style={{ fontSize:16, color:'#aaa', maxWidth:520, margin:'0 auto 28px', lineHeight:1.65 }}>Connect your Spotify, prove your fandom, and skip the bots. Early-bird seats for verified music lovers across India.</p>
            {!token && (
              <button onClick={initiateSpotifyLogin} style={{ background:'#1DB954', color:'#fff', border:'none', borderRadius:24, padding:'13px 30px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:8, margin:'0 auto' }}>
                <SpotifyIcon size={20} /> Get Started — Connect Spotify
              </button>
            )}
            <div style={{ display:'flex', gap:36, justifyContent:'center', marginTop:36 }}>
              {[['15+','Upcoming Shows'],['8','Cities'],['Fan-Verified','Queue System']].map(([n,l]) => (
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#7b2ff7' }}>{n}</div>
                  <div style={{ fontSize:11, color:'#777', marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, padding:'12px 20px', flexWrap:'wrap', borderBottom:'1px solid #ffffff0d', background:'#0f0f0f', alignItems:'center' }}>
            <input style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, outline:'none', width:190 }} placeholder="Search artist or city..." value={search} onChange={e => setSearch(e.target.value)} />
            <select style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, cursor:'pointer', outline:'none' }} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
              {cities.map(c => <option key={c}>{c}</option>)}
            </select>
            <select style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:8, padding:'7px 12px', color:'#f0f0f0', fontSize:13, cursor:'pointer', outline:'none' }} value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
              {genres.map(g => <option key={g}>{g}</option>)}
            </select>
            <span style={{ fontSize:12, color:'#555', marginLeft:'auto' }}>{filtered.length} shows</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:18, padding:22 }}>
            {filtered.map(concert => <ConcertCard key={concert.id} concert={concert} onBook={handleBook} fanScore={calcFanScore(concert,topArtists)} loggedIn={!!token} />)}
          </div>
        </>
      )}

      {page==='dashboard' && token && (
        <div style={{ padding:24, maxWidth:880, margin:'0 auto' }}>
          <h2 style={{ fontSize:26, fontWeight:900, marginBottom:4 }}>Your Spotify Data</h2>
          <p style={{ color:'#888', marginBottom:24, fontSize:14 }}>This is what QueueMySeat reads to verify your fandom.</p>
          {dataLoading ? <Spinner /> : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
                {[['Top Artists',topArtists.length],['Recent Tracks',recentTracks.length],['Super Fans',topArtists.filter(a=>a.popularity>=70).length],['Avg Score',avgFanScore]].map(([l,v]) => (
                  <div key={l} style={{ background:'#1a1a1a', borderRadius:11, padding:'14px 16px' }}>
                    <div style={{ fontSize:11, color:'#777', marginBottom:6 }}>{l}</div>
                    <div style={{ fontSize:26, fontWeight:900, color:'#7b2ff7' }}>{v}</div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize:17, fontWeight:700, marginBottom:12 }}>Your Top 5 Artists</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
                {topArtists.slice(0,5).map((artist,i) => (
                  <div key={artist.id} style={{ background:'#141414', border:'1px solid #1e1e1e', borderRadius:12, padding:13, display:'flex', alignItems:'center', gap:13 }}>
                    <div style={{ color:'#444', fontWeight:800, width:20, fontSize:13 }}>#{i+1}</div>
                    <Avatar src={artist.images?.[2]?.url||artist.images?.[0]?.url} initials={artist.name[0]} color="#7b2ff7" size={46} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{artist.name}</div>
                      <div style={{ fontSize:11, color:'#888' }}>{artist.genres?.slice(0,3).join(', ')} · {(artist.followers?.total||0).toLocaleString()} followers</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#a78bfa', fontWeight:700, fontSize:13 }}>{artist.popularity}/100</div>
                      {artist.popularity>=70 && <Badge label="SUPER FAN" color="#10b981" />}
                    </div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize:17, fontWeight:700, marginBottom:12 }}>Recently Played</h3>
              <div style={{ background:'#141414', border:'1px solid #1e1e1e', borderRadius:12, overflow:'hidden' }}>
                {recentTracks.slice(0,8).map((item,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'11px 16px', borderBottom:i<7?'1px solid #1a1a1a':'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar src={item.track?.album?.images?.[2]?.url} initials={(item.track?.name||'?')[0]} color="#333" size={34} />
                      <div>
                        <div style={{ fontWeight:500, fontSize:14 }}>{item.track?.name}</div>
                        <div style={{ fontSize:11, color:'#888' }}>{item.track?.artists?.map(a=>a.name).join(', ')}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'#444', alignSelf:'center' }}>
                      {item.played_at?new Date(item.played_at).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}):''}
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
                <Badge label="VERIFIED FAN" color="#10b981" />
                <Badge label={'FAN SCORE: '+avgFanScore+'/100'} color="#7b2ff7" />
                {profile?.product==='premium' && <Badge label="SPOTIFY PREMIUM" color="#1DB954" />}
              </div>
            </div>
          </div>
          <div style={{ background:'#141414', borderRadius:13, padding:18, marginBottom:20 }}>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>Fan Loyalty Score</h3>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:13, color:'#888' }}>Overall score</span>
              <span style={{ fontWeight:700, color:'#a78bfa' }}>{avgFanScore}/100</span>
            </div>
            <ProgBar pct={avgFanScore} color="#7b2ff7" />
            <div style={{ fontSize:11, color:'#777', marginTop:8 }}>Score 85+ unlocks up to 2 extra tickets. Using this reduces your score.</div>
          </div>
          <h3 style={{ fontSize:17, fontWeight:700, marginBottom:12 }}>Shows Matching Your Taste</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {CONCERTS.filter(c=>calcFanScore(c,topArtists)>0).slice(0,6).map(c => {
              const sc = calcFanScore(c,topArtists);
              return (
                <div key={c.id} style={{ background:'#141414', border:'1px solid '+c.accent+'22', borderRadius:12, padding:13, display:'flex', alignItems:'center', gap:13 }}>
                  <Avatar initials={c.initials} color={c.accent} size={44} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700 }}>{c.artist}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{fmtDate(c.date)} · {c.city}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {sc>=70 && <Badge label="FAN MATCH" color={c.accent} />}
                    <div style={{ color:c.accent, fontWeight:700, fontSize:13, marginTop:4 }}>{INR(c.earlyBirdPrice)}</div>
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
              {bookedList.map((entry,i) => (
                <div key={i} style={{ background:entry.concert.color, border:'1px solid '+entry.concert.accent+'44', borderRadius:16, overflow:'hidden' }}>
                  <div style={{ background:entry.concert.accent+'22', padding:'10px 18px', display:'flex', gap:8 }}>
                    <Badge label="EARLY-BIRD" color={entry.concert.accent} />
                    <Badge label={'QUEUE #'+entry.queuePos} color={entry.concert.accent} />
                  </div>
                  <div style={{ padding:18 }}>
                    <div style={{ fontSize:20, fontWeight:800 }}>{entry.concert.artist}</div>
                    <div style={{ color:'#aaa', fontSize:13 }}>{fmtDate(entry.concert.date)} · {entry.concert.venue}, {entry.concert.city}</div>
                    <div style={{ display:'flex', gap:20, marginTop:12 }}>
                      <div><div style={{ fontSize:18, fontWeight:900, color:entry.concert.accent }}>{entry.tickets}</div><div style={{ fontSize:10, color:'#888' }}>Tickets</div></div>
                      <div><div style={{ fontSize:18, fontWeight:900, color:entry.concert.accent }}>{INR(entry.total)}</div><div style={{ fontSize:10, color:'#888' }}>Total Paid</div></div>
                    </div>
                    {entry.addFriends && <div style={{ fontSize:11, color:'#a78bfa', marginTop:8 }}>+2 friends at early-bird price</div>}
                    {entry.extraTickets>0 && <div style={{ fontSize:11, color:'#f59e0b', marginTop:4 }}>Fan loyalty bonus: +{entry.extraTickets} extra ticket{entry.extraTickets>1?'s':''}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {bookingModal && <BookingModal concert={bookingModal} topArtists={topArtists} onClose={() => setBookingModal(null)} onSuccess={handleSuccess} loyaltyUsed={loyaltyUsed} setLoyaltyUsed={setLoyaltyUsed} />}
      {successModal && <SuccessModal data={successModal} onClose={() => setSuccessModal(null)} onViewTickets={() => { setSuccessModal(null); setPage('tickets'); }} />}
    </div>
  );
}
