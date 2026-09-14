// ==========================================
// PHASE RECCOBEATS AUDIO FEATURE ENRICHMENT
// ==========================================

const RECCOBEATS_API_BASE =
    'https://api.reccobeats.com/v1';

const RECCOBEATS_BATCH_SIZE = 40;

let phaseReccoBeatsSyncRunning = false;

function phaseChunkArray(items, size) {
    const chunks = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
}

function phaseSpotifyIdFromHref(href) {
    if (!href) return null;

    try {
        const url = new URL(href);
        const parts = url.pathname
            .split('/')
            .filter(Boolean);

        const trackIndex =
            parts.lastIndexOf('track');

        if (
            trackIndex >= 0 &&
            parts[trackIndex + 1]
        ) {
            return parts[trackIndex + 1];
        }
    } catch (error) {
        console.warn(
            'Unable to read ReccoBeats Spotify URL:',
            href
        );
    }

    return null;
}

async function phaseFetchReccoBeatsFeatures(
    spotifyIds
) {
    if (
        !Array.isArray(spotifyIds) ||
        spotifyIds.length === 0
    ) {
        return [];
    }

    const uniqueIds = [
        ...new Set(
            spotifyIds.filter(Boolean)
        )
    ];

    const query =
        encodeURIComponent(uniqueIds.join(','));

    const response = await fetch(
        `${RECCOBEATS_API_BASE}/audio-features?ids=${query}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        }
    );

    if (!response.ok) {
        const retryAfter =
            response.headers.get('Retry-After');

        const error = new Error(
            response.status === 429
                ? `ReccoBeats rate limit reached${
                    retryAfter
                        ? `. Retry after ${retryAfter} seconds`
                        : ''
                }.`
                : `ReccoBeats returned HTTP ${response.status}.`
        );

        error.status = response.status;
        throw error;
    }

    const payload = await response.json();

    return Array.isArray(payload?.content)
        ? payload.content
        : [];
}

function phaseNormalizeReccoBeatsFeatures(
    feature
) {
    return {
        acousticness:
            Number.isFinite(feature?.acousticness)
                ? feature.acousticness
                : null,

        danceability:
            Number.isFinite(feature?.danceability)
                ? feature.danceability
                : null,

        energy:
            Number.isFinite(feature?.energy)
                ? feature.energy
                : null,

        instrumentalness:
            Number.isFinite(feature?.instrumentalness)
                ? feature.instrumentalness
                : null,

        liveness:
            Number.isFinite(feature?.liveness)
                ? feature.liveness
                : null,

        loudness:
            Number.isFinite(feature?.loudness)
                ? feature.loudness
                : null,

        speechiness:
            Number.isFinite(feature?.speechiness)
                ? feature.speechiness
                : null,

        tempo:
            Number.isFinite(feature?.tempo)
                ? feature.tempo
                : null,

        valence:
            Number.isFinite(feature?.valence)
                ? feature.valence
                : null,

        musical_key:
            Number.isInteger(feature?.key)
                ? feature.key
                : null,

        musical_mode:
            Number.isInteger(feature?.mode)
                ? feature.mode
                : null,

        reccobeats_id:
            feature?.id || null,

        audio_features_source:
            'reccobeats',

        audio_features_updated_at:
            new Date().toISOString(),

        reccobeats_status:
            'complete',

        reccobeats_error:
            null
    };
}

async function phaseUpdateTrackFromReccoBeats(
    track,
    feature
) {
    const normalized =
        phaseNormalizeReccoBeatsFeatures(feature);

    const { error } = await supabaseClient
        .from('music_tracks')
        .update(normalized)
        .eq('id', track.id);

    if (error) {
        throw error;
    }
}

async function phaseMarkReccoBeatsUnavailable(
    track
) {
    const { error } = await supabaseClient
        .from('music_tracks')
        .update({
            reccobeats_status: 'not_found',
            reccobeats_error:
                'No ReccoBeats match was returned.',
            audio_features_updated_at:
                new Date().toISOString()
        })
        .eq('id', track.id);

    if (error) {
        throw error;
    }
}

async function phaseMarkReccoBeatsError(
    tracks,
    error
) {
    const message =
        error?.message ||
        'Unknown ReccoBeats error.';

    await Promise.allSettled(
        tracks.map(track =>
            supabaseClient
                .from('music_tracks')
                .update({
                    reccobeats_status: 'error',
                    reccobeats_error: message
                })
                .eq('id', track.id)
        )
    );
}

async function enrichPendingTracksWithReccoBeats() {
    if (phaseReccoBeatsSyncRunning) {
        return {
            processed: 0,
            matched: 0,
            unavailable: 0,
            skipped: true
        };
    }

    phaseReccoBeatsSyncRunning = true;

    let processed = 0;
    let matched = 0;
    let unavailable = 0;

    try {
        const {
            data: tracks,
            error: trackError
        } = await supabaseClient
            .from('music_tracks')
            .select(
                'id, spotify_track_id, isrc, track_name'
            )
            .not(
                'spotify_track_id',
                'is',
                null
            )
            .or(
                [
                    'reccobeats_status.is.null',
                    'reccobeats_status.eq.pending',
                    'reccobeats_status.eq.error'
                ].join(',')
            )
            .limit(200);

        if (trackError) {
            throw trackError;
        }

        if (
            !Array.isArray(tracks) ||
            tracks.length === 0
        ) {
            console.info(
                'Phase ReccoBeats sync: no tracks need enrichment.'
            );

            return {
                processed: 0,
                matched: 0,
                unavailable: 0,
                skipped: false
            };
        }

        const batches = phaseChunkArray(
            tracks,
            RECCOBEATS_BATCH_SIZE
        );

        for (const batch of batches) {
            try {
                const spotifyIds =
                    batch.map(
                        track =>
                            track.spotify_track_id
                    );

                const features =
                    await phaseFetchReccoBeatsFeatures(
                        spotifyIds
                    );

                const featureBySpotifyId =
                    new Map();

                const featureByIsrc =
                    new Map();

                features.forEach(feature => {
                    const spotifyId =
                        phaseSpotifyIdFromHref(
                            feature.href
                        );

                    if (spotifyId) {
                        featureBySpotifyId.set(
                            spotifyId,
                            feature
                        );
                    }

                    if (feature.isrc) {
                        featureByIsrc.set(
                            String(
                                feature.isrc
                            ).toUpperCase(),
                            feature
                        );
                    }
                });

                for (const track of batch) {
                    const normalizedIsrc =
                        track.isrc
                            ? String(
                                track.isrc
                            ).toUpperCase()
                            : null;

                    const feature =
                        featureBySpotifyId.get(
                            track.spotify_track_id
                        ) ||
                        (
                            normalizedIsrc
                                ? featureByIsrc.get(
                                    normalizedIsrc
                                )
                                : null
                        );

                    if (feature) {
                        await phaseUpdateTrackFromReccoBeats(
                            track,
                            feature
                        );

                        matched++;
                    } else {
                        await phaseMarkReccoBeatsUnavailable(
                            track
                        );

                        unavailable++;
                    }

                    processed++;
                }
            } catch (batchError) {
                console.error(
                    'ReccoBeats batch failed:',
                    batchError
                );

                await phaseMarkReccoBeatsError(
                    batch,
                    batchError
                );
            }
        }

        console.info(
            `Phase ReccoBeats sync: ` +
            `${processed} tracks processed, ` +
            `${matched} matched, ` +
            `${unavailable} unavailable.`
        );

        return {
            processed,
            matched,
            unavailable,
            skipped: false
        };
    } catch (error) {
        console.error(
            'Phase ReccoBeats enrichment failed:',
            error
        );

        return {
            processed,
            matched,
            unavailable,
            skipped: false,
            error: error.message
        };
    } finally {
        phaseReccoBeatsSyncRunning = false;
    }
}