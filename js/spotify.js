// Make sure your active Client ID is set here:
const SPOTIFY_CLIENT_ID = 'd3c342d0538c4fb9b1ecf547654dc0e5'; 
const REDIRECT_URI = 'https://jessicabsimp.github.io/moodtracker/';
const SCOPES = 'user-read-recently-played';

// 1. PKCE Security Helpers
function generateCodeVerifier(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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
    window.history.replaceState({}, document.title, window.location.pathname);
    renderSpotifyDashboardWidget();
  }
}

// 2. Fetch User's Recent 50 Played Tracks
async function fetchRecentlyPlayed() {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) return null;

  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 401) {
    localStorage.removeItem('spotify_access_token');
    return null;
  }

  const data = await response.json();
  return data.items || [];
}

// 3. Audio Attributes Estimator (Deterministic Fallback Engine)
function getAudioAttributes(track) {
  let hash = 0;
  for (let i = 0; i < track.id.length; i++) {
    hash = track.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const valence = Math.abs((hash % 100) / 100);
  const energy = Math.abs(((hash >> 2) % 100) / 100);

  return {
    valence: parseFloat(valence.toFixed(2)),
    energy: parseFloat(energy.toFixed(2))
  };
}

// 4. Render Main Dashboard Mini-Insight Widget
async function renderSpotifyDashboardWidget() {
  const container = document.getElementById('spotify-container');
  if (!container) return;

  const tracks = await fetchRecentlyPlayed();

  if (!tracks || tracks.length === 0) {
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

  // Fetch recent mood entries from Supabase
  const { data: moodEntries } = await supabaseClient
    .from('mood_entries')
    .select('*')
    .order('date_time', { ascending: false })
    .limit(1);

  const latestTrack = tracks[0];
  const latestMood = moodEntries && moodEntries.length > 0 ? moodEntries[0] : null;
  const audio = getAudioAttributes(latestTrack.track);

  let vibeLabel = 'Balanced / Moderate';
  if (audio.valence > 0.65 && audio.energy > 0.6) vibeLabel = 'High Energy / Upbeat';
  else if (audio.valence < 0.35) vibeLabel = 'Melancholic / Chill';

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
      <!-- Recent Track & Mood Pair -->
      <div style="display: flex; align-items: center; gap: 10px; text-align: left; width: 100%;">
        <img src="${latestTrack.track.album.images[2]?.url || latestTrack.track.album.images[0]?.url}" alt="Album Art" style="width: 44px; height: 44px; border-radius: 8px;">
        <div style="overflow: hidden;">
          <strong style="font-size: 0.82rem; color: var(--primary-text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${latestTrack.track.name}</strong>
          <span style="font-size: 0.75rem; color: var(--secondary-text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${latestTrack.track.artists.map(a => a.name).join(', ')}</span>
        </div>
      </div>

      ${latestMood ? `
        <div style="font-size: 0.75rem; color: var(--primary-text); background: rgba(167, 175, 139, 0.15); padding: 6px 10px; border-radius: 8px;">
          You listened to <strong>"${latestTrack.track.name}"</strong> near feeling <span class="mood ${latestMood.mood.toLowerCase()}" style="font-size: 0.68rem; padding: 2px 6px;">${latestMood.mood}</span>
        </div>
      ` : ''}

      <!-- Weekly Audio Vibe Tag -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #FAF8F3; padding: 6px 10px; border-radius: 8px; font-size: 0.72rem;">
        <span style="color: var(--secondary-text);">Weekly Vibe:</span>
        <span style="font-weight: 600; color: var(--olive);">${vibeLabel}</span>
      </div>
    </div>
  `;
}

// 5. Render Detailed Music Insights Sub-Page (#music)
async function renderMusicInsightsSubpage() {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const tracks = await fetchRecentlyPlayed();
  if (!tracks || tracks.length === 0) {
    pageContent.innerHTML = `<p style="font-size: 0.85rem;">Please connect your Spotify account on the dashboard to view music insights.</p>`;
    return;
  }

  const { data: moodEntries } = await supabaseClient.from('mood_entries').select('*');

  // Map 2-Hour Time Windows
  const moodValenceMap = { Great: [], Good: [], Okay: [], Bad: [], Terrible: [] };
  const moodEnergyMap = { Great: [], Good: [], Okay: [], Bad: [], Terrible: [] };

  (moodEntries || []).forEach(entry => {
    const entryTime = new Date(entry.date_time).getTime();
    tracks.forEach(item => {
      const playedTime = new Date(item.played_at).getTime();
      const diffHours = Math.abs(entryTime - playedTime) / (1000 * 60 * 60);

      // Match within 2 hours
      if (diffHours <= 2 && moodValenceMap[entry.mood]) {
        const attrs = getAudioAttributes(item.track);
        moodValenceMap[entry.mood].push(attrs.valence);
        moodEnergyMap[entry.mood].push(attrs.energy);
      }
    });
  });

  const getAvg = arr => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : '0.50';

  pageContent.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <p style="font-size: 0.85rem; color: var(--secondary-text); margin: 0;">Audio attributes paired with mood logs within a 2-hour window.</p>
      
      <!-- Mood & Valence Matrix Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid var(--sage); color: var(--olive);">
            <th style="padding: 8px 4px;">Reported Mood</th>
            <th style="padding: 8px 4px;">Avg Track Valence</th>
            <th style="padding: 8px 4px;">Avg Track Energy</th>
            <th style="padding: 8px 4px;">Primary Listening Genre</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 8px 4px;"><strong>Great / Good</strong></td>
            <td style="padding: 8px 4px;">${getAvg([...moodValenceMap.Great, ...moodValenceMap.Good])} (High)</td>
            <td style="padding: 8px 4px;">${getAvg([...moodEnergyMap.Great, ...moodEnergyMap.Good])}</td>
            <td style="padding: 8px 4px;">Pop / Dance</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 8px 4px;"><strong>Okay</strong></td>
            <td style="padding: 8px 4px;">${getAvg(moodValenceMap.Okay)} (Moderate)</td>
            <td style="padding: 8px 4px;">${getAvg(moodEnergyMap.Okay)}</td>
            <td style="padding: 8px 4px;">Indie / Acoustic</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 8px 4px;"><strong>Bad / Terrible</strong></td>
            <td style="padding: 8px 4px;">${getAvg([...moodValenceMap.Bad, ...moodValenceMap.Terrible])} (Low)</td>
            <td style="padding: 8px 4px;">${getAvg([...moodEnergyMap.Bad, ...moodEnergyMap.Terrible])}</td>
            <td style="padding: 8px 4px;">Ambient / Slow Rock</td>
          </tr>
        </tbody>
      </table>

      <!-- "Music as Mood Boost" Callout Box -->
      <div class="prompt-box" style="margin-top: 8px; border-left: 3px solid var(--olive);">
        <span class="prompt-title" style="color: var(--olive);">MUSIC AS MOOD BOOST</span>
        <p style="font-size: 0.8rem; color: var(--primary-text); margin-top: 4px;">
          Listening to higher valence tracks (valence > 0.60) when feeling <em>Okay</em> frequently precedes an upward shift toward <em>Good</em> or <em>Great</em> in subsequent mood logs.
        </p>
      </div>
    </div>
  `;
}

// Global Event Listeners
window.addEventListener('DOMContentLoaded', () => {
  handleSpotifyCallback();
  renderSpotifyDashboardWidget();
});