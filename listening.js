// ==========================================
// PHASE PROVIDER-NEUTRAL LISTENING STORAGE
// ==========================================

function normalizeSpotifyTrack(track) {
    return {
        isrc:
            track.external_ids?.isrc || null,

        spotify_track_id:
            track.id,

        track_name:
            track.name || 'Unknown track',

        artist_names:
            (track.artists || [])
                .map(artist => artist.name)
                .join(', ') ||
            'Unknown artist',

        album_name:
            track.album?.name || null,

        duration_ms:
            track.duration_ms || null,

        release_date:
            track.album?.release_date || null,

        explicit:
            Boolean(track.explicit),

        artwork_url:
            track.album?.images?.[0]?.url || null,

        spotify_url:
            track.external_urls?.spotify || null,

        updated_at:
            new Date().toISOString()
    };
}

async function saveSpotifyListeningHistory(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return {
            tracksProcessed: 0,
            playsProcessed: 0
        };
    }

    const validItems = items.filter(item => {
        return item?.track?.id && item?.played_at;
    });

    // Keep only one metadata record per Spotify track.
    const uniqueTracks = new Map();

    validItems.forEach(item => {
        uniqueTracks.set(
            item.track.id,
            normalizeSpotifyTrack(item.track)
        );
    });

    const normalizedTracks =
        Array.from(uniqueTracks.values());

    const spotifyIds = normalizedTracks.map(
        track => track.spotify_track_id
    );

    // Find tracks Phase has already saved.
    const {
        data: spotifyMatches,
        error: spotifyMatchError
    } = await supabaseClient
        .from('music_tracks')
        .select('id, spotify_track_id, isrc')
        .in('spotify_track_id', spotifyIds);

    if (spotifyMatchError) {
        throw spotifyMatchError;
    }

    const trackBySpotifyId = new Map();
    const trackByIsrc = new Map();

    (spotifyMatches || []).forEach(track => {
        if (track.spotify_track_id) {
            trackBySpotifyId.set(
                track.spotify_track_id,
                track
            );
        }

        if (track.isrc) {
            trackByIsrc.set(
                track.isrc,
                track
            );
        }
    });

    // A recording may have another Spotify ID,
    // so also match using ISRC.
    const missingIsrcs = normalizedTracks
        .filter(track => {
            return (
                !trackBySpotifyId.has(
                    track.spotify_track_id
                ) &&
                track.isrc
            );
        })
        .map(track => track.isrc);

    if (missingIsrcs.length > 0) {
        const {
            data: isrcMatches,
            error: isrcMatchError
        } = await supabaseClient
            .from('music_tracks')
            .select('id, spotify_track_id, isrc')
            .in(
                'isrc',
                [...new Set(missingIsrcs)]
            );

        if (isrcMatchError) {
            throw isrcMatchError;
        }

        (isrcMatches || []).forEach(track => {
            if (track.spotify_track_id) {
                trackBySpotifyId.set(
                    track.spotify_track_id,
                    track
                );
            }

            if (track.isrc) {
                trackByIsrc.set(
                    track.isrc,
                    track
                );
            }
        });
    }

    // Insert only genuinely new recordings.
    const rowsToInsert = [];
    const pendingCanonicalKeys = new Set();

    normalizedTracks.forEach(track => {
        const alreadyExists =
            trackBySpotifyId.has(
                track.spotify_track_id
            ) ||
            (
                track.isrc &&
                trackByIsrc.has(track.isrc)
            );

        const canonicalKey = track.isrc
            ? `isrc:${track.isrc}`
            : `spotify:${track.spotify_track_id}`;

        if (
            !alreadyExists &&
            !pendingCanonicalKeys.has(canonicalKey)
        ) {
            pendingCanonicalKeys.add(canonicalKey);
            rowsToInsert.push(track);
        }
    });

    if (rowsToInsert.length > 0) {
        const {
            data: insertedTracks,
            error: insertTrackError
        } = await supabaseClient
            .from('music_tracks')
            .insert(rowsToInsert)
            .select('id, spotify_track_id, isrc');

        if (insertTrackError) {
            throw insertTrackError;
        }

        (insertedTracks || []).forEach(track => {
            if (track.spotify_track_id) {
                trackBySpotifyId.set(
                    track.spotify_track_id,
                    track
                );
            }

            if (track.isrc) {
                trackByIsrc.set(
                    track.isrc,
                    track
                );
            }
        });
    }

    // Build one event for each exact play.
    const eventMap = new Map();

    validItems.forEach(item => {
        const normalized =
            uniqueTracks.get(item.track.id);

        const storedTrack =
            trackBySpotifyId.get(item.track.id) ||
            (
                normalized?.isrc
                    ? trackByIsrc.get(normalized.isrc)
                    : null
            );

        if (!storedTrack) {
            return;
        }

        const playedAt =
            new Date(item.played_at).toISOString();

        const eventKey =
            `spotify|${item.track.id}|${playedAt}`;

        eventMap.set(eventKey, {
            track_id:
                storedTrack.id,

            provider:
                'spotify',

            provider_track_id:
                item.track.id,

            played_at:
                playedAt,

            synced_at:
                new Date().toISOString()
        });
    });

    const events =
        Array.from(eventMap.values());

    if (events.length > 0) {
        const {
            error: eventError
        } = await supabaseClient
            .from('listening_events')
            .upsert(events, {
                onConflict:
                    'provider,provider_track_id,played_at',

                ignoreDuplicates:
                    true
            });

        if (eventError) {
            throw eventError;
        }
    }

    console.info(
        `Phase listening sync: ` +
        `${normalizedTracks.length} tracks and ` +
        `${events.length} plays processed.`
    );

    return {
        tracksProcessed:
            normalizedTracks.length,

        playsProcessed:
            events.length
    };
}