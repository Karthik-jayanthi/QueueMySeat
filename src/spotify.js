export const SPOTIFY_CLIENT_ID = '685d095b3eb04829a06d4b8dfdd15dbc';
export const REDIRECT_URI = window.location.origin + '/callback';
export const SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-read-private',
  'user-read-email',
].join(' ');

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function initiateSpotifyLogin() {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true',
  });
  window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

export async function exchangeCodeForToken(code) {
  const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
  if (!codeVerifier) throw new Error('No code verifier found');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error_description || 'Token exchange failed');
  }
  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem('spotify_access_token', data.access_token);
  localStorage.setItem('spotify_refresh_token', data.refresh_token || '');
  localStorage.setItem('spotify_expires_at', String(expiresAt));
  sessionStorage.removeItem('spotify_code_verifier');
  return data.access_token;
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) return null;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem('spotify_access_token', data.access_token);
  localStorage.setItem('spotify_expires_at', String(expiresAt));
  if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
  return data.access_token;
}

export async function getValidToken() {
  const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0);
  const accessToken = localStorage.getItem('spotify_access_token');
  if (!accessToken) return null;
  if (Date.now() > expiresAt - 60000) return await refreshAccessToken();
  return accessToken;
}

export function logout() {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_expires_at');
}

async function spotifyFetch(endpoint, token) {
  const res = await fetch('https://api.spotify.com/v1' + endpoint, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Spotify API error: ' + res.status);
  return res.json();
}

export async function fetchSpotifyProfile(token) {
  return spotifyFetch('/me', token);
}

export async function fetchTopArtists(token) {
  return spotifyFetch('/me/top/artists?limit=50&time_range=medium_term', token);
}

export async function fetchRecentlyPlayed(token) {
  return spotifyFetch('/me/player/recently-played?limit=50', token);
}

export async function fetchArtistTopTracks(artistId, token) {
  return spotifyFetch('/artists/' + artistId + '/top-tracks?market=IN', token);
}
