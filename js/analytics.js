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
            //
            // This is visual normalization only.
            // The actual tooltip always displays
            // the real Sleep Window duration.
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
                    currentWavelengthRange +
                    1
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


    // Prefer the existing persistent insight
    // engine when enough data exists.
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


    // Before there is enough correlation data,
    // surface a useful descriptive observation.
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
                        averageMinutes /
                        60
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

    const hasMorning =
        todayMeds.some(
            log =>
                String(
                    log.time_of_day || ''
                )
                    .toLowerCase() ===
                'morning'
        );

    const hasBedtime =
        todayMeds.some(
            log =>
                String(
                    log.time_of_day || ''
                )
                    .toLowerCase() ===
                'bedtime'
        );

    const medElement =
        document.getElementById(
            'todayMedText'
        );

    if (medElement) {
        if (
            hasMorning &&
            hasBedtime
        ) {
            medElement.innerHTML =
                'Morning <span style="color:var(--signal-medication);font-weight:700;">✓</span> · Bedtime <span style="color:var(--signal-medication);font-weight:700;">✓</span>';

        } else if (hasMorning) {
            medElement.innerHTML =
                'Morning <span style="color:var(--signal-medication);font-weight:700;">✓</span> · Evening ○';

        } else if (hasBedtime) {
            medElement.innerHTML =
                'Morning ○ · Evening <span style="color:var(--signal-medication);font-weight:700;">✓</span>';

        } else if (
            todayMeds.length
        ) {
            medElement.innerHTML =
                `${todayMeds.length} dose${todayMeds.length === 1 ? '' : 's'} logged today <span style="color:var(--signal-medication);font-weight:700;">✓</span>`;

        } else {
            medElement.textContent =
                'Not logged today';
        }
    }


    // ======================================
    // LISTENING
    // ======================================

    const audioElement =
        document.getElementById(
            'spotifyVibeSubtitle'
        );

    const connectButton =
        document.getElementById(
            'connectSpotifyBtn'
        );

    const connected =
        !!localStorage.getItem(
            'spotify_access_token'
        );

    if (audioElement) {
        if (connected) {
            const todayTracks =
                (spotifyItems || [])
                    .filter(
                        item =>
                            item.played_at &&
                            phaseLocalDateKey(
                                item.played_at
                            ) ===
                            todayString
                    );

            audioElement.textContent =
                todayTracks.length
                    ? `${todayTracks.length} track${todayTracks.length === 1 ? '' : 's'} logged today`
                    : 'Connected & active';

            if (connectButton) {
                connectButton.textContent =
                    'Active';

                connectButton.style.color =
                    'var(--signal-listening-hover)';
            }

        } else {
            audioElement.textContent =
                'Spotify not connected';

            if (connectButton) {
                connectButton.textContent =
                    'Connect';
            }
        }
    }


    // ======================================
    // SLEEP
    // ======================================

    const sleepElement =
        document.getElementById(
            'todaySleepText'
        );

    if (!sleepElement) {
        return;
    }


    const openSession =
        (sleepSessions || [])
            .find(
                session =>
                    !session.wake_time
            );


    if (openSession) {
        const minutes =
            typeof phaseSleepDurationMinutes ===
                'function'
                ? phaseSleepDurationMinutes(
                    openSession.bedtime,
                    new Date()
                )
                : null;

        const duration =
            typeof phaseSleepFormatDuration ===
                'function' &&
            Number.isFinite(minutes)
                ? phaseSleepFormatDuration(
                    minutes
                )
                : '';

        sleepElement.textContent =
            duration
                ? `Sleep window open · ${duration}`
                : 'Sleep window in progress';

        return;
    }


    const completedToday =
        (sleepSessions || [])
            .filter(
                session =>
                    session.wake_time &&
                    phaseLocalDateKey(
                        session.wake_time
                    ) ===
                    todayString
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


    if (completedToday) {
        const minutes =
            typeof phaseSleepDurationMinutes ===
                'function'
                ? phaseSleepDurationMinutes(
                    completedToday.bedtime,
                    completedToday.wake_time
                )
                : null;

        const duration =
            typeof phaseSleepFormatDuration ===
                'function' &&
            Number.isFinite(minutes)
                ? phaseSleepFormatDuration(
                    minutes
                )
                : 'Saved';

        const quality =
            completedToday.sleep_quality
                ? ` · Quality ${completedToday.sleep_quality}/5`
                : '';

        sleepElement.textContent =
            `${duration}${quality}`;

        return;
    }


    sleepElement.textContent =
        'Ready for your next sleep window';
}


// ==========================================
// RANGE CONTROLS
// ==========================================

function setWavelengthRange(
    days,
    buttonElement
) {
    currentWavelengthRange =
        Number(days) || 7;

    document
        .querySelectorAll(
            '.range-btn'
        )
        .forEach(
            button =>
                button.classList.remove(
                    'active'
                )
        );

    if (buttonElement) {
        buttonElement.classList.add(
            'active'
        );
    }

    updateAnalytics();
}


// ==========================================
// SIGNAL TOGGLES
// ==========================================

function toggleWavelengthSignal(
    signalName
) {
    const validSignals =
        new Set([
            'mood',
            'listening',
            'medication',
            'sleep'
        ]);

    if (
        !validSignals.has(
            signalName
        )
    ) {
        return;
    }


    if (
        activeWavelengthSignals.has(
            signalName
        )
    ) {
        // Never allow every signal to be
        // hidden at once.
        if (
            activeWavelengthSignals
                .size > 1
        ) {
            activeWavelengthSignals
                .delete(
                    signalName
                );
        }

    } else {
        activeWavelengthSignals
            .add(
                signalName
            );
    }


    const buttonMap = {
        mood:
            'btnSignalMood',

        listening:
            'btnSignalListening',

        medication:
            'btnSignalMedication',

        sleep:
            'btnSignalSleep'
    };


    Object.entries(
        buttonMap
    ).forEach(
        ([signal, buttonId]) => {
            const button =
                document.getElementById(
                    buttonId
                );

            if (!button) {
                return;
            }

            button.className =
                activeWavelengthSignals
                    .has(signal)
                    ? 'signal-pill active'
                    : 'signal-pill inactive';
        }
    );


    renderPhaseWavelength();
}


// ==========================================
// SVG HELPERS
// ==========================================

function phaseCreateSvgElement(
    tag,
    attributes = {}
) {
    const element =
        document.createElementNS(
            'http://www.w3.org/2000/svg',
            tag
        );

    Object.entries(
        attributes
    ).forEach(
        ([key, value]) => {
            element.setAttribute(
                key,
                value
            );
        }
    );

    return element;
}


function phaseBuildSmoothPath(
    points
) {
    if (!points.length) {
        return '';
    }

    let path =
        `M ${points[0].x},${points[0].y}`;

    for (
        let i = 0;
        i < points.length - 1;
        i++
    ) {
        const current =
            points[i];

        const next =
            points[i + 1];

        const controlX =
            (
                current.x +
                next.x
            ) / 2;

        path +=
            ` C ${controlX},${current.y} ${controlX},${next.y} ${next.x},${next.y}`;
    }

    return path;
}


// ==========================================
// MAIN PHASE WAVELENGTH RENDER
// ==========================================

function renderPhaseWavelength() {
    if (!cachedWavelengthData) {
        return;
    }


    const gridGroup =
        document.getElementById(
            'wavelengthGridGroup'
        );

    const pathsGroup =
        document.getElementById(
            'wavelengthPathsGroup'
        );

    const eventsGroup =
        document.getElementById(
            'wavelengthEventsGroup'
        );

    const labelsContainer =
        document.getElementById(
            'dynamicChartLabels'
        );

    const tooltip =
        document.getElementById(
            'chartTooltip'
        );

    const crosshair =
        document.getElementById(
            'wavelengthCrosshair'
        );

    const svg =
        document.querySelector(
            '.wavelength-svg'
        );


    if (
        !gridGroup ||
        !pathsGroup ||
        !eventsGroup ||
        !labelsContainer ||
        !svg
    ) {
        return;
    }


    const canvasWidth =
        780;

    const canvasHeight =
        220;

    const horizontalPadding =
        32;


    svg.setAttribute(
        'viewBox',
        `0 0 ${canvasWidth} ${canvasHeight}`
    );

    svg.setAttribute(
        'preserveAspectRatio',
        'xMidYMid meet'
    );


    gridGroup.innerHTML =
        '';

    pathsGroup.innerHTML =
        '';

    eventsGroup.innerHTML =
        '';


    const {
        buckets,
        mood,
        spotify,
        medication,
        sleep
    } =
        cachedWavelengthData;


    if (
        !buckets ||
        buckets.length < 2
    ) {
        return;
    }


    // ======================================
    // X POSITIONS / LABELS
    // ======================================

    const xPositions =
        buckets.map(
            (_, index) =>
                horizontalPadding +
                (
                    index /
                    (
                        buckets.length -
                        1
                    )
                ) *
                (
                    canvasWidth -
                    horizontalPadding *
                    2
                )
        );


    const labelStep =
        currentWavelengthRange > 14
            ? Math.ceil(
                currentWavelengthRange /
                7
            )
            : 1;


    labelsContainer.innerHTML =
        buckets.map(
            (bucket, index) => {
                if (
                    index %
                        labelStep ===
                        0 ||
                    index ===
                        buckets.length -
                            1
                ) {
                    return `<span>${bucket.label}</span>`;
                }

                return '<span></span>';
            }
        ).join('');


    // ======================================
    // SIGNAL DATA
    // ======================================

    const moodData =
        normalizeMoodData(
            mood,
            buckets
        );

    const listeningData =
        normalizeListeningData(
            spotify,
            buckets
        );

    const medicationData =
        mapMedicationEvents(
            medication,
            buckets
        );

    const sleepData =
        normalizeSleepData(
            sleep,
            buckets
        );


    // ======================================
    // LANE CONFIGURATION
    // ======================================

    const lanes = {
        mood: {
            baseline: 48,
            amplitude: 33,
            label: 'MOOD',
            color: '#91B956'
        },

        listening: {
            baseline: 101,
            amplitude: 38,
            label: 'LISTENING',
            color: '#B48BE4'
        },

        medication: {
            baseline: 145,
            amplitude: 18,
            label: 'MEDICATION',
            color: '#E1A53B'
        },

        sleep: {
            baseline: 197,
            amplitude: 34,
            label: 'SLEEP WINDOW',
            color: '#5AAFC3'
        }
    };


    // ======================================
    // GRID / SIGNAL LABELS
    // ======================================

    Object.entries(
        lanes
    ).forEach(
        ([signal, lane]) => {
            if (
                !activeWavelengthSignals
                    .has(signal)
            ) {
                return;
            }

            const baseline =
                phaseCreateSvgElement(
                    'line',
                    {
                        x1: 12,
                        y1:
                            lane.baseline,

                        x2:
                            canvasWidth -
                            12,

                        y2:
                            lane.baseline,

                        stroke:
                            'rgba(255,255,255,0.075)',

                        'stroke-width':
                            '1',

                        'stroke-dasharray':
                            '3 5'
                    }
                );

            gridGroup.appendChild(
                baseline
            );


            const label =
                phaseCreateSvgElement(
                    'text',
                    {
                        x: 12,

                        y:
                            lane.baseline -
                            lane.amplitude -
                            6,

                        fill:
                            lane.color,

                        'fill-opacity':
                            '0.82',

                        'font-size':
                            '8.5',

                        'font-weight':
                            '700',

                        'letter-spacing':
                            '0.8px'
                    }
                );

            label.textContent =
                lane.label;

            gridGroup.appendChild(
                label
            );
        }
    );


    // ======================================
    // MOOD
    // ======================================

    if (
        activeWavelengthSignals.has(
            'mood'
        )
    ) {
        const lane =
            lanes.mood;

        const points =
            moodData.map(
                (item, index) => ({
                    x:
                        xPositions[
                            index
                        ],

                    y:
                        lane.baseline -
                        item.val *
                        lane.amplitude
                })
            );

        const pathData =
            phaseBuildSmoothPath(
                points
            );


        const area =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        `${pathData} L ${points[points.length - 1].x},${lane.baseline} L ${points[0].x},${lane.baseline} Z`,

                    fill:
                        'url(#moodWaveGradient)',

                    opacity:
                        '0.95'
                }
            );

        pathsGroup.appendChild(
            area
        );


        const path =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        pathData,

                    fill:
                        'none',

                    stroke:
                        lane.color,

                    'stroke-width':
                        '4',

                    'stroke-linecap':
                        'round',

                    'stroke-linejoin':
                        'round'
                }
            );

        pathsGroup.appendChild(
            path
        );


        points.forEach(
            (point, index) => {
                if (
                    !moodData[index]
                        .hasData
                ) {
                    return;
                }

                const glow =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx:
                                point.x,

                            cy:
                                point.y,

                            r: '8',

                            fill:
                                lane.color,

                            opacity:
                                '0.12'
                        }
                    );

                const marker =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx:
                                point.x,

                            cy:
                                point.y,

                            r: '4.5',

                            fill:
                                lane.color,

                            stroke:
                                '#F1EFE7',

                            'stroke-width':
                                '1.2'
                        }
                    );

                eventsGroup.appendChild(
                    glow
                );

                eventsGroup.appendChild(
                    marker
                );
            }
        );
    }


    // ======================================
    // LISTENING
    // ======================================

    if (
        activeWavelengthSignals.has(
            'listening'
        )
    ) {
        const lane =
            lanes.listening;

        const points =
            listeningData.map(
                (item, index) => ({
                    x:
                        xPositions[
                            index
                        ],

                    y:
                        lane.baseline -
                        item.norm *
                        lane.amplitude
                })
            );

        const pathData =
            phaseBuildSmoothPath(
                points
            );


        const area =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        `${pathData} L ${points[points.length - 1].x},${lane.baseline} L ${points[0].x},${lane.baseline} Z`,

                    fill:
                        'url(#listeningWaveGradient)',

                    opacity:
                        '1'
                }
            );

        pathsGroup.appendChild(
            area
        );


        const shadow =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        pathData,

                    fill:
                        'none',

                    stroke:
                        lane.color,

                    'stroke-width':
                        '9',

                    'stroke-linecap':
                        'round',

                    opacity:
                        '0.10'
                }
            );

        pathsGroup.appendChild(
            shadow
        );


        const path =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        pathData,

                    fill:
                        'none',

                    stroke:
                        lane.color,

                    'stroke-width':
                        '4.5',

                    'stroke-linecap':
                        'round',

                    'stroke-linejoin':
                        'round'
                }
            );

        pathsGroup.appendChild(
            path
        );


        listeningData.forEach(
            (item, index) => {
                if (!item.count) {
                    return;
                }

                const marker =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx:
                                xPositions[
                                    index
                                ],

                            cy:
                                points[
                                    index
                                ].y,

                            r:
                                Math.min(
                                    6,
                                    3 +
                                    item.norm *
                                    3
                                ),

                            fill:
                                lane.color,

                            opacity:
                                '0.95'
                        }
                    );

                eventsGroup.appendChild(
                    marker
                );
            }
        );
    }


    // ======================================
    // MEDICATION
    // ======================================

    if (
        activeWavelengthSignals.has(
            'medication'
        )
    ) {
        const lane =
            lanes.medication;

        medicationData.forEach(
            (item, index) => {
                const x =
                    xPositions[
                        index
                    ];

                if (!item.count) {
                    const empty =
                        phaseCreateSvgElement(
                            'circle',
                            {
                                cx: x,

                                cy:
                                    lane.baseline,

                                r: '2.5',

                                fill:
                                    'var(--phase-graph-surface)',

                                stroke:
                                    lane.color,

                                'stroke-width':
                                    '1',

                                opacity:
                                    '0.28'
                            }
                        );

                    eventsGroup.appendChild(
                        empty
                    );

                    return;
                }


                const pulseHeight =
                    Math.min(
                        28,
                        12 +
                        item.count *
                        5
                    );


                const glow =
                    phaseCreateSvgElement(
                        'line',
                        {
                            x1: x,

                            x2: x,

                            y1:
                                lane.baseline,

                            y2:
                                lane.baseline -
                                pulseHeight,

                            stroke:
                                lane.color,

                            'stroke-width':
                                '8',

                            'stroke-linecap':
                                'round',

                            opacity:
                                '0.12'
                        }
                    );


                const pulse =
                    phaseCreateSvgElement(
                        'line',
                        {
                            x1: x,

                            x2: x,

                            y1:
                                lane.baseline,

                            y2:
                                lane.baseline -
                                pulseHeight,

                            stroke:
                                lane.color,

                            'stroke-width':
                                '3.5',

                            'stroke-linecap':
                                'round'
                        }
                    );


                const marker =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx: x,

                            cy:
                                lane.baseline -
                                pulseHeight,

                            r: '4.5',

                            fill:
                                lane.color,

                            stroke:
                                '#F1EFE7',

                            'stroke-width':
                                '1'
                        }
                    );


                eventsGroup.appendChild(
                    glow
                );

                eventsGroup.appendChild(
                    pulse
                );

                eventsGroup.appendChild(
                    marker
                );
            }
        );
    }


    // ======================================
    // SLEEP WINDOW
    // ======================================

    if (
        activeWavelengthSignals.has(
            'sleep'
        )
    ) {
        const lane =
            lanes.sleep;

        const points =
            sleepData.map(
                (item, index) => ({
                    x:
                        xPositions[
                            index
                        ],

                    y:
                        item.hasData
                            ? lane.baseline -
                              (
                                  0.20 +
                                  item.durationNorm *
                                  0.80
                              ) *
                              lane.amplitude
                            : lane.baseline
                })
            );


        const pathData =
            phaseBuildSmoothPath(
                points
            );


        const area =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        `${pathData} L ${points[points.length - 1].x},${lane.baseline} L ${points[0].x},${lane.baseline} Z`,

                    fill:
                        'url(#sleepWaveGradient)',

                    opacity:
                        '0.90'
                }
            );

        pathsGroup.appendChild(
            area
        );


        const path =
            phaseCreateSvgElement(
                'path',
                {
                    d:
                        pathData,

                    fill:
                        'none',

                    stroke:
                        lane.color,

                    'stroke-width':
                        '4',

                    'stroke-linecap':
                        'round',

                    'stroke-linejoin':
                        'round',

                    opacity:
                        sleepData.some(
                            item =>
                                item.hasData
                        )
                            ? '1'
                            : '0.22'
                }
            );

        pathsGroup.appendChild(
            path
        );


        sleepData.forEach(
            (item, index) => {
                if (!item.hasData) {
                    return;
                }

                const point =
                    points[
                        index
                    ];


                const glow =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx:
                                point.x,

                            cy:
                                point.y,

                            r: '9',

                            fill:
                                lane.color,

                            opacity:
                                item.isOpen
                                    ? '0.24'
                                    : '0.12'
                        }
                    );


                const marker =
                    phaseCreateSvgElement(
                        'circle',
                        {
                            cx:
                                point.x,

                            cy:
                                point.y,

                            r:
                                item.isOpen
                                    ? '5.5'
                                    : '4.5',

                            fill:
                                lane.color,

                            stroke:
                                '#F1EFE7',

                            'stroke-width':
                                '1.2'
                        }
                    );


                eventsGroup.appendChild(
                    glow
                );

                eventsGroup.appendChild(
                    marker
                );
            }
        );
    }


    // ======================================
    // SHARED TOOLTIP
    // ======================================

    svg.onmousemove =
        event => {
            const rect =
                svg.getBoundingClientRect();

            const mouseX =
                (
                    (
                        event.clientX -
                        rect.left
                    ) /
                    rect.width
                ) *
                canvasWidth;


            let closestIndex =
                0;

            let smallestDistance =
                Infinity;


            xPositions.forEach(
                (position, index) => {
                    const distance =
                        Math.abs(
                            position -
                            mouseX
                        );

                    if (
                        distance <
                        smallestDistance
                    ) {
                        smallestDistance =
                            distance;

                        closestIndex =
                            index;
                    }
                }
            );


            const matchX =
                xPositions[
                    closestIndex
                ];


            if (crosshair) {
                crosshair.style.display =
                    'block';

                crosshair.setAttribute(
                    'x1',
                    matchX
                );

                crosshair.setAttribute(
                    'x2',
                    matchX
                );

                crosshair.setAttribute(
                    'y1',
                    '8'
                );

                crosshair.setAttribute(
                    'y2',
                    '212'
                );
            }


            if (!tooltip) {
                return;
            }


            const bucket =
                buckets[
                    closestIndex
                ];

            const moodPoint =
                moodData[
                    closestIndex
                ];

            const listeningPoint =
                listeningData[
                    closestIndex
                ];

            const medPoint =
                medicationData[
                    closestIndex
                ];

            const sleepPoint =
                sleepData[
                    closestIndex
                ];


            const moodValue =
                (
                    moodPoint.val *
                    5
                ).toFixed(1);


            let sleepValue =
                'No window recorded';

            if (
                sleepPoint.hasData
            ) {
                const duration =
                    typeof phaseSleepFormatDuration ===
                        'function' &&
                    Number.isFinite(
                        sleepPoint.durationMinutes
                    )
                        ? phaseSleepFormatDuration(
                            sleepPoint.durationMinutes
                        )
                        : 'Recorded';

                const quality =
                    sleepPoint.quality
                        ? ` · ${sleepPoint.quality}/5 quality`
                        : '';

                sleepValue =
                    sleepPoint.isOpen
                        ? `${duration} · in progress`
                        : `${duration}${quality}`;
            }


            tooltip.style.display =
                'block';

            tooltip.style.left =
                `${(
                    matchX /
                    canvasWidth
                ) * 100}%`;

            tooltip.style.top =
                '34px';


            tooltip.innerHTML = `
                <div class="tooltip-date">
                    ${bucket.dateString}
                </div>

                ${
                    activeWavelengthSignals.has('mood')
                        ? `
                            <div class="tooltip-row">
                                <span style="color:#91B956;">●</span>
                                Mood: ${moodValue}/5
                                ${
                                    moodPoint.hasData
                                        ? ''
                                        : ' (carried forward)'
                                }
                            </div>
                        `
                        : ''
                }

                ${
                    activeWavelengthSignals.has('listening')
                        ? `
                            <div class="tooltip-row">
                                <span style="color:#B48BE4;">●</span>
                                Listening: ${listeningPoint.count} track${listeningPoint.count === 1 ? '' : 's'}
                            </div>
                        `
                        : ''
                }

                ${
                    activeWavelengthSignals.has('medication')
                        ? `
                            <div class="tooltip-row">
                                <span style="color:#E1A53B;">●</span>
                                Medication: ${
                                    medPoint.count
                                        ? medPoint.doses
                                            .map(
                                                dose =>
                                                    phaseEscapeHtml(
                                                        dose
                                                    )
                                            )
                                            .join(', ')
                                        : 'None logged'
                                }
                            </div>
                        `
                        : ''
                }

                ${
                    activeWavelengthSignals.has('sleep')
                        ? `
                            <div class="tooltip-row">
                                <span style="color:#5AAFC3;">●</span>
                                Sleep Window: ${sleepValue}
                            </div>
                        `
                        : ''
                }
            `;
        };


    svg.onmouseleave =
        () => {
            if (crosshair) {
                crosshair.style.display =
                    'none';
            }

            if (tooltip) {
                tooltip.style.display =
                    'none';
            }
        };
}