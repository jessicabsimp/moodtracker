// ==========================================
// PHASE PERSISTENT INSIGHTS ENGINE
// ==========================================
//
// Core signals:
// - Mood
// - Listening
// - Medication
// - Sleep
//
// Music-specific analytics remain here as
// part of Phase's deeper listening layer.
//
// All relationships are observational.
// ==========================================


const PHASE_MOOD_SCORES = {
    terrible: 1,
    bad: 2,
    okay: 3,
    good: 4,
    great: 5
};


// ==========================================
// BASIC HELPERS
// ==========================================

function phaseInsightMean(values) {
    const valid =
        values.filter(
            Number.isFinite
        );

    return valid.length
        ? valid.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / valid.length
        : null;
}


function phaseInsightDateKey(value) {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        );

    return `${year}-${month}-${day}`;
}


function phaseInsightEscape(value) {
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


function phaseInsightPearson(pairs) {
    if (
        pairs.length < 2
    ) {
        return null;
    }


    const meanX =
        phaseInsightMean(
            pairs.map(
                pair =>
                    pair.x
            )
        );

    const meanY =
        phaseInsightMean(
            pairs.map(
                pair =>
                    pair.y
            )
        );


    let numerator =
        0;

    let xSquared =
        0;

    let ySquared =
        0;


    pairs.forEach(
        pair => {
            const x =
                pair.x -
                meanX;

            const y =
                pair.y -
                meanY;

            numerator +=
                x * y;

            xSquared +=
                x * x;

            ySquared +=
                y * y;
        }
    );


    const denominator =
        Math.sqrt(
            xSquared *
            ySquared
        );


    return denominator
        ? numerator /
          denominator
        : null;
}


function phaseInsightConfidence(
    sampleSize,
    minimum = 5
) {
    if (
        sampleSize <
        minimum
    ) {
        return {
            label:
                'Collecting data',

            className:
                'early'
        };
    }


    if (
        sampleSize < 10
    ) {
        return {
            label:
                'Early pattern',

            className:
                'early'
        };
    }


    if (
        sampleSize < 20
    ) {
        return {
            label:
                'Developing pattern',

            className:
                'developing'
        };
    }


    return {
        label:
            'Established pattern',

        className:
            'established'
    };
}


function phaseInsightFormatMinutes(
    value
) {
    const minutes =
        Math.round(
            value || 0
        );

    if (
        minutes < 60
    ) {
        return `${minutes}m`;
    }

    return `${Math.floor(
        minutes / 60
    )}h ${minutes % 60}m`;
}


function phaseInsightFormatSleepMinutes(
    value
) {
    if (
        !Number.isFinite(
            value
        )
    ) {
        return '—';
    }

    if (
        typeof phaseSleepFormatDuration ===
        'function'
    ) {
        return phaseSleepFormatDuration(
            value
        );
    }

    return phaseInsightFormatMinutes(
        value
    );
}


// ==========================================
// DATA LOADING
// ==========================================

async function phaseLoadInsightData(
    days
) {
    const start =
        new Date();

    // Include one extra day for sleep because
    // a sleep window may begin the night before
    // the first displayed wake date.
    const sleepStart =
        new Date(start);

    start.setDate(
        start.getDate() -
        (
            days - 1
        )
    );

    start.setHours(
        0,
        0,
        0,
        0
    );

    sleepStart.setDate(
        start.getDate() - 1
    );

    sleepStart.setHours(
        0,
        0,
        0,
        0
    );


    const [
        moodResult,
        medResult,
        sleepResult,
        eventResult,
        trackResult
    ] =
        await Promise.all([

            supabaseClient
                .from(
                    'mood_entries'
                )
                .select(
                    'mood, date_time, notes'
                )
                .gte(
                    'date_time',
                    start.toISOString()
                )
                .order(
                    'date_time',
                    {
                        ascending:
                            true
                    }
                ),

            supabaseClient
                .from(
                    'medication_log'
                )
                .select(
                    'timestamp, time_of_day'
                )
                .gte(
                    'timestamp',
                    start.toISOString()
                ),

            supabaseClient
                .from(
                    'sleep_sessions'
                )
                .select(
                    'id, bedtime, wake_time, sleep_quality, rested_rating, bedtime_mood, bedtime_note, source'
                )
                .gte(
                    'bedtime',
                    sleepStart.toISOString()
                )
                .order(
                    'bedtime',
                    {
                        ascending:
                            true
                    }
                ),

            supabaseClient
                .from(
                    'listening_events'
                )
                .select(
                    'id, track_id, provider, played_at'
                )
                .gte(
                    'played_at',
                    start.toISOString()
                )
                .order(
                    'played_at',
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    1000
                ),

            supabaseClient
                .from(
                    'music_tracks'
                )
                .select(
                    'id, track_name, artist_names, album_name, duration_ms, artwork_url, spotify_url, tempo, energy, valence, danceability, acousticness, audio_features_source'
                )
                .limit(
                    1000
                )

        ]);


    const error =
        moodResult.error ||
        medResult.error ||
        sleepResult.error ||
        eventResult.error ||
        trackResult.error;


    if (error) {
        throw error;
    }


    const trackMap =
        new Map(
            (
                trackResult.data ||
                []
            ).map(
                track => [
                    track.id,
                    track
                ]
            )
        );


    const plays =
        (
            eventResult.data ||
            []
        ).map(
            event => ({
                ...event,

                track:
                    trackMap.get(
                        event.track_id
                    ) || {}
            })
        );


    return {
        start,

        moods:
            moodResult.data ||
            [],

        meds:
            medResult.data ||
            [],

        sleeps:
            sleepResult.data ||
            [],

        plays
    };
}


// ==========================================
// MODEL BUILDING
// ==========================================

function phaseBuildInsightModel(
    data,
    days
) {
    const moodPoints =
        data.moods
            .map(
                entry => ({
                    ...entry,

                    score:
                        PHASE_MOOD_SCORES[
                            String(
                                entry.mood ||
                                ''
                            )
                                .toLowerCase()
                                .trim()
                        ],

                    time:
                        new Date(
                            entry.date_time
                        ).getTime()
                })
            )
            .filter(
                item =>
                    Number.isFinite(
                        item.score
                    ) &&
                    Number.isFinite(
                        item.time
                    )
            );


    const sleepSessions =
        (
            data.sleeps ||
            []
        ).map(
            session => {
                const bedtime =
                    new Date(
                        session.bedtime
                    );

                const wake =
                    session.wake_time
                        ? new Date(
                            session.wake_time
                        )
                        : null;


                let durationMinutes =
                    null;


                if (
                    wake &&
                    !Number.isNaN(
                        bedtime.getTime()
                    ) &&
                    !Number.isNaN(
                        wake.getTime()
                    )
                ) {
                    durationMinutes =
                        (
                            wake.getTime() -
                            bedtime.getTime()
                        ) /
                        60000;
                }


                return {
                    ...session,

                    durationMinutes,

                    wakeDateKey:
                        session.wake_time
                            ? phaseInsightDateKey(
                                session.wake_time
                            )
                            : ''
                };
            }
        );


    const daily =
        new Map();


    for (
        let offset =
            days - 1;
        offset >= 0;
        offset--
    ) {
        const date =
            new Date();

        date.setHours(
            0,
            0,
            0,
            0
        );

        date.setDate(
            date.getDate() -
            offset
        );


        daily.set(
            phaseInsightDateKey(
                date
            ),
            {
                date,

                moods:
                    [],

                plays:
                    [],

                meds:
                    0,

                sleeps:
                    []
            }
        );
    }


    moodPoints.forEach(
        mood => {
            daily
                .get(
                    phaseInsightDateKey(
                        mood.date_time
                    )
                )
                ?.moods
                .push(
                    mood.score
                );
        }
    );


    data.plays.forEach(
        play => {
            daily
                .get(
                    phaseInsightDateKey(
                        play.played_at
                    )
                )
                ?.plays
                .push(
                    play
                );
        }
    );


    data.meds.forEach(
        med => {
            const day =
                daily.get(
                    phaseInsightDateKey(
                        med.timestamp
                    )
                );

            if (day) {
                day.meds++;
            }
        }
    );


    sleepSessions.forEach(
        session => {
            if (
                !session.wakeDateKey
            ) {
                return;
            }

            const day =
                daily.get(
                    session.wakeDateKey
                );

            if (day) {
                day.sleeps.push(
                    session
                );
            }
        }
    );


    const dailyRows =
        Array.from(
            daily.values()
        ).map(
            day => {
                const completedSleeps =
                    day.sleeps.filter(
                        session =>
                            Number.isFinite(
                                session.durationMinutes
                            )
                    );


                const sleepMinutes =
                    phaseInsightMean(
                        completedSleeps.map(
                            session =>
                                session.durationMinutes
                        )
                    );


                const sleepQuality =
                    phaseInsightMean(
                        completedSleeps
                            .map(
                                session =>
                                    Number(
                                        session.sleep_quality
                                    )
                            )
                            .filter(
                                value =>
                                    Number.isFinite(
                                        value
                                    ) &&
                                    value > 0
                            )
                    );


                const restedRating =
                    phaseInsightMean(
                        completedSleeps
                            .map(
                                session =>
                                    Number(
                                        session.rested_rating
                                    )
                            )
                            .filter(
                                value =>
                                    Number.isFinite(
                                        value
                                    ) &&
                                    value > 0
                            )
                    );


                return {
                    ...day,

                    averageMood:
                        phaseInsightMean(
                            day.moods
                        ),

                    playCount:
                        day.plays.length,

                    minutes:
                        day.plays.reduce(
                            (
                                sum,
                                play
                            ) =>
                                sum +
                                (
                                    play.track
                                        .duration_ms ||
                                    0
                                ),
                            0
                        ) /
                        60000,

                    sleepMinutes,

                    sleepQuality,

                    restedRating
                };
            }
        );


    // ======================================
    // LISTENING + MOOD
    // ======================================

    const overlap =
        dailyRows
            .filter(
                day =>
                    Number.isFinite(
                        day.averageMood
                    ) &&
                    day.playCount >
                        0
            )
            .map(
                day => ({
                    x:
                        day.playCount,

                    y:
                        day.averageMood
                })
            );


    const correlation =
        overlap.length >= 5
            ? phaseInsightPearson(
                overlap
            )
            : null;


    // ======================================
    // SLEEP WINDOW + MOOD
    // ======================================

    const sleepMoodPairs =
        dailyRows
            .filter(
                day =>
                    Number.isFinite(
                        day.averageMood
                    ) &&
                    Number.isFinite(
                        day.sleepMinutes
                    )
            )
            .map(
                day => ({
                    x:
                        day.sleepMinutes,

                    y:
                        day.averageMood
                })
            );


    const sleepMoodCorrelation =
        sleepMoodPairs.length >= 5
            ? phaseInsightPearson(
                sleepMoodPairs
            )
            : null;


    // ======================================
    // SLEEP QUALITY + MOOD
    // ======================================

    const sleepQualityMoodPairs =
        dailyRows
            .filter(
                day =>
                    Number.isFinite(
                        day.averageMood
                    ) &&
                    Number.isFinite(
                        day.sleepQuality
                    )
            )
            .map(
                day => ({
                    x:
                        day.sleepQuality,

                    y:
                        day.averageMood
                })
            );


    const sleepQualityMoodCorrelation =
        sleepQualityMoodPairs.length >= 5
            ? phaseInsightPearson(
                sleepQualityMoodPairs
            )
            : null;


    // ======================================
    // LISTENING TOTALS
    // ======================================

    const totalMinutes =
        data.plays.reduce(
            (
                sum,
                play
            ) =>
                sum +
                (
                    play.track
                        .duration_ms ||
                    0
                ),
            0
        ) /
        60000;


    const uniqueTrackIds =
        new Set(
            data.plays.map(
                play =>
                    play.track_id
            )
        );


    const repeatRate =
        data.plays.length
            ? (
                (
                    data.plays.length -
                    uniqueTrackIds.size
                ) /
                data.plays.length
            ) *
            100
            : 0;


    // ======================================
    // TRACK / ARTIST GROUPS
    // ======================================

    const trackGroups =
        new Map();

    const artistGroups =
        new Map();


    data.plays.forEach(
        play => {
            const trackName =
                play.track
                    .track_name ||
                'Unknown track';

            const trackKey =
                play.track_id ||
                trackName;


            if (
                !trackGroups.has(
                    trackKey
                )
            ) {
                trackGroups.set(
                    trackKey,
                    {
                        name:
                            trackName,

                        artist:
                            play.track
                                .artist_names ||
                            'Unknown artist',

                        artwork:
                            play.track
                                .artwork_url ||
                            '',

                        count:
                            0,

                        moodScores:
                            []
                    }
                );
            }


            trackGroups
                .get(
                    trackKey
                )
                .count++;


            const artists =
                String(
                    play.track
                        .artist_names ||
                    'Unknown artist'
                )
                    .split(',')
                    .map(
                        name =>
                            name.trim()
                    )
                    .filter(
                        Boolean
                    );


            artists.forEach(
                artist => {
                    if (
                        !artistGroups.has(
                            artist
                        )
                    ) {
                        artistGroups.set(
                            artist,
                            {
                                name:
                                    artist,

                                count:
                                    0,

                                moodScores:
                                    []
                            }
                        );
                    }

                    artistGroups
                        .get(
                            artist
                        )
                        .count++;
                }
            );


            const playTime =
                new Date(
                    play.played_at
                ).getTime();


            let nearest =
                null;

            let nearestDistance =
                Infinity;


            moodPoints.forEach(
                mood => {
                    const distance =
                        Math.abs(
                            mood.time -
                            playTime
                        );

                    if (
                        distance <=
                            6 *
                            60 *
                            60 *
                            1000 &&
                        distance <
                            nearestDistance
                    ) {
                        nearest =
                            mood;

                        nearestDistance =
                            distance;
                    }
                }
            );


            if (nearest) {
                trackGroups
                    .get(
                        trackKey
                    )
                    .moodScores
                    .push(
                        nearest.score
                    );


                artists.forEach(
                    artist =>
                        artistGroups
                            .get(
                                artist
                            )
                            .moodScores
                            .push(
                                nearest.score
                            )
                );
            }
        }
    );


    const topTracks =
        [
            ...trackGroups.values()
        ].sort(
            (
                a,
                b
            ) =>
                b.count -
                a.count
        );


    const topArtists =
        [
            ...artistGroups.values()
        ].sort(
            (
                a,
                b
            ) =>
                b.count -
                a.count
        );


    // ======================================
    // LISTENING TIME OF DAY
    // ======================================

    const timePeriods = [
        {
            label:
                'Morning',

            start:
                5,

            end:
                12,

            count:
                0
        },
        {
            label:
                'Afternoon',

            start:
                12,

            end:
                17,

            count:
                0
        },
        {
            label:
                'Evening',

            start:
                17,

            end:
                22,

            count:
                0
        },
        {
            label:
                'Late night',

            start:
                22,

            end:
                29,

            count:
                0
        }
    ];


    data.plays.forEach(
        play => {
            const hour =
                new Date(
                    play.played_at
                ).getHours();

            const adjusted =
                hour < 5
                    ? hour + 24
                    : hour;


            const period =
                timePeriods.find(
                    item =>
                        adjusted >=
                            item.start &&
                        adjusted <
                            item.end
                );


            if (period) {
                period.count++;
            }
        }
    );


    const completedSleepSessions =
        sleepSessions.filter(
            session =>
                session.wake_time &&
                Number.isFinite(
                    session.durationMinutes
                )
        );


    return {
        ...data,

        days,

        moodPoints,

        sleepSessions,

        completedSleepSessions,

        dailyRows,

        overlap,

        correlation,

        sleepMoodPairs,

        sleepMoodCorrelation,

        sleepQualityMoodPairs,

        sleepQualityMoodCorrelation,

        totalMinutes,

        uniqueTracks:
            uniqueTrackIds.size,

        repeatRate,

        topTracks,

        topArtists,

        timePeriods,

        averageMood:
            phaseInsightMean(
                moodPoints.map(
                    mood =>
                        mood.score
                )
            ),

        averageSleepMinutes:
            phaseInsightMean(
                completedSleepSessions.map(
                    session =>
                        session.durationMinutes
                )
            ),

        averageSleepQuality:
            phaseInsightMean(
                completedSleepSessions
                    .map(
                        session =>
                            Number(
                                session.sleep_quality
                            )
                    )
                    .filter(
                        value =>
                            Number.isFinite(
                                value
                            ) &&
                            value > 0
                    )
            ),

        averageRestedRating:
            phaseInsightMean(
                completedSleepSessions
                    .map(
                        session =>
                            Number(
                                session.rested_rating
                            )
                    )
                    .filter(
                        value =>
                            Number.isFinite(
                                value
                            ) &&
                            value > 0
                    )
            )
    };
}


// ==========================================
// RELATIONSHIP COPY
// ==========================================

function phaseCorrelationCopy(
    model
) {
    const confidence =
        phaseInsightConfidence(
            model.overlap.length
        );


    if (
        model.overlap.length <
            5 ||
        model.correlation ===
            null
    ) {
        return {
            title:
                'Music + mood',

            text:
                `Phase has ${model.overlap.length} day${model.overlap.length === 1 ? '' : 's'} with both mood and listening data. At least 5 overlapping days are needed for an early comparison.`,

            confidence
        };
    }


    const absolute =
        Math.abs(
            model.correlation
        );


    const strength =
        absolute < 0.2
            ? 'little to no'
            : absolute < 0.4
                ? 'a slight'
                : absolute < 0.6
                    ? 'a moderate'
                    : 'a strong';


    const direction =
        model.correlation >
        0
            ? 'higher moods'
            : 'lower moods';


    return {
        title:
            'Music + mood',

        text:
            `Across ${model.overlap.length} overlapping days, listening volume shows ${strength} association with ${direction} (r = ${model.correlation.toFixed(2)}). This is an association, not proof that listening caused the mood change.`,

        confidence
    };
}


function phaseSleepMoodCopy(
    model
) {
    const count =
        model.sleepMoodPairs.length;

    const confidence =
        phaseInsightConfidence(
            count
        );


    if (
        count < 5 ||
        model.sleepMoodCorrelation ===
            null
    ) {
        return {
            title:
                'Sleep window + mood',

            text:
                `Phase has ${count} day${count === 1 ? '' : 's'} where a completed sleep window and mood observation overlap. At least 5 overlapping days are needed for an early comparison.`,

            confidence
        };
    }


    const correlation =
        model.sleepMoodCorrelation;

    const absolute =
        Math.abs(
            correlation
        );


    const strength =
        absolute < 0.2
            ? 'little to no'
            : absolute < 0.4
                ? 'a slight'
                : absolute < 0.6
                    ? 'a moderate'
                    : 'a strong';


    const direction =
        correlation > 0
            ? 'higher reported mood'
            : 'lower reported mood';


    return {
        title:
            'Sleep window + mood',

        text:
            `Across ${count} overlapping days, longer recorded sleep windows show ${strength} association with ${direction} (r = ${correlation.toFixed(2)}). Sleep Window measures time between your bedtime and morning check-ins, not verified time asleep.`,

        confidence
    };
}


function phaseSleepQualityMoodCopy(
    model
) {
    const count =
        model.sleepQualityMoodPairs.length;

    const confidence =
        phaseInsightConfidence(
            count
        );


    if (
        count < 5 ||
        model.sleepQualityMoodCorrelation ===
            null
    ) {
        return {
            title:
                'Sleep quality + mood',

            text:
                `Phase has ${count} day${count === 1 ? '' : 's'} with both a sleep-quality rating and mood observation. At least 5 overlapping days are needed for an early comparison.`,

            confidence
        };
    }


    const correlation =
        model.sleepQualityMoodCorrelation;

    const absolute =
        Math.abs(
            correlation
        );


    const strength =
        absolute < 0.2
            ? 'little to no'
            : absolute < 0.4
                ? 'a slight'
                : absolute < 0.6
                    ? 'a moderate'
                    : 'a strong';


    const direction =
        correlation > 0
            ? 'higher reported mood'
            : 'lower reported mood';


    return {
        title:
            'Sleep quality + mood',

        text:
            `Across ${count} overlapping days, higher sleep-quality ratings show ${strength} association with ${direction} (r = ${correlation.toFixed(2)}). This describes your records and does not establish cause.`,

        confidence
    };
}


// ==========================================
// INSIGHT UI HELPERS
// ==========================================

function phasePatternCard(
    title,
    text,
    confidence
) {
    return `
        <article class="phase-insight-card">

            <div class="phase-insight-card-head">

                <strong>
                    ${phaseInsightEscape(
                        title
                    )}
                </strong>

                <span
                    class="phase-confidence ${confidence.className}"
                >
                    ${confidence.label}
                </span>

            </div>

            <p>
                ${phaseInsightEscape(
                    text
                )}
            </p>

        </article>
    `;
}


function phaseBarRows(
    items,
    valueKey,
    limit = 5
) {
    const visible =
        items.slice(
            0,
            limit
        );


    const maximum =
        Math.max(
            ...visible.map(
                item =>
                    item[valueKey]
            ),
            1
        );


    return visible.length
        ? visible.map(
            item => `
                <div class="phase-bar-row">

                    <span>
                        ${phaseInsightEscape(
                            item.name ||
                            item.label
                        )}
                    </span>

                    <div>
                        <i
                            style="width:${Math.max(
                                4,
                                (
                                    item[valueKey] /
                                    maximum
                                ) *
                                100
                            )}%"
                        ></i>
                    </div>

                    <strong>
                        ${item[valueKey]}
                    </strong>

                </div>
            `
        ).join('')
        : `
            <p class="phase-empty-copy">
                More listening data is needed.
            </p>
        `;
}


// ==========================================
// MUSIC + MOOD FEATURE MATCHING
// ==========================================
//
// One mood observation per calendar day.
// Only music in the six hours BEFORE that
// observation contributes to its profile.
// ==========================================

function phaseMusicMoodDays(
    model,
    field
) {
    const latestMoodByDay =
        new Map();


    model.moodPoints.forEach(
        mood =>
            latestMoodByDay.set(
                phaseInsightDateKey(
                    mood.date_time
                ),
                mood
            )
    );


    return [
        ...latestMoodByDay.values()
    ]
        .map(
            mood => {
                const preceding =
                    model.plays.filter(
                        play => {
                            const time =
                                new Date(
                                    play.played_at
                                ).getTime();

                            return (
                                time <=
                                    mood.time &&
                                time >=
                                    mood.time -
                                    6 *
                                    60 *
                                    60 *
                                    1000
                            );
                        }
                    );


                const values =
                    preceding
                        .map(
                            play =>
                                Number(
                                    play.track?.[
                                        field
                                    ]
                                )
                        )
                        .filter(
                            (
                                value,
                                index
                            ) =>
                                playHasFeature(
                                    preceding[
                                        index
                                    ],
                                    field
                                ) &&
                                Number.isFinite(
                                    value
                                )
                        );


                return {
                    mood:
                        mood.score,

                    value:
                        phaseInsightMean(
                            values
                        ),

                    plays:
                        preceding.length
                };
            }
        )
        .filter(
            day =>
                day.value !==
                null
        );
}


function playHasFeature(
    play,
    field
) {
    return (
        play?.track?.[
            field
        ] !== null &&
        play?.track?.[
            field
        ] !== undefined &&
        play.track[
            field
        ] !== ''
    );
}


function phaseFeatureComparison(
    model,
    field,
    threshold,
    lowLabel,
    highLabel
) {
    const days =
        phaseMusicMoodDays(
            model,
            field
        );


    const low =
        days.filter(
            day =>
                day.value <
                threshold
        );


    const high =
        days.filter(
            day =>
                day.value >=
                threshold
        );


    if (
        low.length < 3 ||
        high.length < 3
    ) {
        return {
            text:
                `Matched ${days.length} mood day${days.length === 1 ? '' : 's'} to music heard in the preceding six hours (${low.length} ${lowLabel}; ${high.length} ${highLabel}). At least three days in each group are needed for a comparison.`,

            confidence:
                phaseInsightConfidence(
                    0
                )
        };
    }


    const lowMood =
        phaseInsightMean(
            low.map(
                day =>
                    day.mood
            )
        );


    const highMood =
        phaseInsightMean(
            high.map(
                day =>
                    day.mood
            )
        );


    return {
        text:
            `Your reported mood averaged ${lowMood.toFixed(1)}/5 on ${low.length} ${lowLabel} days and ${highMood.toFixed(1)}/5 on ${high.length} ${highLabel} days. This is an association, not evidence that the music changed your mood.`,

        confidence:
            phaseInsightConfidence(
                Math.min(
                    low.length,
                    high.length
                ) *
                2,
                6
            )
    };
}


// ==========================================
// WEEKLY LISTENING COMPARISON
// ==========================================

function phaseWeeklyListeningComparison(
    model
) {
    const weeks =
        new Map();


    model.dailyRows.forEach(
        day => {
            const monday =
                new Date(
                    day.date
                );

            monday.setDate(
                monday.getDate() -
                (
                    (
                        monday.getDay() +
                        6
                    ) %
                    7
                )
            );


            const key =
                phaseInsightDateKey(
                    monday
                );


            if (
                !weeks.has(
                    key
                )
            ) {
                weeks.set(
                    key,
                    {
                        monday,
                        minutes:
                            0,
                        moods:
                            []
                    }
                );
            }


            const week =
                weeks.get(
                    key
                );


            week.minutes +=
                day.minutes;


            if (
                day.averageMood !==
                null
            ) {
                week.moods.push(
                    day.averageMood
                );
            }
        }
    );


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const complete =
        [
            ...weeks.values()
        ].filter(
            week => {
                const sunday =
                    new Date(
                        week.monday
                    );

                sunday.setDate(
                    sunday.getDate() +
                    6
                );

                return (
                    week.monday >=
                        model.start &&
                    sunday <
                        today &&
                    week.moods.length >=
                        2
                );
            }
        );


    const heavy =
        complete.filter(
            week =>
                week.minutes >=
                1200
        );


    const lighter =
        complete.filter(
            week =>
                week.minutes <
                1200
        );


    if (
        heavy.length < 3 ||
        lighter.length < 3
    ) {
        return {
            text:
                `So far, ${heavy.length} complete week${heavy.length === 1 ? '' : 's'} had at least 20 hours of saved listening and ${lighter.length} had less. Phase needs three of each, with mood reports on at least two days per week, before comparing them.`,

            confidence:
                phaseInsightConfidence(
                    0
                )
        };
    }


    const average =
        weeksToAverage =>
            phaseInsightMean(
                weeksToAverage.map(
                    week =>
                        phaseInsightMean(
                            week.moods
                        )
                )
            );


    return {
        text:
            `Across ${heavy.length} weeks with at least 20 saved listening hours, weekly mood averaged ${average(heavy).toFixed(1)}/5; across ${lighter.length} lighter weeks, it averaged ${average(lighter).toFixed(1)}/5. Saved track durations estimate listening time and may overstate actual playback. This does not establish cause.`,

        confidence:
            phaseInsightConfidence(
                Math.min(
                    heavy.length,
                    lighter.length
                ) *
                2,
                6
            )
    };
}


// ==========================================
// MAIN INSIGHTS PAGE
// ==========================================

async function renderFullAnalyticsPage(
    daysCount = 30
) {
    const days =
        [
            7,
            30,
            90
        ].includes(
            Number(
                daysCount
            )
        )
            ? Number(
                daysCount
            )
            : 30;


    const route =
        window.location.hash;


    pageContent.innerHTML = `
        <div class="phase-page-state">
            Calculating patterns…
        </div>
    `;


    try {
        const model =
            phaseBuildInsightModel(
                await phaseLoadInsightData(
                    days
                ),
                days
            );


        if (
            window.location.hash !==
            route
        ) {
            return;
        }


        const musicMood =
            phaseCorrelationCopy(
                model
            );


        const sleepMood =
            phaseSleepMoodCopy(
                model
            );


        const sleepQualityMood =
            phaseSleepQualityMoodCopy(
                model
            );


        const moodDays =
            new Set(
                model.moodPoints.map(
                    mood =>
                        phaseInsightDateKey(
                            mood.date_time
                        )
                )
            ).size;


        const activeDays =
            model.dailyRows.filter(
                day =>
                    day.moods.length ||
                    day.plays.length ||
                    day.meds ||
                    day.sleeps.length
            ).length;


        // ==================================
        // MEDICATION LOGGING + MOOD
        // ==================================

        const medicationPairs =
            model.dailyRows.filter(
                day =>
                    Number.isFinite(
                        day.averageMood
                    ) &&
                    day.meds > 0
            );


        const noMedicationPairs =
            model.dailyRows.filter(
                day =>
                    Number.isFinite(
                        day.averageMood
                    ) &&
                    day.meds === 0
            );


        const medMood =
            phaseInsightMean(
                medicationPairs.map(
                    day =>
                        day.averageMood
                )
            );


        const noMedMood =
            phaseInsightMean(
                noMedicationPairs.map(
                    day =>
                        day.averageMood
                )
            );


        const medSample =
            medicationPairs.length +
            noMedicationPairs.length;


        const medText =
            medSample < 5 ||
            medMood === null ||
            noMedMood === null
                ? `Phase needs mood logs on both medication-log days and comparison days. ${medSample} usable mood days are currently available.`
                : `Average mood was ${medMood.toFixed(1)}/5 on medication-log days and ${noMedMood.toFixed(1)}/5 on other mood-report days. This measures an association with logging, not whether medication was taken as prescribed or caused the mood difference.`;


        const busiest =
            [
                ...model.timePeriods
            ].sort(
                (
                    a,
                    b
                ) =>
                    b.count -
                    a.count
            )[0];


        pageContent.innerHTML = `

            <div class="phase-page-toolbar">

                <p>
                    Relationships calculated from
                    your saved Phase signals.
                </p>

                <div class="range-switcher">

                    ${[
                        7,
                        30,
                        90
                    ].map(
                        value => `
                            <button
                                type="button"
                                class="range-btn ${value === days ? 'active' : ''}"
                                data-range="${value}"
                            >
                                ${value}D
                            </button>
                        `
                    ).join('')}

                </div>

            </div>


            <!-- ==========================
                 SIGNAL SUMMARY
                 ========================== -->

            <div class="phase-page-stats">

                <div class="phase-page-stat mood">
                    <strong>
                        ${model.averageMood?.toFixed(1) || '—'}
                    </strong>
                    <span>
                        Average mood
                    </span>
                </div>

                <div class="phase-page-stat mood">
                    <strong>
                        ${moodDays}
                    </strong>
                    <span>
                        Mood days
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.plays.length}
                    </strong>
                    <span>
                        Saved plays
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${phaseInsightFormatMinutes(
                            model.totalMinutes
                        )}
                    </strong>
                    <span>
                        Listening time
                    </span>
                </div>

                <div class="phase-page-stat sleep">
                    <strong>
                        ${phaseInsightFormatSleepMinutes(
                            model.averageSleepMinutes
                        )}
                    </strong>
                    <span>
                        Avg sleep window
                    </span>
                </div>

                <div class="phase-page-stat sleep">
                    <strong>
                        ${
                            model.averageSleepQuality !== null
                                ? `${model.averageSleepQuality.toFixed(1)}/5`
                                : '—'
                        }
                    </strong>
                    <span>
                        Avg sleep quality
                    </span>
                </div>

                <div class="phase-page-stat neutral">
                    <strong>
                        ${activeDays}
                    </strong>
                    <span>
                        Signal days
                    </span>
                </div>

            </div>


            <!-- ==========================
                 DETECTED PATTERNS
                 ========================== -->

            <div class="phase-section-heading">

                <span class="prompt-title">
                    DETECTED PATTERNS
                </span>

                <p>
                    Phase strengthens these
                    comparisons as your signals
                    overlap over time.
                </p>

            </div>


            <div class="phase-insight-grid">

                ${phasePatternCard(
                    musicMood.title,
                    musicMood.text,
                    musicMood.confidence
                )}

                ${phasePatternCard(
                    sleepMood.title,
                    sleepMood.text,
                    sleepMood.confidence
                )}

                ${phasePatternCard(
                    sleepQualityMood.title,
                    sleepQualityMood.text,
                    sleepQualityMood.confidence
                )}

                ${phasePatternCard(
                    'Medication logging + mood',
                    medText,
                    phaseInsightConfidence(
                        medSample
                    )
                )}

                ${phasePatternCard(
                    'Listening rhythm',
                    model.plays.length
                        ? `${busiest.label} is currently your most active listening period with ${busiest.count} saved play${busiest.count === 1 ? '' : 's'}. Your repeat-listening rate is ${model.repeatRate.toFixed(0)}%.`
                        : 'No listening events fall inside this date range yet.',
                    phaseInsightConfidence(
                        model.plays.length,
                        10
                    )
                )}

                ${phasePatternCard(
                    'Sleep baseline',
                    model.completedSleepSessions.length
                        ? `Your average recorded Sleep Window is ${phaseInsightFormatSleepMinutes(model.averageSleepMinutes)} across ${model.completedSleepSessions.length} completed window${model.completedSleepSessions.length === 1 ? '' : 's'}.${
                            model.averageRestedRating !== null
                                ? ` Your average rested rating is ${model.averageRestedRating.toFixed(1)}/5.`
                                : ''
                        }`
                        : 'No completed sleep windows fall inside this date range yet.',
                    phaseInsightConfidence(
                        model.completedSleepSessions.length
                    )
                )}

            </div>


            <!-- ==========================
                 SUPPORTING ANALYSIS
                 ========================== -->

            <div class="phase-analysis-grid">

                <section class="phase-analysis-panel">

                    <div class="phase-list-heading">
                        <strong>
                            Listening by time
                        </strong>

                        <span>
                            Saved plays in this period
                        </span>
                    </div>

                    <div class="phase-bar-list">
                        ${phaseBarRows(
                            model.timePeriods,
                            'count',
                            4
                        )}
                    </div>

                </section>


                <section class="phase-analysis-panel">

                    <div class="phase-list-heading">
                        <strong>
                            Top artists
                        </strong>

                        <span>
                            By number of plays
                        </span>
                    </div>

                    <div class="phase-bar-list">
                        ${phaseBarRows(
                            model.topArtists,
                            'count',
                            5
                        )}
                    </div>

                </section>

            </div>


            <!-- ==========================
                 DAILY SIGNAL COMPARISON
                 ========================== -->

            <div class="phase-signal-list">

                <div class="phase-list-heading">

                    <strong>
                        Daily signal overlap
                    </strong>

                    <span>
                        Most recent 14 days in this range
                    </span>

                </div>


                ${model.dailyRows
                    .slice(
                        -14
                    )
                    .reverse()
                    .map(
                        day => `
                            <div class="phase-signal-row">

                                <strong>
                                    ${day.date.toLocaleDateString(
                                        [],
                                        {
                                            month:
                                                'short',

                                            day:
                                                'numeric'
                                        }
                                    )}
                                </strong>

                                <span class="signal-mood-text">
                                    ● Mood ${
                                        day.averageMood !==
                                        null
                                            ? day.averageMood.toFixed(
                                                1
                                            )
                                            : '—'
                                    }
                                </span>

                                <span class="signal-medication-text">
                                    ● ${day.meds} med${day.meds === 1 ? '' : 's'}
                                </span>

                                <span class="signal-sleep-text">
                                    ● Sleep ${
                                        Number.isFinite(
                                            day.sleepMinutes
                                        )
                                            ? phaseInsightFormatSleepMinutes(
                                                day.sleepMinutes
                                            )
                                            : '—'
                                    }
                                </span>

                                <span class="signal-listening-text">
                                    ● ${day.playCount} play${day.playCount === 1 ? '' : 's'}
                                </span>

                            </div>
                        `
                    )
                    .join('')}

            </div>


            <p class="phase-page-note">
                Phase shows relationships in your
                own records. Correlations do not
                establish cause and are not medical
                advice. Sleep Window measures time
                between bedtime and morning
                check-ins, not confirmed time asleep.
            </p>
        `;


        pageContent
            .querySelectorAll(
                '[data-range]'
            )
            .forEach(
                button =>
                    button.addEventListener(
                        'click',
                        () =>
                            renderFullAnalyticsPage(
                                Number(
                                    button.dataset
                                        .range
                                )
                            )
                    )
            );

    } catch (error) {
        console.error(
            'Persistent analytics failed:',
            error
        );


        if (
            window.location.hash ===
            route
        ) {
            phaseShowPageError(
                'Insights could not be calculated.',
                error,
                () =>
                    renderFullAnalyticsPage(
                        days
                    )
            );
        }
    }
}


// ==========================================
// MUSIC INSIGHTS PAGE
// ==========================================

async function renderMusicInsightsSubpage(
    daysCount = 30
) {
    const days =
        [
            7,
            30,
            90
        ].includes(
            Number(
                daysCount
            )
        )
            ? Number(
                daysCount
            )
            : 30;


    const route =
        window.location.hash;


    pageContent.innerHTML = `
        <div class="phase-page-state">
            Syncing and calculating music patterns…
        </div>
    `;


    try {

        // Pull the freshest available Spotify
        // history before rebuilding the model.
        if (
            typeof isSpotifyConnected ===
                'function' &&
            isSpotifyConnected() &&
            typeof fetchRecentlyPlayedTracks ===
                'function'
        ) {
            const recent =
                await fetchRecentlyPlayedTracks();


            if (
                recent?.length &&
                typeof saveSpotifyListeningHistory ===
                    'function'
            ) {
                await saveSpotifyListeningHistory(
                    recent
                );
            }
        }


        const model =
            phaseBuildInsightModel(
                await phaseLoadInsightData(
                    days
                ),
                days
            );


        if (
            window.location.hash !==
            route
        ) {
            return;
        }


        const relationship =
            phaseCorrelationCopy(
                model
            );


        const busiest =
            [
                ...model.timePeriods
            ].sort(
                (
                    a,
                    b
                ) =>
                    b.count -
                    a.count
            )[0];


        const matchedTracks =
            model.topTracks.filter(
                track =>
                    track.moodScores.length >=
                    3
            );


        const strongestTrack =
            matchedTracks.sort(
                (
                    a,
                    b
                ) =>
                    b.moodScores.length -
                    a.moodScores.length
            )[0];


        const enrichedPlays =
            model.plays.filter(
                play =>
                    playHasFeature(
                        play,
                        'energy'
                    ) ||
                    playHasFeature(
                        play,
                        'tempo'
                    ) ||
                    playHasFeature(
                        play,
                        'valence'
                    )
            );


        const energyPattern =
            phaseFeatureComparison(
                model,
                'energy',
                0.5,
                'lower-energy music',
                'higher-energy music'
            );


        const tempoPattern =
            phaseFeatureComparison(
                model,
                'tempo',
                110,
                'slower-tempo music',
                'faster-tempo music'
            );


        const valencePattern =
            phaseFeatureComparison(
                model,
                'valence',
                0.5,
                'less upbeat-sounding music',
                'more upbeat-sounding music'
            );


        const weeklyPattern =
            phaseWeeklyListeningComparison(
                model
            );


        const current =
            typeof fetchCurrentlyPlayingTrack ===
                'function' &&
            typeof isSpotifyConnected ===
                'function' &&
            isSpotifyConnected()
                ? await fetchCurrentlyPlayingTrack()
                    .catch(
                        () =>
                            null
                    )
                : null;


        const active =
            current?.item;


        pageContent.innerHTML = `

            <div class="phase-page-toolbar">

                <p>
                    Your listening behavior,
                    musical characteristics,
                    and mood overlap.
                </p>

                <div class="range-switcher">

                    ${[
                        7,
                        30,
                        90
                    ].map(
                        value => `
                            <button
                                type="button"
                                class="range-btn ${value === days ? 'active' : ''}"
                                data-music-range="${value}"
                            >
                                ${value}D
                            </button>
                        `
                    ).join('')}

                </div>

            </div>


            ${
                active
                    ? `
                        <div class="music-current">

                            ${
                                active.album
                                    ?.images?.[0]
                                    ?.url
                                    ? `
                                        <img
                                            src="${phaseInsightEscape(
                                                active.album.images[0].url
                                            )}"
                                            alt="Album art"
                                        >
                                    `
                                    : ''
                            }

                            <div>

                                <span class="prompt-title">
                                    PLAYING NOW
                                </span>

                                <h3>
                                    ${phaseInsightEscape(
                                        active.name
                                    )}
                                </h3>

                                <p>
                                    ${phaseInsightEscape(
                                        active.artists
                                            ?.map(
                                                artist =>
                                                    artist.name
                                            )
                                            .join(
                                                ', '
                                            )
                                    )}
                                </p>

                            </div>

                        </div>
                    `
                    : ''
            }


            <div class="phase-page-stats music-stats">

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.plays.length}
                    </strong>
                    <span>
                        Saved plays
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.uniqueTracks}
                    </strong>
                    <span>
                        Unique tracks
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${phaseInsightFormatMinutes(
                            model.totalMinutes
                        )}
                    </strong>
                    <span>
                        Listening time
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.repeatRate.toFixed(0)}%
                    </strong>
                    <span>
                        Repeat rate
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.topArtists.length}
                    </strong>
                    <span>
                        Artists
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${model.overlap.length}
                    </strong>
                    <span>
                        Mood overlap days
                    </span>
                </div>

                <div class="phase-page-stat listening">
                    <strong>
                        ${enrichedPlays.length}/${model.plays.length}
                    </strong>
                    <span>
                        Plays with audio features
                    </span>
                </div>

            </div>


            <div class="phase-insight-grid">

                ${phasePatternCard(
                    relationship.title,
                    relationship.text,
                    relationship.confidence
                )}

                ${phasePatternCard(
                    'Listening rhythm',
                    model.plays.length
                        ? `${busiest.label} is your most active period, accounting for ${busiest.count} of ${model.plays.length} saved plays in this range.`
                        : 'No saved plays fall inside this range.',
                    phaseInsightConfidence(
                        model.plays.length,
                        10
                    )
                )}

                ${phasePatternCard(
                    'Track + mood signal',
                    strongestTrack
                        ? `${strongestTrack.name} has ${strongestTrack.moodScores.length} nearby mood observations averaging ${phaseInsightMean(strongestTrack.moodScores).toFixed(1)}/5. More observations are needed before treating this as a stable pattern.`
                        : 'A track needs at least 3 plays within six hours of a mood entry before Phase displays a track-level mood signal.',
                    phaseInsightConfidence(
                        strongestTrack
                            ?.moodScores
                            .length ||
                        0,
                        5
                    )
                )}

                ${phasePatternCard(
                    'Musical energy + mood',
                    energyPattern.text,
                    energyPattern.confidence
                )}

                ${phasePatternCard(
                    'Tempo + mood',
                    tempoPattern.text,
                    tempoPattern.confidence
                )}

                ${phasePatternCard(
                    'Musical positivity + mood',
                    valencePattern.text,
                    valencePattern.confidence
                )}

                ${phasePatternCard(
                    '20-hour listening weeks + mood',
                    weeklyPattern.text,
                    weeklyPattern.confidence
                )}

            </div>


            <div class="phase-analysis-grid">

                <section class="phase-analysis-panel">

                    <div class="phase-list-heading">

                        <strong>
                            Top artists
                        </strong>

                        <span>
                            Play frequency
                        </span>

                    </div>

                    <div class="phase-bar-list">
                        ${phaseBarRows(
                            model.topArtists,
                            'count',
                            6
                        )}
                    </div>

                </section>


                <section class="phase-analysis-panel">

                    <div class="phase-list-heading">

                        <strong>
                            Listening by time
                        </strong>

                        <span>
                            Daily rhythm
                        </span>

                    </div>

                    <div class="phase-bar-list">
                        ${phaseBarRows(
                            model.timePeriods,
                            'count',
                            4
                        )}
                    </div>

                </section>

            </div>


            <div class="phase-signal-list">

                <div class="phase-list-heading">

                    <strong>
                        Top tracks
                    </strong>

                    <span>
                        Saved listening history
                    </span>

                </div>


                ${
                    model.topTracks
                        .slice(
                            0,
                            10
                        )
                        .map(
                            track => `
                                <div class="music-track-row">

                                    ${
                                        track.artwork
                                            ? `
                                                <img
                                                    src="${phaseInsightEscape(
                                                        track.artwork
                                                    )}"
                                                    alt=""
                                                >
                                            `
                                            : `
                                                <span class="music-art-placeholder">
                                                    ♪
                                                </span>
                                            `
                                    }

                                    <div>

                                        <strong>
                                            ${phaseInsightEscape(
                                                track.name
                                            )}
                                        </strong>

                                        <span>
                                            ${phaseInsightEscape(
                                                track.artist
                                            )}
                                        </span>

                                    </div>

                                    <time>
                                        ${track.count}
                                        play${track.count === 1 ? '' : 's'}
                                    </time>

                                </div>
                            `
                        )
                        .join('') ||
                    `
                        <div class="phase-page-state">
                            No saved tracks in this range.
                        </div>
                    `
                }

            </div>


            <p class="phase-page-note">
                Music energy, tempo, and positivity
                describe characteristics of tracks,
                not your personal energy or feelings.
                Listening hours estimate full track
                durations rather than confirmed
                playback. Patterns are observational,
                not medical advice.
            </p>
        `;


        pageContent
            .querySelectorAll(
                '[data-music-range]'
            )
            .forEach(
                button =>
                    button.addEventListener(
                        'click',
                        () =>
                            renderMusicInsightsSubpage(
                                Number(
                                    button.dataset
                                        .musicRange
                                )
                            )
                    )
            );

    } catch (error) {
        console.error(
            'Persistent music analytics failed:',
            error
        );


        if (
            window.location.hash ===
            route
        ) {
            phaseShowPageError(
                'Music insights could not be calculated.',
                error,
                () =>
                    renderMusicInsightsSubpage(
                        days
                    )
            );
        }
    }
}