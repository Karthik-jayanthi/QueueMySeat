/**
 * FAN SCORE ALGORITHM v2 — scored out of 100
 *
 * 1. ARTIST MATCH        — 50 pts max
 *    Exact match #1 in top artists = 50 pts
 *    Exact match #2 = 45, #3 = 40, #4 = 35, #5 = 30
 *    Genre match only = 20 pts
 *
 * 2. POPULARITY WEIGHT   — 20 pts max
 *    Spotify popularity (0-100) scaled to 20 pts
 *    Only counts when exact artist match found
 *
 * 3. LISTENING RECENCY   — 20 pts max
 *    Artist in last 5 recently played = 20 pts
 *    Artist in last 6-10 recently played = 12 pts
 *    Not in recent history = 0 pts
 *
 * 4. GENRE DEPTH         — 10 pts max
 *    Each top artist sharing this genre = 2 pts (max 5)
 *
 * THRESHOLDS:
 *   85-100 = Elite Fan    → book + loyalty bonus (+2 extra tickets)
 *   70-84  = Verified Fan → book + priority queue
 *   40-69  = Growing Fan  → book + normal queue
 *   0-39   = Casual       → BLOCKED from early-bird
 */

export function calcFanScoreDetailed(concert, topArtists, recentTracks) {
  if (!topArtists || topArtists.length === 0) {
    return { total: 0, breakdown: null, tier: 'no_data' };
  }

  const breakdown = {
    artistMatch: 0, artistMatchReason: '', matchedArtist: null,
    popularityWeight: 0,
    listeningRecency: 0, recencyReason: '',
    genreDepth: 0, genreDepthReason: '',
  };

  // 1. ARTIST MATCH
  const artistIndex = topArtists.findIndex(
    a => a.name.toLowerCase() === concert.artist.toLowerCase()
  );

  if (artistIndex !== -1) {
    const matched = topArtists[artistIndex];
    breakdown.artistMatch = Math.max(30, 50 - artistIndex * 5);
    breakdown.artistMatchReason = 'Ranked #' + (artistIndex + 1) + ' in your top artists';
    breakdown.matchedArtist = matched;
    // 2. POPULARITY WEIGHT (only on exact match)
    breakdown.popularityWeight = Math.round((matched.popularity / 100) * 20);
  } else {
    const genreMatch = topArtists.find(a =>
      a.genres && concert.genre.some(g =>
        a.genres.some(ag =>
          ag.toLowerCase().includes(g.toLowerCase()) ||
          g.toLowerCase().includes(ag.toLowerCase())
        )
      )
    );
    if (genreMatch) {
      breakdown.artistMatch = 20;
      breakdown.artistMatchReason = 'Genre overlap via ' + genreMatch.name;
      breakdown.popularityWeight = Math.round((genreMatch.popularity / 100) * 10);
    } else {
      breakdown.artistMatchReason = 'No artist or genre match';
    }
  }

  // 3. LISTENING RECENCY
  if (recentTracks && recentTracks.length > 0) {
    const concertArtistLower = concert.artist.toLowerCase();
    const idx = recentTracks.findIndex(item =>
      item.track?.artists?.some(a => a.name.toLowerCase() === concertArtistLower)
    );
    if (idx !== -1 && idx < 5) {
      breakdown.listeningRecency = 20;
      breakdown.recencyReason = 'Played very recently (track #' + (idx + 1) + ')';
    } else if (idx !== -1) {
      breakdown.listeningRecency = 12;
      breakdown.recencyReason = 'Played in last 10 tracks';
    } else {
      breakdown.recencyReason = 'Not in recent history';
    }
  } else {
    breakdown.recencyReason = 'No recent tracks available';
  }

  // 4. GENRE DEPTH
  const genreMatchCount = topArtists.filter(a =>
    a.genres && concert.genre.some(g =>
      a.genres.some(ag =>
        ag.toLowerCase().includes(g.toLowerCase()) ||
        g.toLowerCase().includes(ag.toLowerCase())
      )
    )
  ).length;
  breakdown.genreDepth = Math.min(10, genreMatchCount * 2);
  breakdown.genreDepthReason = genreMatchCount + '/5 of your top artists match this genre';

  const total = Math.min(100,
    breakdown.artistMatch +
    breakdown.popularityWeight +
    breakdown.listeningRecency +
    breakdown.genreDepth
  );

  const tier =
    total >= 85 ? 'elite' :
    total >= 70 ? 'verified' :
    total >= 40 ? 'growing' : 'casual';

  return { total, breakdown, tier };
}

export function calcFanScore(concert, topArtists, recentTracks) {
  return calcFanScoreDetailed(concert, topArtists, recentTracks || []).total;
}

export function calcQueuePosition(concert, fanScore) {
  const base = Math.floor(Math.random() * 18) + 6;
  return Math.max(1, base - Math.floor(fanScore / 10));
}

export const TIER_INFO = {
  elite:    { label: 'Elite Fan',    color: '#f59e0b', canBook: true,  loyaltyBonus: true  },
  verified: { label: 'Verified Fan', color: '#10b981', canBook: true,  loyaltyBonus: false },
  growing:  { label: 'Growing Fan',  color: '#7b2ff7', canBook: true,  loyaltyBonus: false },
  casual:   { label: 'Casual',       color: '#ef4444', canBook: false, loyaltyBonus: false },
  no_data:  { label: 'Not Verified', color: '#6b7280', canBook: false, loyaltyBonus: false },
};
