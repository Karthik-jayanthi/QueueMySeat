export const CONCERTS = [
  { id:1, artist:"Calvin Harris", date:"2026-04-17", time:"7:00 PM", venue:"NICE Grounds", city:"Bengaluru", genre:["dance","EDM","house"], basePrice:2499, earlyBirdPrice:1799, totalSlots:200, bookedSlots:186, initials:"CH", color:"#1a1a2e", accent:"#e94560" },
  { id:2, artist:"Calvin Harris", date:"2026-04-18", time:"7:00 PM", venue:"Mahalaxmi Race Course", city:"Mumbai", genre:["dance","EDM","house"], basePrice:2999, earlyBirdPrice:2199, totalSlots:300, bookedSlots:271, initials:"CH", color:"#16213e", accent:"#4f9cf9" },
  { id:3, artist:"Calvin Harris", date:"2026-04-19", time:"7:00 PM", venue:"HUDA Grounds", city:"Gurugram", genre:["dance","EDM","house"], basePrice:2499, earlyBirdPrice:1799, totalSlots:250, bookedSlots:209, initials:"CH", color:"#1a1a2e", accent:"#e94560" },
  { id:4, artist:"Scorpions", date:"2026-04-26", time:"6:30 PM", venue:"NICE Grounds", city:"Bengaluru", genre:["rock","hard rock","classic rock"], basePrice:1999, earlyBirdPrice:1399, totalSlots:180, bookedSlots:152, initials:"SC", color:"#1b1b2f", accent:"#e43f5a" },
  { id:5, artist:"Scorpions", date:"2026-04-30", time:"6:30 PM", venue:"Jio World Garden BKC", city:"Mumbai", genre:["rock","hard rock","classic rock"], basePrice:2499, earlyBirdPrice:1799, totalSlots:220, bookedSlots:190, initials:"SC", color:"#1b1b2f", accent:"#e43f5a" },
  { id:6, artist:"Tiesto", date:"2026-05-10", time:"8:00 PM", venue:"Dome SVP Stadium", city:"Mumbai", genre:["EDM","trance","progressive house","dance"], basePrice:1999, earlyBirdPrice:1299, totalSlots:350, bookedSlots:287, initials:"TI", color:"#0a0a23", accent:"#7b2ff7" },
  { id:7, artist:"Tiesto", date:"2026-05-12", time:"8:00 PM", venue:"Jawaharlal Nehru Stadium", city:"New Delhi", genre:["EDM","trance","progressive house","dance"], basePrice:1799, earlyBirdPrice:1199, totalSlots:400, bookedSlots:312, initials:"TI", color:"#0a0a23", accent:"#7b2ff7" },
  { id:8, artist:"Bruno Mars", date:"2026-05-21", time:"7:30 PM", venue:"HUDA Grounds", city:"Gurugram", genre:["pop","R&B","soul","funk"], basePrice:3499, earlyBirdPrice:2499, totalSlots:150, bookedSlots:148, initials:"BM", color:"#1a0a2e", accent:"#ff6b35" },
  { id:9, artist:"Bruno Mars", date:"2026-05-28", time:"7:30 PM", venue:"NICE Grounds", city:"Bengaluru", genre:["pop","R&B","soul","funk"], basePrice:3499, earlyBirdPrice:2499, totalSlots:150, bookedSlots:132, initials:"BM", color:"#1a0a2e", accent:"#ff6b35" },
  { id:10, artist:"Lollapalooza India", date:"2026-06-07", time:"12:00 PM", venue:"Mahalaxmi Race Course", city:"Mumbai", genre:["pop","rock","indie","electronic","alternative"], basePrice:3999, earlyBirdPrice:2799, totalSlots:500, bookedSlots:421, initials:"LL", color:"#0d1117", accent:"#58a6ff" },
  { id:11, artist:"Rolling Loud India", date:"2026-06-28", time:"3:00 PM", venue:"MMRDA Grounds BKC", city:"Mumbai", genre:["hip-hop","rap","trap"], basePrice:2999, earlyBirdPrice:2199, totalSlots:400, bookedSlots:308, initials:"RL", color:"#1a0a0a", accent:"#ff4444" },
  { id:12, artist:"Sid Sriram", date:"2026-07-12", time:"6:00 PM", venue:"NICE Grounds", city:"Bengaluru", genre:["indie","soul","Carnatic","alternative"], basePrice:999, earlyBirdPrice:699, totalSlots:200, bookedSlots:143, initials:"SS", color:"#0a1628", accent:"#ffd700" },
  { id:13, artist:"Sid Sriram", date:"2026-07-19", time:"6:00 PM", venue:"YMCA Grounds", city:"Chennai", genre:["indie","soul","Carnatic","alternative"], basePrice:999, earlyBirdPrice:699, totalSlots:180, bookedSlots:97, initials:"SS", color:"#0a1628", accent:"#ffd700" },
  { id:14, artist:"Arijit Singh", date:"2026-08-09", time:"7:00 PM", venue:"DY Patil Stadium", city:"Mumbai", genre:["Bollywood","pop","playback"], basePrice:1499, earlyBirdPrice:999, totalSlots:600, bookedSlots:489, initials:"AS", color:"#1a0a2e", accent:"#e91e63" },
  { id:15, artist:"Arijit Singh", date:"2026-08-15", time:"7:00 PM", venue:"Rajiv Gandhi International Stadium", city:"Hyderabad", genre:["Bollywood","pop","playback"], basePrice:1299, earlyBirdPrice:899, totalSlots:500, bookedSlots:374, initials:"AS", color:"#1a0a2e", accent:"#e91e63" },
];

export const INR = (n) => '\u20b9' + Number(n).toLocaleString('en-IN');
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
export const remaining = (c) => c.totalSlots - c.bookedSlots;
export const fillPct = (c) => Math.round((c.bookedSlots / c.totalSlots) * 100);

export function calcFanScore(concert, topArtists) {
  if (!topArtists || topArtists.length === 0) return 0;
  const exact = topArtists.find(a => a.name.toLowerCase() === concert.artist.toLowerCase());
  if (exact) return Math.min(100, Math.round(exact.popularity * 1.1));
  const genre = topArtists.find(a =>
    a.genres && concert.genre.some(g =>
      a.genres.some(ag => ag.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(ag.toLowerCase()))
    )
  );
  if (genre) return Math.round(genre.popularity * 0.75);
  return 0;
}

export function calcQueuePosition(concert, fanScore) {
  const base = Math.floor(Math.random() * 18) + 6;
  const bonus = Math.floor(fanScore / 10);
  return Math.max(1, base - bonus);
}
