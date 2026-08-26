// ==========================================
// SPOTIFY INTEGRATION & AUDIO PULSE ENGINE
// ==========================================

async function fetchRecentlyPlayedTracks(accessToken) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=30', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('spotify_access_token');
            renderSpotifyRecentSessions([]);
            return null;
        }

        if (!response.ok) {
            console.error('Failed to fetch Spotify tracks:', response.statusText);
            return null;
        }

        const data = await response.json();
        return data.items || [];
    } catch (err) {
        console.error('Error fetching Spotify data:', err);
        return null;
    }
}

function renderSpotifyRecentSessions(tracks) {
    const container = document.getElementById('spotify-container');
    const tokenExists = !!localStorage.getItem('spotify_access_token');
    
    // Target Audio Pulse Bar UI Elements
    const elemTitle = document.getElementById('dashboardListeningTitle');
    const elemArtist = document.getElementById('dashboardListeningArtist');
    const elemLabel = document.getElementById('dashboardListeningLabel');
    const elemPulseText = document.getElementById('audioPulseLevel');
    const elemArtContainer = document.getElementById('dashboardAlbumArt');
    const pulseDots = document.querySelectorAll('#audioPulseDots .pulse-dot');
    const waveformVisualizer = document.getElementById('audioWaveformVisualizer');

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTracks = (tracks || []).filter(i => i.played_at && new Date(i.played_at).toISOString().split('T')[0] === todayStr);

    // Update Left-Column Today Card Status Subtitle
    const elemAudioDesc = document.getElementById('spotifyVibeSubtitle');
    const connectBtn = document.getElementById('connectSpotifyBtn');
    
    if (elemAudioDesc) {
        elemAudioDesc.textContent = todayTracks.length > 0 
            ? `${todayTracks.length} tracks logged today` 
            : (tokenExists ? `${tracks ? tracks.length : 0} recent tracks synced` : 'Spotify not connected');
    }
    if (connectBtn && tokenExists) {
        connectBtn.textContent = 'Active';
        connectBtn.style.color = 'var(--signal-listening-hover)';
    }

    // Populate Audio Pulse Bar with Dynamic Spotify Data
    if (tokenExists && tracks && tracks.length > 0) {
        const latestTrack = tracks[0];
        const trackName = latestTrack.track ? latestTrack.track.name : 'Recently Played Track';
        const artistName = latestTrack.track && latestTrack.track.artists ? latestTrack.track.artists.map(a => a.name).join(', ') : 'Spotify Artist';
        const albumImg = latestTrack.track && latestTrack.track.album && latestTrack.track.album.images.length > 0 ? latestTrack.track.album.images[0].url : null;

        if (elemTitle) elemTitle.textContent = trackName;
        if (elemArtist) elemArtist.innerHTML = `${artistName} <span class="spotify-badge-icon">🟢</span>`;
        if (elemLabel) elemLabel.textContent = todayTracks.length > 0 ? 'Recently played' : 'Last synced track';

        if (albumImg && elemArtContainer) {
            elemArtContainer.innerHTML = `<img src="${albumImg}" alt="Album Art" style="width:100%; height:100%; border-radius:var(--phase-radius-sm); object-fit:cover;">`;
        }

        // Calculate Audio Pulse Level based on today's listening density
        let pulseLevel = 'Low';
        let activeDotsCount = 3;

        if (todayTracks.length >= 25) {
            pulseLevel = 'High';
            activeDotsCount = 9;
        } else if (todayTracks.length >= 10) {
            pulseLevel = 'Moderate';
            activeDotsCount = 6;
        }

        if (elemPulseText) elemPulseText.textContent = pulseLevel;

        pulseDots.forEach((dot, idx) => {
            if (idx < activeDotsCount) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        if (waveformVisualizer) waveformVisualizer.style.opacity = '1';
    } else if (!tokenExists) {
        if (elemTitle) elemTitle.textContent = 'Spotify Disconnected';
        if (elemArtist) elemArtist.textContent = 'Connect Spotify to sync audio pulse';
        if (elemLabel) elemLabel.textContent = 'Listening status';
        if (elemPulseText) elemPulseText.textContent = 'Idle';
        
        pulseDots.forEach(dot => dot.classList.remove('active'));
        if (waveformVisualizer) waveformVisualizer.style.opacity = '0.3';
    }

    if (!container) return;

    if (tracks && tracks.length > 0) {
        container.innerHTML = `
            <div class="spotify-track-list">
                ${tracks.map(item => `
                    <div class="spotify-track-item">
                        <img src="${item.track.album.images[2]?.url || item.track.album.images[0]?.url || ''}" alt="Cover" class="track-thumb">
                        <div class="track-info">
                            <span class="track-name">${item.track.name}</span>
                            <span class="track-artist">${item.track.artists.map(a => a.name).join(', ')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function initSpotifyAuth() {
    const connectBtn = document.getElementById('connectSpotifyBtn');
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            const tokenExists = !!localStorage.getItem('spotify_access_token');
            if (!tokenExists && typeof redirectToSpotifyAuth === 'function') {
                redirectToSpotifyAuth();
            }
        });
    }

    // Auto-sync bottom bar on initial load if token exists
    const token = localStorage.getItem('spotify_access_token');
    if (token) {
        fetchRecentlyPlayedTracks(token).then(tracks => {
            if (tracks) renderSpotifyRecentSessions(tracks);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSpotifyAuth();
});