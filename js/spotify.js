const SPOTIFY_CLIENT_ID = 'd3c342d0538c4fb9b1ecf547654dc0e5'; 
const REDIRECT_URI = 'https://jessicabsimp.github.io/moodtracker/';
const SCOPES = 'user-read-recently-played';

// ------------------------------------------
// 1. PKCE HELPER FUNCTIONS
// ------------------------------------------

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// ------------------------------------------
// 2. OAUTH 2.0 PKCE AUTHENTICATION FLOW
// ------------------------------------------

async function redirectToSpotifyAuth() {
    if (SPOTIFY_CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID') {
        alert('Please update SPOTIFY_CLIENT_ID in js/spotify.js with your Spotify Client ID.');
        return;
    }

    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const args = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${args.toString()}`;
}

async function handleSpotifyCallback(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) return;

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: codeVerifier
    });

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        if (!response.ok) throw new Error('Failed to exchange code for token');

        const data = await response.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);

        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_expires_at', expiresAt);
        localStorage.removeItem('spotify_code_verifier');

        // Clean query parameters from address bar
        window.history.replaceState({}, document.title, window.location.pathname);

        initSpotifyIntegration();
    } catch (err) {
        console.error('Spotify Token Error:', err);
    }
}

async function getValidAccessToken() {
    const accessToken = localStorage.getItem('spotify_access_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    const expiresAt = localStorage.getItem('spotify_expires_at');

    if (!accessToken || !expiresAt) return null;

    if (Date.now() < parseInt(expiresAt, 10)) {
        return accessToken;
    }

    // Refresh token if expired
    if (refreshToken) {
        try {
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: SPOTIFY_CLIENT_ID
            });

            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            });

            if (response.ok) {
                const data = await response.json();
                const newExpiresAt = Date.now() + (data.expires_in * 1000);
                localStorage.setItem('spotify_access_token', data.access_token);
                localStorage.setItem('spotify_expires_at', newExpiresAt);
                if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
                return data.access_token;
            }
        } catch (err) {
            console.error('Token refresh failed:', err);
        }
    }

    return null;
}

// ------------------------------------------
// 3. FETCH RECENT TRACKS & CORRELATION LOGIC
// ------------------------------------------

async function fetchRecentlyPlayedTracks(token) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) disconnectSpotify();
            return null;
        }

        const data = await response.json();
        return data.items || [];
    } catch (err) {
        console.error('Failed to fetch Spotify recent tracks:', err);
        return null;
    }
}

async function analyzeMoodMusicCorrelations(spotifyItems) {
    if (!supabaseClient || !spotifyItems || spotifyItems.length === 0) return;

    // Fetch mood entries for context correlation
    const { data: moodEntries } = await supabaseClient
        .from('mood_entries')
        .select('mood, date_time')
        .order('date_time', { ascending: false });

    if (!moodEntries || moodEntries.length === 0) return;

    const matchedPairs = [];

    // Match tracks within 2 hours of a logged mood entry
    spotifyItems.forEach(item => {
        const playedAt = new Date(item.played_at).getTime();

        moodEntries.forEach(entry => {
            if (!entry.date_time) return;
            const moodTime = new Date(entry.date_time).getTime();
            const diffHours = Math.abs(playedAt - moodTime) / (1000 * 60 * 60);

            if (diffHours <= 2) {
                matchedPairs.push({
                    trackName: item.track.name,
                    artistName: item.track.artists.map(a => a.name).join(', '),
                    mood: entry.mood,
                    playedAt: item.played_at
                });
            }
        });
    });

    updateVibeCard(matchedPairs, spotifyItems);
}

function updateVibeCard(matchedPairs, rawItems) {
    const vibeTitle = document.getElementById('spotifyVibeTitle');
    const vibeSubtitle = document.getElementById('spotifyVibeSubtitle');

    if (!vibeTitle || !vibeSubtitle) return;

    if (matchedPairs.length > 0) {
        const topMood = matchedPairs[0].mood;
        vibeTitle.textContent = `${topMood} Harmonies`;
        vibeSubtitle.textContent = `Correlated with recent "${topMood}" logs`;
    } else if (rawItems.length > 0) {
        vibeTitle.textContent = "Listening Active";
        vibeSubtitle.textContent = `${rawItems.length} tracks logged recently`;
    } else {
        vibeTitle.textContent = "Calm & Centered";
        vibeSubtitle.textContent = "No active playback detected";
    }
}

// ------------------------------------------
// 4. UI RENDERING & SPOTIFY DOM WRAPPER
// ------------------------------------------

function renderSpotifyRecentSessions(tracks) {
    const container = document.getElementById('spotify-container');
    
    // Update Today Card Spotify Row Status if present
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTracks = (tracks || []).filter(i => i.played_at && new Date(i.played_at).toISOString().split('T')[0] === todayStr);
    
    const elemAudioDesc = document.getElementById('spotifyVibeSubtitle');
    const connectBtn = document.getElementById('connectSpotifyBtn');
    if (elemAudioDesc) {
        elemAudioDesc.textContent = todayTracks.length > 0 
            ? `${todayTracks.length} tracks logged today` 
            : `${tracks ? tracks.length : 0} recent tracks synced`;
    }
    if (connectBtn) {
        connectBtn.textContent = 'Active';
        connectBtn.style.color = 'var(--olive)';
    }

    if (!container) return;

    if (!tracks || tracks.length === 0) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                <span style="font-size:0.75rem; color:var(--secondary-text);">No recent Spotify tracks found.</span>
                <button id="disconnectSpotifyBtn" style="background:none; border:none; color:var(--terracotta); cursor:pointer; font-size:0.72rem; font-weight:600;">Disconnect</button>
            </div>
        `;
        document.getElementById('disconnectSpotifyBtn')?.addEventListener('click', disconnectSpotify);
        return;
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <strong style="font-size: 0.78rem; color: var(--primary-text);">Recent Sessions</strong>
                <button id="disconnectSpotifyBtn" style="background:none; border:none; color:var(--secondary-text); cursor:pointer; font-size:0.68rem; font-weight:600;">Disconnect</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto; padding-right: 4px;">
                ${tracks.slice(0, 5).map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 3px;">
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 72%;">
                            <strong style="color: var(--primary-text);">${item.track.name}</strong>
                            <span style="color: var(--secondary-text);"> — ${item.track.artists.map(a => a.name).join(', ')}</span>
                        </div>
                        <span style="font-size: 0.65rem; color: var(--secondary-text);">${new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('disconnectSpotifyBtn')?.addEventListener('click', disconnectSpotify);
}

function disconnectSpotify() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_expires_at');
    location.reload();
}

// ------------------------------------------
// 5. INITIALIZATION HOOKS
// ------------------------------------------

async function initSpotifyIntegration() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        await handleSpotifyCallback(authCode);
        return;
    }

    const token = await getValidAccessToken();

    if (token) {
        const tracks = await fetchRecentlyPlayedTracks(token);
        if (tracks) {
            renderSpotifyRecentSessions(tracks);
            await analyzeMoodMusicCorrelations(tracks);
        }
    } else {
        const connectBtn = document.getElementById('connectSpotifyBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', redirectToSpotifyAuth);
        }
    }
}

document.addEventListener('DOMContentLoaded', initSpotifyIntegration);