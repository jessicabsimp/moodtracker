const SPOTIFY_CLIENT_ID = 'd3c342d0538c4fb9b1ecf547654dc0e5'; // Replace with your Spotify Client ID
const REDIRECT_URI = 'https://jessicabsimp.github.io/moodtracker/';
const SCOPES = 'user-read-recently-played';

// Generate a random code verifier for PKCE Security
function generateCodeVerifier(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// SHA-256 Digest Helper
async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 1. Trigger Spotify Login
async function redirectToSpotifyAuth() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem('spotify_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// 2. Exchange OAuth Code for Access Token
async function handleSpotifyCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) return;

  const verifier = localStorage.getItem('spotify_code_verifier');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier
    })
  });

  const data = await response.json();
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token);
    // Clean URL query params
    window.history.replaceState({}, document.title, window.location.pathname);
    renderSpotifyWidget();
  }
}

// 3. Fetch Recently Played Tracks
async function fetchRecentlyPlayed() {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) return null;

  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    // Token expired
    localStorage.removeItem('spotify_access_token');
    return null;
  }

  const data = await response.json();
  return data.items;
}

// 4. Render UI inside Music Card
async function renderSpotifyWidget() {
  const container = document.getElementById('spotify-container');
  if (!container) return;

  const tracks = await fetchRecentlyPlayed();

  if (!tracks) {
    container.innerHTML = `
      <div style="text-align: center; padding: 12px 0;">
        <strong style="font-size: 0.85rem; color: var(--primary-text); display: block;">Connect Spotify</strong>
        <span style="font-size: 0.75rem; color: var(--secondary-text);">Discover audio & mood correlations</span>
      </div>
      <button id="connectSpotifyBtn" class="pill-btn" style="background-color: #1DB954; width: 100%; margin-top: 4px; font-size: 0.8rem;">
        Connect Account
      </button>
    `;
    document.getElementById('connectSpotifyBtn')?.addEventListener('click', redirectToSpotifyAuth);
    return;
  }

  // Render last played track
  const recent = tracks[0].track;
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; text-align: left; width: 100%;">
      <img src="${recent.album.images[2]?.url || recent.album.images[0]?.url}" alt="Album Art" style="width: 44px; height: 44px; border-radius: 8px;">
      <div style="overflow: hidden;">
        <strong style="font-size: 0.85rem; color: var(--primary-text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${recent.name}</strong>
        <span style="font-size: 0.75rem; color: var(--secondary-text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${recent.artists.map(a => a.name).join(', ')}</span>
      </div>
    </div>
  `;
}

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  handleSpotifyCallback();
  renderSpotifyWidget();
});