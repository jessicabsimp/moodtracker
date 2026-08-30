// ==========================================
// SPOTIFY INTEGRATION — AUTHORIZATION CODE PKCE
// ==========================================

// Safe to expose publicly. This is an identifier, not a secret.
const SPOTIFY_CLIENT_ID = 'd3c342d0538c4fb9b1ecf547654dc0e5';

// IMPORTANT:
// This must exactly match a Redirect URI registered in your
// Spotify Developer Dashboard, including the trailing slash.
const SPOTIFY_REDIRECT_URI =
    'https://jessicabsimp.github.io/moodtracker/';

// Permissions Phase requests from the user.
const SPOTIFY_SCOPES = [
    'user-read-recently-played',
    'user-read-currently-playing'
];

// Local storage keys.
const SPOTIFY_STORAGE_KEYS = {
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expiresAt: 'spotify_token_expires_at',
    codeVerifier: 'spotify_code_verifier',
    oauthState: 'spotify_oauth_state'
};

// ==========================================
// PKCE HELPERS
// ==========================================

function generateRandomString(length = 64) {
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);

    return Array.from(randomValues)
        .map(value => possible[value % possible.length])
        .join('');
}

async function createCodeChallenge(codeVerifier) {
    const encodedVerifier = new TextEncoder().encode(codeVerifier);

    const digest = await window.crypto.subtle.digest(
        'SHA-256',
        encodedVerifier
    );

    return arrayBufferToBase64Url(digest);
}

function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return window.btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// ==========================================
// BEGIN SPOTIFY AUTHORIZATION
// ==========================================

async function redirectToSpotifyAuth() {
    try {
        const codeVerifier = generateRandomString(128);
        const codeChallenge = await createCodeChallenge(codeVerifier);
        const oauthState = generateRandomString(32);

        localStorage.setItem(
            SPOTIFY_STORAGE_KEYS.codeVerifier,
            codeVerifier
        );

        localStorage.setItem(
            SPOTIFY_STORAGE_KEYS.oauthState,
            oauthState
        );

        const authUrl = new URL(
            'https://accounts.spotify.com/authorize'
        );

        authUrl.search = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: SPOTIFY_REDIRECT_URI,
            scope: SPOTIFY_SCOPES.join(' '),
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            state: oauthState,
            show_dialog: 'true'
        }).toString();

        window.location.assign(authUrl.toString());
    } catch (error) {
        console.error('Unable to start Spotify authorization:', error);

        updateSpotifyConnectionStatus(
            'Spotify connection could not be started.'
        );
    }
}

// ==========================================
// HANDLE SPOTIFY CALLBACK
// ==========================================

async function handleSpotifyAuthCallback() {
    const queryParams = new URLSearchParams(window.location.search);

    const authorizationCode = queryParams.get('code');
    const returnedState = queryParams.get('state');
    const spotifyError = queryParams.get('error');

    if (spotifyError) {
        console.error('Spotify authorization error:', spotifyError);

        cleanSpotifyCallbackFromUrl();

        updateSpotifyConnectionStatus(
            spotifyError === 'access_denied'
                ? 'Spotify access was not approved.'
                : `Spotify connection failed: ${spotifyError}`
        );

        return false;
    }

    if (!authorizationCode) {
        return false;
    }

    const expectedState = localStorage.getItem(
        SPOTIFY_STORAGE_KEYS.oauthState
    );

    if (
        !returnedState ||
        !expectedState ||
        returnedState !== expectedState
    ) {
        console.error('Spotify authorization state did not match.');

        clearTemporarySpotifyAuthData();
        cleanSpotifyCallbackFromUrl();

        updateSpotifyConnectionStatus(
            'Spotify connection could not be verified. Please try again.'
        );

        return false;
    }

    const codeVerifier = localStorage.getItem(
        SPOTIFY_STORAGE_KEYS.codeVerifier
    );

    if (!codeVerifier) {
        console.error('Spotify PKCE code verifier is missing.');

        clearTemporarySpotifyAuthData();
        cleanSpotifyCallbackFromUrl();

        updateSpotifyConnectionStatus(
            'Spotify connection expired. Please try connecting again.'
        );

        return false;
    }

    try {
        const response = await fetch(
            'https://accounts.spotify.com/api/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'authorization_code',
                    code: authorizationCode,
                    redirect_uri: SPOTIFY_REDIRECT_URI,
                    code_verifier: codeVerifier
                })
            }
        );

        const tokenData = await response.json();

        if (!response.ok) {
            throw new Error(
                tokenData.error_description ||
                tokenData.error ||
                'Spotify rejected the token request.'
            );
        }

        saveSpotifyTokens(tokenData);
        clearTemporarySpotifyAuthData();
        cleanSpotifyCallbackFromUrl();

        return true;
    } catch (error) {
        console.error(
            'Spotify token exchange failed:',
            error
        );

        clearTemporarySpotifyAuthData();
        cleanSpotifyCallbackFromUrl();

        updateSpotifyConnectionStatus(
            `Spotify connection failed: ${error.message}`
        );

        return false;
    }
}

function cleanSpotifyCallbackFromUrl() {
    const cleanUrl =
        window.location.origin +
        window.location.pathname +
        window.location.hash;

    window.history.replaceState(
        {},
        document.title,
        cleanUrl
    );
}

function clearTemporarySpotifyAuthData() {
    localStorage.removeItem(
        SPOTIFY_STORAGE_KEYS.codeVerifier
    );

    localStorage.removeItem(
        SPOTIFY_STORAGE_KEYS.oauthState
    );
}

// ==========================================
// TOKEN STORAGE AND REFRESH
// ==========================================

function saveSpotifyTokens(tokenData) {
    if (tokenData.access_token) {
        localStorage.setItem(
            SPOTIFY_STORAGE_KEYS.accessToken,
            tokenData.access_token
        );
    }

    if (tokenData.refresh_token) {
        localStorage.setItem(
            SPOTIFY_STORAGE_KEYS.refreshToken,
            tokenData.refresh_token
        );
    }

    const expiresInSeconds =
        Number(tokenData.expires_in) || 3600;

    // Refresh one minute before Spotify says the token expires.
    const expiresAt =
        Date.now() + (expiresInSeconds - 60) * 1000;

    localStorage.setItem(
        SPOTIFY_STORAGE_KEYS.expiresAt,
        String(expiresAt)
    );
}

async function refreshSpotifyAccessToken() {
    const refreshToken = localStorage.getItem(
        SPOTIFY_STORAGE_KEYS.refreshToken
    );

    if (!refreshToken) {
        disconnectSpotify(false);
        return null;
    }

    try {
        const response = await fetch(
            'https://accounts.spotify.com/api/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            }
        );

        const tokenData = await response.json();

        if (!response.ok) {
            throw new Error(
                tokenData.error_description ||
                tokenData.error ||
                'Spotify token refresh failed.'
            );
        }

        saveSpotifyTokens(tokenData);

        return tokenData.access_token;
    } catch (error) {
        console.error(
            'Unable to refresh Spotify token:',
            error
        );

        disconnectSpotify(false);
        return null;
    }
}

async function getValidSpotifyAccessToken() {
    let accessToken = localStorage.getItem(
        SPOTIFY_STORAGE_KEYS.accessToken
    );

    if (!accessToken) {
        return null;
    }

    const expiresAt = Number(
        localStorage.getItem(
            SPOTIFY_STORAGE_KEYS.expiresAt
        )
    );

    if (!expiresAt || Date.now() >= expiresAt) {
        accessToken = await refreshSpotifyAccessToken();
    }

    return accessToken;
}

function isSpotifyConnected() {
    return Boolean(
        localStorage.getItem(
            SPOTIFY_STORAGE_KEYS.accessToken
        ) ||
        localStorage.getItem(
            SPOTIFY_STORAGE_KEYS.refreshToken
        )
    );
}

function disconnectSpotify(reloadPage = true) {
    Object.values(SPOTIFY_STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });

    if (reloadPage) {
        window.location.reload();
    } else {
        renderSpotifyRecentSessions([]);
    }
}

// ==========================================
// FETCH SPOTIFY DATA
// ==========================================

async function spotifyApiRequest(endpoint, retry = true) {
    const accessToken =
        await getValidSpotifyAccessToken();

    if (!accessToken) {
        return null;
    }

    try {
        const response = await fetch(
            `https://api.spotify.com/v1${endpoint}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (response.status === 401 && retry) {
            const refreshedToken =
                await refreshSpotifyAccessToken();

            if (refreshedToken) {
                return spotifyApiRequest(endpoint, false);
            }

            return null;
        }

        if (response.status === 204) {
            return null;
        }

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(
                responseData.error?.message ||
                `Spotify request failed with status ${response.status}.`
            );
        }

        return responseData;
    } catch (error) {
        console.error('Spotify API request failed:', error);

        updateSpotifyConnectionStatus(
            `Spotify sync failed: ${error.message}`
        );

        return null;
    }
}

async function fetchRecentlyPlayedTracks() {
    const data = await spotifyApiRequest(
        '/me/player/recently-played?limit=50'
    );

    return data?.items || [];
}

async function fetchCurrentlyPlayingTrack() {
    return spotifyApiRequest(
        '/me/player/currently-playing'
    );
}

// ==========================================
// RENDER SPOTIFY DATA
// ==========================================

function updateSpotifyConnectionStatus(message) {
    const subtitle = document.getElementById(
        'spotifyVibeSubtitle'
    );

    if (subtitle) {
        subtitle.textContent = message;
    }
}

function renderSpotifyRecentSessions(
    tracks,
    currentlyPlaying = null
) {
    const container = document.getElementById(
        'spotify-container'
    );

    const tokenExists = isSpotifyConnected();

    const elemTitle = document.getElementById(
        'dashboardListeningTitle'
    );

    const elemArtist = document.getElementById(
        'dashboardListeningArtist'
    );

    const elemLabel = document.getElementById(
        'dashboardListeningLabel'
    );

    const elemPulseText = document.getElementById(
        'audioPulseLevel'
    );

    const elemArtContainer = document.getElementById(
        'dashboardAlbumArt'
    );

    const pulseDots = document.querySelectorAll(
        '#audioPulseDots .pulse-dot'
    );

    const waveformVisualizer = document.getElementById(
        'audioWaveformVisualizer'
    );

    const elemAudioDesc = document.getElementById(
        'spotifyVibeSubtitle'
    );

    const connectBtn = document.getElementById(
        'connectSpotifyBtn'
    );

    const todayStr = new Date()
        .toISOString()
        .split('T')[0];

    const todayTracks = (tracks || []).filter(item => {
        if (!item.played_at) {
            return false;
        }

        return new Date(item.played_at)
            .toISOString()
            .split('T')[0] === todayStr;
    });

    if (elemAudioDesc) {
        if (!tokenExists) {
            elemAudioDesc.textContent =
                'Spotify not connected';
        } else if (todayTracks.length > 0) {
            elemAudioDesc.textContent =
                `${todayTracks.length} tracks logged today`;
        } else {
            elemAudioDesc.textContent =
                `${tracks?.length || 0} recent tracks synced`;
        }
    }

    if (connectBtn) {
        connectBtn.textContent = tokenExists
            ? 'Active'
            : 'Connect';

        connectBtn.style.color = tokenExists
            ? 'var(--signal-listening-hover)'
            : '';
    }

    const activeTrack =
        currentlyPlaying?.item ||
        tracks?.[0]?.track ||
        null;

    if (tokenExists && activeTrack) {
        const trackName =
            activeTrack.name || 'Spotify Track';

        const artistName =
            activeTrack.artists
                ?.map(artist => artist.name)
                .join(', ') || 'Spotify Artist';

        const albumImg =
            activeTrack.album?.images?.[0]?.url || null;

        if (elemTitle) {
            elemTitle.textContent = trackName;
        }

        if (elemArtist) {
            elemArtist.innerHTML =
                `${artistName} ` +
                '<span class="spotify-badge-icon">🟢</span>';
        }

        if (elemLabel) {
            elemLabel.textContent =
                currentlyPlaying?.is_playing
                    ? 'Playing now'
                    : 'Recently played';
        }

        if (albumImg && elemArtContainer) {
            elemArtContainer.innerHTML = `
                <img
                    src="${albumImg}"
                    alt="Album art"
                    style="
                        width: 100%;
                        height: 100%;
                        border-radius: var(--phase-radius-sm);
                        object-fit: cover;
                    "
                >
            `;
        }

        let pulseLevel = 'Low';
        let activeDotsCount = 3;

        if (todayTracks.length >= 25) {
            pulseLevel = 'High';
            activeDotsCount = 9;
        } else if (todayTracks.length >= 10) {
            pulseLevel = 'Moderate';
            activeDotsCount = 6;
        }

        if (elemPulseText) {
            elemPulseText.textContent = pulseLevel;
        }

        pulseDots.forEach((dot, index) => {
            dot.classList.toggle(
                'active',
                index < activeDotsCount
            );
        });

        if (waveformVisualizer) {
            waveformVisualizer.style.opacity = '1';
        }
    } else if (!tokenExists) {
        if (elemTitle) {
            elemTitle.textContent =
                'Spotify Disconnected';
        }

        if (elemArtist) {
            elemArtist.textContent =
                'Connect Spotify to sync audio pulse';
        }

        if (elemLabel) {
            elemLabel.textContent =
                'Listening status';
        }

        if (elemPulseText) {
            elemPulseText.textContent = 'Idle';
        }

        pulseDots.forEach(dot => {
            dot.classList.remove('active');
        });

        if (waveformVisualizer) {
            waveformVisualizer.style.opacity = '0.3';
        }
    }

    if (!container) {
        return;
    }

    if (!tokenExists) {
        container.innerHTML = `
            <p style="font-size: 0.85rem;">
                Connect Spotify to view your recent listening.
            </p>
        `;

        return;
    }

    if (!tracks || tracks.length === 0) {
        container.innerHTML = `
            <p style="font-size: 0.85rem;">
                No recent Spotify tracks were found.
            </p>
        `;

        return;
    }

    container.innerHTML = `
        <div class="spotify-track-list">
            ${tracks.map(item => {
                const track = item.track;
                const image =
                    track?.album?.images?.[2]?.url ||
                    track?.album?.images?.[0]?.url ||
                    '';

                const name =
                    track?.name || 'Unknown track';

                const artists =
                    track?.artists
                        ?.map(artist => artist.name)
                        .join(', ') ||
                    'Unknown artist';

                return `
                    <div class="spotify-track-item">
                        <img
                            src="${image}"
                            alt=""
                            class="track-thumb"
                        >
                        <div class="track-info">
                            <span class="track-name">
                                ${name}
                            </span>
                            <span class="track-artist">
                                ${artists}
                            </span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==========================================
// SYNC AND INITIALIZE
// ==========================================

async function syncSpotifyData() {
    if (!isSpotifyConnected()) {
        renderSpotifyRecentSessions([]);
        return;
    }

    updateSpotifyConnectionStatus(
        'Syncing Spotify…'
    );

    const [
        tracks,
        currentlyPlaying
    ] = await Promise.all([
        fetchRecentlyPlayedTracks(),
        fetchCurrentlyPlayingTrack()
    ]);

    let historySaveError = null;

    if (
        tracks?.length &&
        typeof saveSpotifyListeningHistory ===
            'function'
    ) {
        try {
            await saveSpotifyListeningHistory(
                tracks
            );
        } catch (error) {
            historySaveError = error;

            console.error(
                'Spotify history database sync failed:',
                error
            );
        }
    }

    renderSpotifyRecentSessions(
        tracks || [],
        currentlyPlaying
    );

    if (historySaveError) {
        updateSpotifyConnectionStatus(
            'Spotify connected — history save failed'
        );
    }
}

// This function name is referenced by router.js.
async function initSpotifyIntegration() {
    await syncSpotifyData();
}

async function initSpotifyAuth() {
    const callbackWasHandled =
        await handleSpotifyAuthCallback();

    const connectBtn = document.getElementById(
        'connectSpotifyBtn'
    );

    if (connectBtn && !connectBtn.dataset.spotifyReady) {
        connectBtn.dataset.spotifyReady = 'true';

        connectBtn.addEventListener('click', async () => {
            if (!isSpotifyConnected()) {
                await redirectToSpotifyAuth();
                return;
            }

            const shouldDisconnect = window.confirm(
                'Disconnect Spotify from Phase?'
            );

            if (shouldDisconnect) {
                disconnectSpotify();
            }
        });
    }

    if (callbackWasHandled || isSpotifyConnected()) {
        await syncSpotifyData();
    } else {
        renderSpotifyRecentSessions([]);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSpotifyAuth().catch(error => {
        console.error(
            'Spotify initialization failed:',
            error
        );

        updateSpotifyConnectionStatus(
            'Spotify could not be initialized.'
        );
    });
});