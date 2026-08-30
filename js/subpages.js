// ==========================================
// PHASE INSIGHTS + MUSIC SUBPAGES
// ==========================================

function phaseLocalDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function phaseEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function phaseShowPageError(title, error, retry) {
    pageContent.innerHTML = `
        <div class="phase-page-state phase-page-error">
            <strong>${phaseEscapeHtml(title)}</strong>
            <p>${phaseEscapeHtml(error?.message || 'Unknown error')}</p>
            <button
                type="button"
                class="save-btn"
                id="phasePageRetry"
            >
                Try again
            </button>
        </div>
    `;

    document
        .getElementById('phasePageRetry')
        .addEventListener('click', retry);
}

// ==========================================
// FULL INSIGHTS PAGE
// ==========================================

async function renderFullAnalyticsPage(daysCount = 30) {
    const days = [7, 30, 90].includes(Number(daysCount))
        ? Number(daysCount)
        : 30;

    const route = window.location.hash;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    pageContent.innerHTML =
        '<div class="phase-page-state">Loading insights…</div>';

    try {
        const [
            moodResult,
            medResult,
            journalResult
        ] = await Promise.all([
            supabaseClient
                .from('mood_entries')
                .select('mood, date_time')
                .gte('date_time', startDate.toISOString()),

            supabaseClient
                .from('medication_log')
                .select('timestamp, time_of_day')
                .gte('timestamp', startDate.toISOString()),

            supabaseClient
                .from('journal_entries')
                .select('timestamp')
                .gte('timestamp', startDate.toISOString())
        ]);

        const databaseError =
            moodResult.error ||
            medResult.error ||
            journalResult.error;

        if (databaseError) {
            throw databaseError;
        }

        const moods = moodResult.data || [];
        const meds = medResult.data || [];
        const journals = journalResult.data || [];

        let tracks = [];

        const spotifyConnected =
            typeof isSpotifyConnected === 'function'
                ? isSpotifyConnected()
                : Boolean(
                    localStorage.getItem(
                        'spotify_access_token'
                    )
                );

        if (
            spotifyConnected &&
            typeof fetchRecentlyPlayedTracks === 'function'
        ) {
            const recent =
                await fetchRecentlyPlayedTracks();

            tracks = (recent || []).filter(item => {
                return (
                    item.played_at &&
                    new Date(item.played_at) >= startDate
                );
            });
        }

        // Do not replace another page if the user navigated away.
        if (window.location.hash !== route) {
            return;
        }

        const scoreMap = {
            great: 5,
            good: 4,
            okay: 3,
            bad: 2,
            terrible: 1
        };

        const scores = moods
            .map(entry => {
                const moodName =
                    (entry.mood || '')
                        .toLowerCase()
                        .trim();

                return scoreMap[moodName];
            })
            .filter(Number.isFinite);

        const averageMood = scores.length
            ? (
                scores.reduce(
                    (sum, score) => sum + score,
                    0
                ) / scores.length
            ).toFixed(1)
            : '—';

        const moodDays = new Set(
            moods
                .map(item =>
                    phaseLocalDateKey(item.date_time)
                )
                .filter(Boolean)
        ).size;

        const medDays = new Set(
            meds
                .map(item =>
                    phaseLocalDateKey(item.timestamp)
                )
                .filter(Boolean)
        ).size;

        const trackedDays = new Set([
            ...moods.map(item =>
                phaseLocalDateKey(item.date_time)
            ),
            ...meds.map(item =>
                phaseLocalDateKey(item.timestamp)
            ),
            ...journals.map(item =>
                phaseLocalDateKey(item.timestamp)
            ),
            ...tracks.map(item =>
                phaseLocalDateKey(item.played_at)
            )
        ].filter(Boolean)).size;

        // Display no more than 14 daily rows.
        const daily = new Map();

        for (
            let offset = Math.min(days, 14) - 1;
            offset >= 0;
            offset--
        ) {
            const date = new Date();

            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - offset);

            daily.set(
                phaseLocalDateKey(date),
                {
                    date,
                    moods: [],
                    meds: 0,
                    journals: 0,
                    tracks: 0
                }
            );
        }

        moods.forEach(item => {
            const day = daily.get(
                phaseLocalDateKey(item.date_time)
            );

            const score = scoreMap[
                (item.mood || '')
                    .toLowerCase()
                    .trim()
            ];

            if (day && Number.isFinite(score)) {
                day.moods.push(score);
            }
        });

        meds.forEach(item => {
            const day = daily.get(
                phaseLocalDateKey(item.timestamp)
            );

            if (day) {
                day.meds++;
            }
        });

        journals.forEach(item => {
            const day = daily.get(
                phaseLocalDateKey(item.timestamp)
            );

            if (day) {
                day.journals++;
            }
        });

        tracks.forEach(item => {
            const day = daily.get(
                phaseLocalDateKey(item.played_at)
            );

            if (day) {
                day.tracks++;
            }
        });

        const summary = trackedDays
            ? (
                `You recorded activity on ${trackedDays} ` +
                `of the last ${days} days. ` +
                (
                    moodDays
                        ? `Mood was logged on ${moodDays} days with a ${averageMood}/5 average. `
                        : ''
                ) +
                (
                    medDays
                        ? `Medication was logged on ${medDays} days. `
                        : ''
                ) +
                (
                    journals.length
                        ? `${journals.length} journal entries were recorded. `
                        : ''
                ) +
                (
                    tracks.length
                        ? `${tracks.length} recent Spotify plays were available.`
                        : ''
                )
            )
            : 'There is not enough activity in this range to identify a pattern yet.';

        pageContent.innerHTML = `
            <div class="phase-page-toolbar">
                <p>
                    Review how your tracked signals moved
                    during the selected period.
                </p>

                <div class="range-switcher">
                    ${[7, 30, 90].map(value => `
                        <button
                            type="button"
                            class="range-btn ${
                                value === days
                                    ? 'active'
                                    : ''
                            }"
                            data-range="${value}"
                        >
                            ${value}D
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="phase-page-stats">
                ${[
                    [
                        'mood',
                        averageMood,
                        'Average mood'
                    ],
                    [
                        'mood',
                        moodDays,
                        'Mood days'
                    ],
                    [
                        'medication',
                        medDays,
                        'Medication days'
                    ],
                    [
                        'journal',
                        journals.length,
                        'Journal entries'
                    ],
                    [
                        'listening',
                        tracks.length,
                        'Recent Spotify plays'
                    ],
                    [
                        'neutral',
                        trackedDays,
                        'Days with activity'
                    ]
                ].map(([accent, value, label]) => `
                    <div class="phase-page-stat ${accent}">
                        <strong>${value}</strong>
                        <span>${label}</span>
                    </div>
                `).join('')}
            </div>

            <div class="phase-pattern-box">
                <span class="prompt-title">
                    PATTERN SUMMARY
                </span>

                <p>${summary}</p>
            </div>

            <div class="phase-signal-list">
                <div class="phase-list-heading">
                    <strong>Recent daily signals</strong>
                    <span>
                        Latest ${Math.min(days, 14)} days
                    </span>
                </div>

                ${Array.from(daily.values())
                    .reverse()
                    .map(day => {
                        const mood = day.moods.length
                            ? (
                                day.moods.reduce(
                                    (sum, value) =>
                                        sum + value,
                                    0
                                ) / day.moods.length
                            ).toFixed(1)
                            : '—';

                        return `
                            <div class="phase-signal-row">
                                <strong>
                                    ${day.date.toLocaleDateString(
                                        [],
                                        {
                                            month: 'short',
                                            day: 'numeric'
                                        }
                                    )}
                                </strong>

                                <span>● Mood ${mood}</span>
                                <span>● ${day.meds} meds</span>
                                <span>
                                    ● ${day.journals} journal
                                </span>
                                <span>
                                    ● ${day.tracks} tracks
                                </span>
                            </div>
                        `;
                    })
                    .join('')}
            </div>

            <p class="phase-page-note">
                Spotify supplies only a limited
                recent-play window. Permanent music trends
                will require saving each sync to Supabase later.
            </p>
        `;

        pageContent
            .querySelectorAll('[data-range]')
            .forEach(button => {
                button.addEventListener(
                    'click',
                    () => {
                        renderFullAnalyticsPage(
                            Number(button.dataset.range)
                        );
                    }
                );
            });
    } catch (error) {
        console.error(
            'Analytics page failed:',
            error
        );

        if (window.location.hash === route) {
            phaseShowPageError(
                'Insights could not be loaded.',
                error,
                () =>
                    renderFullAnalyticsPage(days)
            );
        }
    }
}

// ==========================================
// FULL MUSIC PAGE
// ==========================================

async function renderMusicInsightsSubpage() {
    const route = window.location.hash;

    if (!isSpotifyConnected()) {
        pageContent.innerHTML = `
            <div class="phase-page-state music-connect-state">
                <strong>
                    Connect your listening signal
                </strong>

                <p>
                    Connect Spotify to view your current
                    track and recent listening activity.
                </p>

                <button
                    type="button"
                    class="save-btn"
                    id="musicConnectBtn"
                >
                    Connect Spotify
                </button>
            </div>
        `;

        document
            .getElementById('musicConnectBtn')
            .addEventListener(
                'click',
                redirectToSpotifyAuth
            );

        return;
    }

    pageContent.innerHTML =
        '<div class="phase-page-state">Syncing Spotify…</div>';

    try {
        const [
            tracks,
            current
        ] = await Promise.all([
            fetchRecentlyPlayedTracks(),
            fetchCurrentlyPlayingTrack()
        ]);

        if (window.location.hash !== route) {
            return;
        }

        if (!isSpotifyConnected()) {
            return renderMusicInsightsSubpage();
        }

        const recent = tracks || [];
        const today = phaseLocalDateKey(
            new Date()
        );

        const todayCount = recent.filter(item => {
            return (
                phaseLocalDateKey(item.played_at) ===
                today
            );
        }).length;

        const artists = new Set(
            recent.flatMap(item => {
                return (
                    item.track?.artists || []
                ).map(artist => artist.name);
            })
        );

        const active =
            current?.item ||
            recent[0]?.track;

        const activeArtists =
            active?.artists
                ?.map(artist => artist.name)
                .join(', ') || '';

        const activeImage =
            active?.album
                ?.images?.[0]?.url || '';

        pageContent.innerHTML = `
            <div class="phase-page-toolbar">
                <p>
                    Your current and recently played
                    Spotify activity.
                </p>

                <div>
                    <button
                        type="button"
                        class="text-action-btn violet-action-btn"
                        id="musicRefresh"
                    >
                        Refresh
                    </button>

                    <button
                        type="button"
                        class="text-action-btn"
                        id="musicDisconnect"
                    >
                        Disconnect
                    </button>
                </div>
            </div>

            ${active ? `
                <div class="music-current">
                    ${activeImage ? `
                        <img
                            src="${phaseEscapeHtml(activeImage)}"
                            alt="Album art"
                        >
                    ` : ''}

                    <div>
                        <span class="prompt-title">
                            ${
                                current?.is_playing
                                    ? 'PLAYING NOW'
                                    : 'MOST RECENT'
                            }
                        </span>

                        <h3>
                            ${phaseEscapeHtml(active.name)}
                        </h3>

                        <p>
                            ${phaseEscapeHtml(activeArtists)}
                        </p>
                    </div>
                </div>
            ` : ''}

            <div class="phase-page-stats music-stats">
                <div class="phase-page-stat listening">
                    <strong>${todayCount}</strong>
                    <span>Plays today</span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>${recent.length}</strong>
                    <span>Recent plays</span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>${artists.size}</strong>
                    <span>Recent artists</span>
                </div>
            </div>

            <div class="phase-signal-list">
                <div class="phase-list-heading">
                    <strong>Recently played</strong>
                    <span>
                        Latest activity from Spotify
                    </span>
                </div>

                ${recent.length ? recent.map(item => {
                    const track = item.track || {};

                    const image =
                        track.album?.images?.[2]?.url ||
                        track.album?.images?.[0]?.url ||
                        '';

                    const names =
                        track.artists
                            ?.map(artist => artist.name)
                            .join(', ') ||
                        'Unknown artist';

                    const playedAt =
                        item.played_at
                            ? new Date(
                                item.played_at
                            ).toLocaleString(
                                [],
                                {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                }
                            )
                            : '';

                    return `
                        <div class="music-track-row">
                            ${image ? `
                                <img
                                    src="${phaseEscapeHtml(image)}"
                                    alt=""
                                >
                            ` : `
                                <span class="music-art-placeholder">
                                    ♪
                                </span>
                            `}

                            <div>
                                <strong>
                                    ${phaseEscapeHtml(
                                        track.name ||
                                        'Unknown track'
                                    )}
                                </strong>

                                <span>
                                    ${phaseEscapeHtml(names)}
                                </span>
                            </div>

                            <time>
                                ${phaseEscapeHtml(playedAt)}
                            </time>
                        </div>
                    `;
                }).join('') : `
                    <div class="phase-page-state">
                        No recent tracks were returned yet.
                    </div>
                `}
            </div>

            <p class="phase-page-note">
                Spotify supplies only a limited
                recent-play window. Phase does not yet
                store permanent listening history.
            </p>
        `;

        document
            .getElementById('musicRefresh')
            .addEventListener(
                'click',
                renderMusicInsightsSubpage
            );

        document
            .getElementById('musicDisconnect')
            .addEventListener('click', () => {
                const approved = window.confirm(
                    'Disconnect Spotify from Phase?'
                );

                if (approved) {
                    disconnectSpotify(false);
                    renderMusicInsightsSubpage();
                }
            });
    } catch (error) {
        console.error(
            'Music page failed:',
            error
        );

        if (window.location.hash === route) {
            phaseShowPageError(
                'Music insights could not be loaded.',
                error,
                renderMusicInsightsSubpage
            );
        }
    }
}