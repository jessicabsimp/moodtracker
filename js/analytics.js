// ==========================================
// PHASE DASHBOARD SIGNAL ENGINE
// ==========================================
//
// Dashboard signals:
// - Mood
// - Listening
// - Medication
// - Sleep
//
// Journal is intentionally no longer part
// of the Phase dashboard signal model.
// ==========================================


// ==========================================
// DATE BUCKETS
// ==========================================

function getRangeDateBuckets(daysCount = 7) {
    const dayNames = [
        'Sun',
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat'
    ];

    const days = [];
    const today = new Date();

    for (
        let i = daysCount - 1;
        i >= 0;
        i--
    ) {
        const date = new Date();

        date.setDate(
            today.getDate() - i
        );

        days.push({
            dateString:
                phaseLocalDateKey(date),

            label:
                daysCount <= 14
                    ? dayNames[date.getDay()]
                    : `${date.getMonth() + 1}/${date.getDate()}`,

            rawDate:
                date
        });
    }

    return days;
}


// ==========================================
// MOOD NORMALIZATION
// ==========================================

function normalizeMoodData(
    moodEntries,
    buckets
) {
    const moodScores = {
        great: 1,
        good: 0.75,
        okay: 0.5,
        bad: 0.25,
        terrible: 0
    };

    let lastValidScore = 0.5;

    return buckets.map(
        bucket => {
            const dayEntries =
                (moodEntries || [])
                    .filter(entry => {
                        if (!entry.date_time) {
                            return false;
                        }

                        return (
                            phaseLocalDateKey(
                                entry.date_time
                            ) ===
                            bucket.dateString
                        );
                    });

            if (dayEntries.length) {
                const values =
                    dayEntries.map(entry => {
                        const normalized =
                            String(
                                entry.mood || ''
                            )
                                .toLowerCase()
                                .trim();

                        return (
                            moodScores[
                                normalized
                            ] ?? 0.5
                        );
                    });

                lastValidScore =
                    values.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) /
                    values.length;
            }

            return {
                dateString:
                    bucket.dateString,

                label:
                    bucket.label,

                val:
                    lastValidScore,

                hasData:
                    dayEntries.length > 0,

                count:
                    dayEntries.length
            };
        }
    );
}


// ==========================================
// LISTENING NORMALIZATION
// ==========================================

function normalizeListeningData(
    spotifyItems,
    buckets
) {
    const countsMap = {};

    (spotifyItems || [])
        .forEach(item => {
            if (!item.played_at) {
                return;
            }

            const dateString =
                phaseLocalDateKey(
                    item.played_at
                );

            countsMap[dateString] =
                (
                    countsMap[
                        dateString
                    ] || 0
                ) + 1;
        });

    const maximum =
        Math.max(
            ...Object.values(
                countsMap
            ),
            1
        );

    return buckets.map(
        bucket => {
            const count =
                countsMap[
                    bucket.dateString
                ] || 0;

            return {
                dateString:
                    bucket.dateString,

                label:
                    bucket.label,

                count,

                norm:
                    count / maximum
            };
        }
    );
}


// ==========================================
// MEDICATION EVENTS
// ==========================================

function mapMedicationEvents(
    medLogs,
    buckets
) {
    return buckets.map(
        bucket => {
            const dayLogs =
                (medLogs || [])
                    .filter(log => {
                        if (!log.timestamp) {
                            return false;
                        }

                        return (
                            phaseLocalDateKey(
                                log.timestamp
                            ) ===
                            bucket.dateString
                        );
                    });

            return {
                dateString:
                    bucket.dateString,

                label:
                    bucket.label,

                count:
                    dayLogs.length,

                doses:
                    dayLogs.map(
                        log =>
                            log.time_of_day
                    )
            };
        }
    );
}


// ==========================================
// SLEEP NORMALIZATION
// ==========================================
//
// Completed sleep windows are associated with
// the day the user GOT UP.
//
// Example:
// Sun 11:45 PM → Mon 7:10 AM
// belongs to Monday.
//
// This makes the sleep signal line up with the
// day it is most likely to affect.
// ==========================================

function normalizeSleepData(
    sleepSessions,
    buckets
) {
    return buckets.map(
        bucket => {
            const sessions =
                (sleepSessions || [])
                    .filter(session => {
                        const anchor =
                            session.wake_time ||
                            session.bedtime;

                        if (!anchor) {
                            return false;
                        }

                        return (
                            phaseLocalDateKey(
                                anchor
                            ) ===
                            bucket.dateString
                        );
                    });

            if (!sessions.length) {
                return {
                    dateString:
                        bucket.dateString,

                    label:
                        bucket.label,

                    hasData:
                        false,

                    durationMinutes:
                        null,

                    durationNorm:
                        0,

                    quality:
                        null,

                    rested:
                        null,

                    isOpen:
                        false,

                    session:
                        null
                };
            }

            const session =
                sessions[
                    sessions.length - 1
                ];

            const end =
                session.wake_time ||
                new Date().toISOString();

            let durationMinutes =
                null;

            if (
                typeof phaseSleepDurationMinutes ===
                'function'
            ) {
                durationMinutes =
                    phaseSleepDurationMinutes(
                        session.bedtime,
                        end
                    );
            } else {
                const startTime =
                    new Date(
                        session.bedtime
                    ).getTime();

                const endTime =
                    new Date(
                        end
                    ).getTime();

                if (
                    Number.isFinite(
                        startTime
                    ) &&
                    Number.isFinite(
                        endTime
                    )
                ) {
                    durationMinutes =
                        Math.round(
                            (
                                endTime -
                                startTime
                            ) /
                            60000
                        );
                }
            }

            // Map roughly 4–10 hours to 0–1.
            const minimumMinutes =
                4 * 60;

            const maximumMinutes =
                10 * 60;

            const durationNorm =
                Number.isFinite(
                    durationMinutes
                )
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            (
                                durationMinutes -
                                minimumMinutes
                            ) /
                            (
                                maximumMinutes -
                                minimumMinutes
                            )
                        )
                    )
                    : 0;

            return {
                dateString:
                    bucket.dateString,

                label:
                    bucket.label,

                hasData:
                    true,

                durationMinutes,

                durationNorm,

                quality:
                    Number.isFinite(
                        Number(
                            session.sleep_quality
                        )
                    )
                        ? Number(
                            session.sleep_quality
                        )
                        : null,

                rested:
                    Number.isFinite(
                        Number(
                            session.rested_rating
                        )
                    )
                        ? Number(
                            session.rested_rating
                        )
                        : null,

                isOpen:
                    !session.wake_time,

                session
            };
        }
    );
}


// ==========================================
// ACTIVE DASHBOARD STATE
// ==========================================

let activeWavelengthSignals =
    new Set([
        'mood',
        'listening',
        'medication',
        'sleep'
    ]);

let cachedWavelengthData =
    null;

let currentWavelengthRange =
    7;


// ==========================================
// MAIN DASHBOARD UPDATE
// ==========================================

async function updateAnalytics() {
    const buckets =
        getRangeDateBuckets(
            currentWavelengthRange
        );

    const insightData =
        await phaseLoadInsightData(
            currentWavelengthRange
        );

    const moodEntries =
        insightData.moods || [];

    const medLogs =
        insightData.meds || [];

    const spotifyItems =
        insightData.plays || [];

    let sleepSessions = [];

    if (
        typeof phaseLoadSleepSessions ===
        'function'
    ) {
        try {
            sleepSessions =
                await phaseLoadSleepSessions(
                    currentWavelengthRange + 1
                );
        } catch (error) {
            console.warn(
                'Sleep data could not be loaded for the dashboard:',
                error
            );
        }
    }

    cachedWavelengthData = {
        mood:
            moodEntries,

        medication:
            medLogs,

        spotify:
            spotifyItems,

        sleep:
            sleepSessions,

        buckets
    };

    await updateTodayCardStatuses(
        medLogs,
        spotifyItems,
        sleepSessions
    );

    renderPhaseWavelength();

    // ======================================
    // PHASE NOTICED
    // ======================================

    const insightElement =
        document.getElementById(
            'weeklyInsightText'
        );

    if (!insightElement) {
        return;
    }

    const moodDays =
        new Set(
            moodEntries
                .filter(
                    entry =>
                        entry.date_time
                )
                .map(
                    entry =>
                        phaseLocalDateKey(
                            entry.date_time
                        )
                )
        );

    const listeningDays =
        new Set(
            spotifyItems
                .filter(
                    item =>
                        item.played_at
                )
                .map(
                    item =>
                        phaseLocalDateKey(
                            item.played_at
                        )
                )
        );

    const sleepDays =
        new Set(
            sleepSessions
                .filter(
                    session =>
                        session.wake_time
                )
                .map(
                    session =>
                        phaseLocalDateKey(
                            session.wake_time
                        )
                )
        );

    if (
        moodDays.size === 0 &&
        listeningDays.size === 0 &&
        sleepDays.size === 0 &&
        medLogs.length === 0
    ) {
        insightElement.textContent =
            'Keep recording your signals to reveal meaningful patterns.';

        return;
    }

    if (
        typeof phaseBuildInsightModel ===
            'function' &&
        typeof phaseCorrelationCopy ===
            'function'
    ) {
        try {
            const insightModel =
                phaseBuildInsightModel(
                    insightData,
                    currentWavelengthRange
                );

            const musicMoodInsight =
                phaseCorrelationCopy(
                    insightModel
                );

            if (
                insightModel.overlap
                    ?.length >= 5
            ) {
                insightElement.textContent =
                    musicMoodInsight.text;

                return;
            }
        } catch (error) {
            console.warn(
                'Dashboard pattern insight could not be calculated:',
                error
            );
        }
    }

    const completedSleep =
        sleepSessions.filter(
            session =>
                session.wake_time
        );

    if (
        completedSleep.length >= 2
    ) {
        const durations =
            completedSleep
                .map(session => {
                    if (
                        typeof phaseSleepDurationMinutes !==
                        'function'
                    ) {
                        return null;
                    }

                    return phaseSleepDurationMinutes(
                        session.bedtime,
                        session.wake_time
                    );
                })
                .filter(
                    Number.isFinite
                );

        if (durations.length) {
            const averageMinutes =
                durations.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                durations.length;

            const formatted =
                typeof phaseSleepFormatDuration ===
                    'function'
                    ? phaseSleepFormatDuration(
                        averageMinutes
                    )
                    : `${Math.round(
                        averageMinutes / 60
                    )}h`;

            insightElement.textContent =
                `Your average recorded sleep window is ${formatted} across ${durations.length} recent night${durations.length === 1 ? '' : 's'}.`;

            return;
        }
    }

    if (
        moodDays.size >= 3
    ) {
        insightElement.textContent =
            `Phase has ${moodDays.size} days with mood observations in this range. More overlapping signals will make pattern detection stronger.`;

        return;
    }

    if (
        spotifyItems.length
    ) {
        insightElement.textContent =
            `${spotifyItems.length} listening events are saved in this range. Keep checking in so Phase can compare listening with mood and sleep.`;

        return;
    }

    insightElement.textContent =
        'Your signals are starting to build a timeline. More overlapping observations will reveal stronger patterns.';
}
// ==========================================
// TODAY STATUS CARD
// ==========================================

async function updateTodayCardStatuses(
    medLogs,
    spotifyItems,
    sleepSessions
) {
    const todayString =
        phaseLocalDateKey();


    // ======================================
    // MEDICATION
    // ======================================

    const todayMeds =
        (medLogs || [])
            .filter(
                log =>
                    log.timestamp &&
                    phaseLocalDateKey(
                        log.timestamp
                    ) ===
                    todayString
            );

    const morningTaken =
        todayMeds.some(
            log =>
                String(
                    log.time_of_day || ''
                )
                    .toLowerCase()
                    .includes(
                        'morning'
                    )
        );

    const eveningTaken =
        todayMeds.some(
            log =>
                String(
                    log.time_of_day || ''
                )
                    .toLowerCase()
                    .includes(
                        'evening'
                    )
        );

    const medicationStatus =
        document.getElementById(
            'medicationStatus'
        );

    if (medicationStatus) {
        medicationStatus.textContent =
            `Morning ${morningTaken ? '✓' : '○'} · Evening ${eveningTaken ? '✓' : '○'}`;
    }


    // ======================================
    // LISTENING
    // ======================================

    const todayListening =
        (spotifyItems || [])
            .filter(
                item =>
                    item.played_at &&
                    phaseLocalDateKey(
                        item.played_at
                    ) ===
                    todayString
            );

    const listeningStatus =
        document.getElementById(
            'listeningStatus'
        );

    if (listeningStatus) {
        if (todayListening.length) {
            listeningStatus.textContent =
                `${todayListening.length} track${todayListening.length === 1 ? '' : 's'} logged today`;
        } else {
            listeningStatus.textContent =
                'No listening saved today';
        }
    }


    // ======================================
    // SLEEP
    // ======================================

    const sleepStatus =
        document.getElementById(
            'sleepStatus'
        );

    const sleepAction =
        document.getElementById(
            'sleepAction'
        );

    let openSession =
        (sleepSessions || [])
            .find(
                session =>
                    !session.wake_time
            ) || null;


    if (
        !openSession &&
        typeof phaseGetOpenSleepSession ===
            'function'
    ) {
        try {
            openSession =
                await phaseGetOpenSleepSession();
        } catch (error) {
            console.warn(
                'Could not check open sleep session:',
                error
            );
        }
    }


    if (sleepStatus) {
        if (openSession) {
            const durationMinutes =
                typeof phaseSleepDurationMinutes ===
                    'function'
                    ? phaseSleepDurationMinutes(
                        openSession.bedtime,
                        new Date()
                    )
                    : null;

            const durationText =
                Number.isFinite(
                    durationMinutes
                )
                    ? (
                        typeof phaseSleepFormatDuration ===
                            'function'
                            ? phaseSleepFormatDuration(
                                durationMinutes
                            )
                            : `${Math.round(
                                durationMinutes /
                                60
                            )}h`
                    )
                    : '';

            sleepStatus.textContent =
                durationText
                    ? `Sleep window open · ${durationText}`
                    : 'Sleep window open';
        } else {
            const latestCompleted =
                (sleepSessions || [])
                    .filter(
                        session =>
                            session.wake_time
                    )
                    .sort(
                        (a, b) =>
                            new Date(
                                b.wake_time
                            ) -
                            new Date(
                                a.wake_time
                            )
                    )[0];

            if (
                latestCompleted &&
                phaseLocalDateKey(
                    latestCompleted.wake_time
                ) ===
                todayString
            ) {
                const durationMinutes =
                    typeof phaseSleepDurationMinutes ===
                        'function'
                        ? phaseSleepDurationMinutes(
                            latestCompleted.bedtime,
                            latestCompleted.wake_time
                        )
                        : null;

                const durationText =
                    Number.isFinite(
                        durationMinutes
                    )
                        ? (
                            typeof phaseSleepFormatDuration ===
                                'function'
                                ? phaseSleepFormatDuration(
                                    durationMinutes
                                )
                                : `${Math.round(
                                    durationMinutes /
                                    60
                                )}h`
                        )
                        : '';

                sleepStatus.textContent =
                    durationText
                        ? `Last sleep window · ${durationText}`
                        : 'Sleep logged today';
            } else {
                sleepStatus.textContent =
                    'Ready for your next sleep window';
            }
        }
    }


    if (sleepAction) {
        sleepAction.textContent =
            openSession
                ? 'Wake →'
                : 'Open →';
    }


    // ======================================
    // DASHBOARD LISTENING CARD
    // ======================================

    if (
        typeof updateDashboardListeningCard ===
            'function'
    ) {
        try {
            await updateDashboardListeningCard();
        } catch (error) {
            console.warn(
                'Dashboard listening card could not update:',
                error
            );
        }
    }
}


// ==========================================
// SPOTIFY DASHBOARD CARD
// ==========================================

async function updateDashboardListeningCard() {
    const title =
        document.getElementById(
            'dashboardListeningTitle'
        );

    const artist =
        document.getElementById(
            'dashboardListeningArtist'
        );

    const label =
        document.getElementById(
            'dashboardListeningLabel'
        );

    const albumArt =
        document.getElementById(
            'dashboardAlbumArt'
        );

    const vibeSubtitle =
        document.getElementById(
            'spotifyVibeSubtitle'
        );

    const connectButton =
        document.getElementById(
            'connectSpotifyBtn'
        );


    if (
        !title ||
        !artist
    ) {
        return;
    }


    const connected =
        typeof isSpotifyConnected ===
            'function'
            ? isSpotifyConnected()
            : false;


    if (!connected) {
        if (label) {
            label.textContent =
                'LISTENING';
        }

        title.textContent =
            'Connect Spotify';

        artist.textContent =
            'Add listening as a Phase signal';

        if (vibeSubtitle) {
            vibeSubtitle.textContent =
                'Connect Spotify to compare listening with mood, sleep, and medication.';
        }

        if (albumArt) {
            albumArt.innerHTML =
                '<span class="album-placeholder-icon">♪</span>';
        }

        if (connectButton) {
            connectButton.style.display =
                '';
        }

        updateAudioPulseUI(
            'Quiet',
            0
        );

        return;
    }


    if (connectButton) {
        connectButton.style.display =
            'none';
    }


    let current =
        null;


    if (
        typeof fetchCurrentlyPlayingTrack ===
            'function'
    ) {
        try {
            current =
                await fetchCurrentlyPlayingTrack();
        } catch (error) {
            console.warn(
                'Currently playing track unavailable:',
                error
            );
        }
    }


    const currentTrack =
        current?.item || null;


    if (currentTrack) {
        if (label) {
            label.textContent =
                current.is_playing
                    ? 'PLAYING NOW'
                    : 'LAST ACTIVE';
        }

        title.textContent =
            currentTrack.name ||
            'Unknown track';

        artist.textContent =
            currentTrack.artists
                ?.map(
                    item =>
                        item.name
                )
                .join(
                    ', '
                ) ||
            'Unknown artist';


        const artwork =
            currentTrack.album
                ?.images?.[0]?.url;


        if (
            albumArt &&
            artwork
        ) {
            albumArt.innerHTML =
                `<img src="${artwork}" alt="">`;
        }


        if (vibeSubtitle) {
            vibeSubtitle.textContent =
                current.is_playing
                    ? 'Your listening signal is active.'
                    : 'Your recent listening is part of the current Phase.';
        }


        const pulse =
            current.is_playing
                ? 0.86
                : 0.42;

        updateAudioPulseUI(
            current.is_playing
                ? 'High'
                : 'Low',
            pulse
        );

        return;
    }


    let recent =
        [];


    if (
        typeof fetchRecentlyPlayedTracks ===
            'function'
    ) {
        try {
            recent =
                await fetchRecentlyPlayedTracks();
        } catch (error) {
            console.warn(
                'Recent listening unavailable:',
                error
            );
        }
    }


    const latest =
        recent?.[0]?.track;


    if (latest) {
        if (label) {
            label.textContent =
                'RECENTLY PLAYED';
        }

        title.textContent =
            latest.name ||
            'Unknown track';

        artist.textContent =
            latest.artists
                ?.map(
                    item =>
                        item.name
                )
                .join(
                    ', '
                ) ||
            'Unknown artist';


        const artwork =
            latest.album
                ?.images?.[0]?.url;


        if (
            albumArt &&
            artwork
        ) {
            albumArt.innerHTML =
                `<img src="${artwork}" alt="">`;
        }


        if (vibeSubtitle) {
            vibeSubtitle.textContent =
                'Recent listening is contributing to your Phase.';
        }


        updateAudioPulseUI(
            'Low',
            0.36
        );

        return;
    }


    if (label) {
        label.textContent =
            'LISTENING';
    }

    title.textContent =
        'Spotify connected';

    artist.textContent =
        'Waiting for listening activity';

    if (vibeSubtitle) {
        vibeSubtitle.textContent =
            'Your listening signal will appear here when activity is available.';
    }

    if (albumArt) {
        albumArt.innerHTML =
            '<span class="album-placeholder-icon">♪</span>';
    }

    updateAudioPulseUI(
        'Quiet',
        0.15
    );
}


// ==========================================
// AUDIO PULSE UI
// ==========================================

function updateAudioPulseUI(
    label,
    level
) {
    const levelText =
        document.getElementById(
            'audioPulseLevel'
        );

    const dots =
        document.getElementById(
            'audioPulseDots'
        );

    const waveform =
        document.getElementById(
            'audioWaveformVisualizer'
        );


    if (levelText) {
        levelText.textContent =
            label;
    }


    if (dots) {
        const dotElements =
            dots.querySelectorAll(
                '.pulse-dot'
            );

        const activeCount =
            Math.max(
                0,
                Math.min(
                    dotElements.length,
                    Math.round(
                        level *
                        dotElements.length
                    )
                )
            );

        dotElements.forEach(
            (dot, index) => {
                dot.classList.toggle(
                    'active',
                    index <
                    activeCount
                );
            }
        );
    }


    if (waveform) {
        const bars =
            waveform.querySelectorAll(
                '.bar'
            );

        bars.forEach(
            (bar, index) => {
                const wave =
                    0.35 +
                    (
                        (
                            Math.sin(
                                index *
                                1.7
                            ) +
                            1
                        ) /
                        2
                    ) *
                    0.65;

                bar.style.transform =
                    `scaleY(${Math.max(
                        0.2,
                        wave * level
                    )})`;

                bar.style.opacity =
                    String(
                        Math.max(
                            0.25,
                            level
                        )
                    );
            }
        );
    }
}


// ==========================================
// SIGNAL TOGGLES
// ==========================================

function toggleWavelengthSignal(
    signal
) {
    if (
        ![
            'mood',
            'listening',
            'sleep',
            'medication'
        ].includes(
            signal
        )
    ) {
        return;
    }


    if (
        activeWavelengthSignals.has(
            signal
        )
    ) {
        // Keep at least one signal visible.
        if (
            activeWavelengthSignals.size ===
            1
        ) {
            return;
        }

        activeWavelengthSignals.delete(
            signal
        );
    } else {
        activeWavelengthSignals.add(
            signal
        );
    }


    document
        .querySelectorAll(
            '.signal-pill'
        )
        .forEach(
            button => {
                const buttonSignal =
                    button.dataset.signal;

                const active =
                    activeWavelengthSignals.has(
                        buttonSignal
                    );

                button.classList.toggle(
                    'active',
                    active
                );

                button.classList.toggle(
                    'inactive',
                    !active
                );
            }
        );


    renderPhaseWavelength();
}


// ==========================================
// RANGE SWITCHING
// ==========================================

async function setWavelengthRange(
    daysCount
) {
    const parsed =
        Number(
            daysCount
        );


    if (
        ![
            7,
            14,
            30,
            90
        ].includes(
            parsed
        )
    ) {
        return;
    }


    currentWavelengthRange =
        parsed;


    document
        .querySelectorAll(
            '[data-wavelength-range]'
        )
        .forEach(
            button => {
                button.classList.toggle(
                    'active',
                    Number(
                        button.dataset
                            .wavelengthRange
                    ) ===
                    parsed
                );
            }
        );


    await updateAnalytics();
}


// ==========================================
// SVG HELPERS
// ==========================================

function phaseWaveX(
    index,
    total,
    left,
    right
) {
    if (
        total <= 1
    ) {
        return (
            left +
            (
                right -
                left
            ) /
            2
        );
    }


    return (
        left +
        (
            index /
            (
                total -
                1
            )
        ) *
        (
            right -
            left
        )
    );
}


function phaseWaveSmoothPath(
    points
) {
    if (!points.length) {
        return '';
    }


    if (
        points.length === 1
    ) {
        return (
            `M ${points[0].x} ${points[0].y}`
        );
    }


    let path =
        `M ${points[0].x} ${points[0].y}`;


    for (
        let i = 0;
        i <
        points.length - 1;
        i++
    ) {
        const current =
            points[i];

        const next =
            points[i + 1];

        const midpointX =
            (
                current.x +
                next.x
            ) /
            2;


        path +=
            ` C ${midpointX} ${current.y}, ${midpointX} ${next.y}, ${next.x} ${next.y}`;
    }


    return path;
}


function phaseWaveAreaPath(
    points,
    bottom
) {
    if (
        !points.length
    ) {
        return '';
    }


    const linePath =
        phaseWaveSmoothPath(
            points
        );


    return (
        `${linePath} ` +
        `L ${points[points.length - 1].x} ${bottom} ` +
        `L ${points[0].x} ${bottom} Z`
    );
}


function phaseWaveClamp(
    value,
    minimum = 0,
    maximum = 1
) {
    return Math.max(
        minimum,
        Math.min(
            maximum,
            value
        )
    );
}


function phaseWaveMapY(
    value,
    top,
    bottom
) {
    const normalized =
        phaseWaveClamp(
            value
        );


    return (
        bottom -
        normalized *
        (
            bottom -
            top
        )
    );
}


function phaseWaveEscape(
    value
) {
    return String(
        value ?? ''
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );
}