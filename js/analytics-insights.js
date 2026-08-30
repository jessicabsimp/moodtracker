// PHASE PERSISTENT INSIGHTS ENGINE
// Load after subpages.js and before app.js.

const PHASE_MOOD_SCORES = {
    terrible: 1,
    bad: 2,
    okay: 3,
    good: 4,
    great: 5
};

function phaseInsightMean(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length
        ? valid.reduce((sum, value) => sum + value, 0) / valid.length
        : null;
}

function phaseInsightDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function phaseInsightEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function phaseInsightPearson(pairs) {
    if (pairs.length < 2) return null;
    const meanX = phaseInsightMean(pairs.map(pair => pair.x));
    const meanY = phaseInsightMean(pairs.map(pair => pair.y));
    let numerator = 0;
    let xSquared = 0;
    let ySquared = 0;

    pairs.forEach(pair => {
        const x = pair.x - meanX;
        const y = pair.y - meanY;
        numerator += x * y;
        xSquared += x * x;
        ySquared += y * y;
    });

    const denominator = Math.sqrt(xSquared * ySquared);
    return denominator ? numerator / denominator : null;
}

function phaseInsightConfidence(sampleSize, minimum = 5) {
    if (sampleSize < minimum) return { label: 'Collecting data', className: 'early' };
    if (sampleSize < 10) return { label: 'Early pattern', className: 'early' };
    if (sampleSize < 20) return { label: 'Developing pattern', className: 'developing' };
    return { label: 'Established pattern', className: 'established' };
}

function phaseInsightFormatMinutes(value) {
    const minutes = Math.round(value || 0);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

async function phaseLoadInsightData(days) {
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const [moodResult, medResult, journalResult, eventResult, trackResult] =
        await Promise.all([
            supabaseClient.from('mood_entries')
                .select('mood, date_time, notes')
                .gte('date_time', start.toISOString())
                .order('date_time', { ascending: true }),
            supabaseClient.from('medication_log')
                .select('timestamp, time_of_day')
                .gte('timestamp', start.toISOString()),
            supabaseClient.from('journal_entries')
                .select('timestamp, prompt')
                .gte('timestamp', start.toISOString()),
            supabaseClient.from('listening_events')
                .select('id, track_id, provider, played_at')
                .gte('played_at', start.toISOString())
                .order('played_at', { ascending: false })
                .limit(1000),
            supabaseClient.from('music_tracks')
                .select('id, track_name, artist_names, album_name, duration_ms, artwork_url, spotify_url, genre, tempo, energy, valence, danceability')
                .limit(1000)
        ]);

    const error = moodResult.error || medResult.error || journalResult.error ||
        eventResult.error || trackResult.error;
    if (error) throw error;

    const trackMap = new Map((trackResult.data || []).map(track => [track.id, track]));
    const plays = (eventResult.data || []).map(event => ({
        ...event,
        track: trackMap.get(event.track_id) || {}
    }));

    return {
        start,
        moods: moodResult.data || [],
        meds: medResult.data || [],
        journals: journalResult.data || [],
        plays
    };
}

function phaseBuildInsightModel(data, days) {
    const moodPoints = data.moods.map(entry => ({
        ...entry,
        score: PHASE_MOOD_SCORES[String(entry.mood || '').toLowerCase().trim()],
        time: new Date(entry.date_time).getTime()
    })).filter(item => Number.isFinite(item.score) && Number.isFinite(item.time));

    const daily = new Map();
    for (let offset = days - 1; offset >= 0; offset--) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - offset);
        daily.set(phaseInsightDateKey(date), {
            date,
            moods: [],
            plays: [],
            meds: 0,
            journals: 0
        });
    }

    moodPoints.forEach(mood => daily.get(phaseInsightDateKey(mood.date_time))?.moods.push(mood.score));
    data.plays.forEach(play => daily.get(phaseInsightDateKey(play.played_at))?.plays.push(play));
    data.meds.forEach(med => {
        const day = daily.get(phaseInsightDateKey(med.timestamp));
        if (day) day.meds++;
    });
    data.journals.forEach(journal => {
        const day = daily.get(phaseInsightDateKey(journal.timestamp));
        if (day) day.journals++;
    });

    const dailyRows = Array.from(daily.values()).map(day => ({
        ...day,
        averageMood: phaseInsightMean(day.moods),
        playCount: day.plays.length,
        minutes: day.plays.reduce((sum, play) => sum + (play.track.duration_ms || 0), 0) / 60000
    }));

    const overlap = dailyRows
        .filter(day => Number.isFinite(day.averageMood) && day.playCount > 0)
        .map(day => ({ x: day.playCount, y: day.averageMood }));

    const correlation = overlap.length >= 5 ? phaseInsightPearson(overlap) : null;
    const totalMinutes = data.plays.reduce(
        (sum, play) => sum + (play.track.duration_ms || 0), 0
    ) / 60000;
    const uniqueTrackIds = new Set(data.plays.map(play => play.track_id));
    const repeatRate = data.plays.length
        ? ((data.plays.length - uniqueTrackIds.size) / data.plays.length) * 100
        : 0;

    const trackGroups = new Map();
    const artistGroups = new Map();
    data.plays.forEach(play => {
        const trackName = play.track.track_name || 'Unknown track';
        const trackKey = play.track_id || trackName;
        if (!trackGroups.has(trackKey)) {
            trackGroups.set(trackKey, {
                name: trackName,
                artist: play.track.artist_names || 'Unknown artist',
                artwork: play.track.artwork_url || '',
                count: 0,
                moodScores: []
            });
        }
        trackGroups.get(trackKey).count++;

        const artists = String(play.track.artist_names || 'Unknown artist')
            .split(',').map(name => name.trim()).filter(Boolean);
        artists.forEach(artist => {
            if (!artistGroups.has(artist)) artistGroups.set(artist, { name: artist, count: 0, moodScores: [] });
            artistGroups.get(artist).count++;
        });

        const playTime = new Date(play.played_at).getTime();
        let nearest = null;
        let nearestDistance = Infinity;
        moodPoints.forEach(mood => {
            const distance = Math.abs(mood.time - playTime);
            if (distance <= 6 * 60 * 60 * 1000 && distance < nearestDistance) {
                nearest = mood;
                nearestDistance = distance;
            }
        });
        if (nearest) {
            trackGroups.get(trackKey).moodScores.push(nearest.score);
            artists.forEach(artist => artistGroups.get(artist).moodScores.push(nearest.score));
        }
    });

    const topTracks = [...trackGroups.values()].sort((a, b) => b.count - a.count);
    const topArtists = [...artistGroups.values()].sort((a, b) => b.count - a.count);

    const timePeriods = [
        { label: 'Morning', start: 5, end: 12, count: 0 },
        { label: 'Afternoon', start: 12, end: 17, count: 0 },
        { label: 'Evening', start: 17, end: 22, count: 0 },
        { label: 'Late night', start: 22, end: 29, count: 0 }
    ];
    data.plays.forEach(play => {
        const hour = new Date(play.played_at).getHours();
        const adjusted = hour < 5 ? hour + 24 : hour;
        const period = timePeriods.find(item => adjusted >= item.start && adjusted < item.end);
        if (period) period.count++;
    });

    return {
        ...data,
        days,
        moodPoints,
        dailyRows,
        overlap,
        correlation,
        totalMinutes,
        uniqueTracks: uniqueTrackIds.size,
        repeatRate,
        topTracks,
        topArtists,
        timePeriods,
        averageMood: phaseInsightMean(moodPoints.map(mood => mood.score))
    };
}

function phaseCorrelationCopy(model) {
    const confidence = phaseInsightConfidence(model.overlap.length);
    if (model.overlap.length < 5 || model.correlation === null) {
        return {
            title: 'Music + mood relationship',
            text: `Phase has ${model.overlap.length} day${model.overlap.length === 1 ? '' : 's'} with both mood and listening data. At least 5 overlapping days are needed for an early comparison.`,
            confidence
        };
    }

    const strength = Math.abs(model.correlation) < 0.2 ? 'little to no' :
        Math.abs(model.correlation) < 0.4 ? 'a slight' :
        Math.abs(model.correlation) < 0.6 ? 'a moderate' : 'a strong';
    const direction = model.correlation > 0 ? 'higher moods' : 'lower moods';
    return {
        title: 'Music + mood relationship',
        text: `Across ${model.overlap.length} overlapping days, listening volume shows ${strength} association with ${direction} (r = ${model.correlation.toFixed(2)}). This is an association, not proof that music caused the mood change.`,
        confidence
    };
}

function phasePatternCard(title, text, confidence) {
    return `
        <article class="phase-insight-card">
            <div class="phase-insight-card-head">
                <strong>${phaseInsightEscape(title)}</strong>
                <span class="phase-confidence ${confidence.className}">${confidence.label}</span>
            </div>
            <p>${phaseInsightEscape(text)}</p>
        </article>`;
}

function phaseBarRows(items, valueKey, limit = 5) {
    const visible = items.slice(0, limit);
    const maximum = Math.max(...visible.map(item => item[valueKey]), 1);
    return visible.length ? visible.map(item => `
        <div class="phase-bar-row">
            <span>${phaseInsightEscape(item.name || item.label)}</span>
            <div><i style="width:${Math.max(4, (item[valueKey] / maximum) * 100)}%"></i></div>
            <strong>${item[valueKey]}</strong>
        </div>`).join('') : '<p class="phase-empty-copy">More listening data is needed.</p>';
}

async function renderFullAnalyticsPage(daysCount = 30) {
    const days = [7, 30, 90].includes(Number(daysCount)) ? Number(daysCount) : 30;
    const route = window.location.hash;
    pageContent.innerHTML = '<div class="phase-page-state">Calculating patterns…</div>';

    try {
        const model = phaseBuildInsightModel(await phaseLoadInsightData(days), days);
        if (window.location.hash !== route) return;
        const relationship = phaseCorrelationCopy(model);
        const moodDays = new Set(model.moodPoints.map(mood => phaseInsightDateKey(mood.date_time))).size;
        const activeDays = model.dailyRows.filter(day =>
            day.moods.length || day.plays.length || day.meds || day.journals
        ).length;
        const medicationPairs = model.dailyRows.filter(day => Number.isFinite(day.averageMood) && day.meds > 0);
        const noMedicationPairs = model.dailyRows.filter(day => Number.isFinite(day.averageMood) && day.meds === 0);
        const medMood = phaseInsightMean(medicationPairs.map(day => day.averageMood));
        const noMedMood = phaseInsightMean(noMedicationPairs.map(day => day.averageMood));
        const medSample = medicationPairs.length + noMedicationPairs.length;
        const medText = medSample < 5 || medMood === null || noMedMood === null
            ? `Phase needs mood logs on both medication-log days and comparison days. ${medSample} usable mood days are currently available.`
            : `Average mood was ${medMood.toFixed(1)}/5 on medication-log days and ${noMedMood.toFixed(1)}/5 on other logged days. This measures logging association, not whether medication was taken as prescribed.`;
        const busiest = [...model.timePeriods].sort((a, b) => b.count - a.count)[0];

        pageContent.innerHTML = `
            <div class="phase-page-toolbar">
                <p>Patterns calculated from saved Phase history.</p>
                <div class="range-switcher">${[7, 30, 90].map(value => `
                    <button type="button" class="range-btn ${value === days ? 'active' : ''}" data-range="${value}">${value}D</button>
                `).join('')}</div>
            </div>

            <div class="phase-page-stats">
                <div class="phase-page-stat mood"><strong>${model.averageMood?.toFixed(1) || '—'}</strong><span>Average mood</span></div>
                <div class="phase-page-stat mood"><strong>${moodDays}</strong><span>Mood days</span></div>
                <div class="phase-page-stat listening"><strong>${model.plays.length}</strong><span>Saved plays</span></div>
                <div class="phase-page-stat listening"><strong>${phaseInsightFormatMinutes(model.totalMinutes)}</strong><span>Listening time</span></div>
                <div class="phase-page-stat journal"><strong>${model.journals.length}</strong><span>Reflections</span></div>
                <div class="phase-page-stat neutral"><strong>${activeDays}</strong><span>Active days</span></div>
            </div>

            <div class="phase-section-heading"><span class="prompt-title">DETECTED PATTERNS</span><p>Claims strengthen as Phase collects repeated observations.</p></div>
            <div class="phase-insight-grid">
                ${phasePatternCard(relationship.title, relationship.text, relationship.confidence)}
                ${phasePatternCard('Medication logging + mood', medText, phaseInsightConfidence(medSample))}
                ${phasePatternCard('Listening rhythm', model.plays.length
                    ? `${busiest.label} is currently your most active listening period with ${busiest.count} saved plays. Your repeat-listening rate is ${model.repeatRate.toFixed(0)}%.`
                    : 'No listening events fall inside this date range yet.', phaseInsightConfidence(model.plays.length, 10))}
                ${phasePatternCard('Reflection pattern', model.journals.length
                    ? `${model.journals.length} reflection${model.journals.length === 1 ? '' : 's'} were recorded across ${days} days. Future versions can analyze themes after enough journal text is available.`
                    : 'No reflections fall inside this date range yet.', phaseInsightConfidence(model.journals.length, 5))}
            </div>

            <div class="phase-analysis-grid">
                <section class="phase-analysis-panel">
                    <div class="phase-list-heading"><strong>Listening by time</strong><span>Saved plays in this period</span></div>
                    <div class="phase-bar-list">${phaseBarRows(model.timePeriods, 'count', 4)}</div>
                </section>
                <section class="phase-analysis-panel">
                    <div class="phase-list-heading"><strong>Top artists</strong><span>By number of plays</span></div>
                    <div class="phase-bar-list">${phaseBarRows(model.topArtists, 'count', 5)}</div>
                </section>
            </div>

            <div class="phase-signal-list">
                <div class="phase-list-heading"><strong>Daily comparison</strong><span>Most recent 14 days in this range</span></div>
                ${model.dailyRows.slice(-14).reverse().map(day => `
                    <div class="phase-signal-row">
                        <strong>${day.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong>
                        <span>● Mood ${day.averageMood?.toFixed(1) || '—'}</span>
                        <span>● ${day.meds} meds</span>
                        <span>● ${day.journals} journal</span>
                        <span>● ${day.playCount} plays</span>
                    </div>`).join('')}
            </div>
            <p class="phase-page-note">Correlations describe patterns in your records. They do not establish cause or provide medical advice.</p>`;

        pageContent.querySelectorAll('[data-range]').forEach(button =>
            button.addEventListener('click', () => renderFullAnalyticsPage(Number(button.dataset.range)))
        );
    } catch (error) {
        console.error('Persistent analytics failed:', error);
        if (window.location.hash === route) phaseShowPageError('Insights could not be calculated.', error, () => renderFullAnalyticsPage(days));
    }
}

async function renderMusicInsightsSubpage(daysCount = 30) {
    const days = [7, 30, 90].includes(Number(daysCount)) ? Number(daysCount) : 30;
    const route = window.location.hash;
    pageContent.innerHTML = '<div class="phase-page-state">Syncing and calculating music patterns…</div>';

    try {
        if (typeof isSpotifyConnected === 'function' && isSpotifyConnected() && typeof fetchRecentlyPlayedTracks === 'function') {
            const recent = await fetchRecentlyPlayedTracks();
            if (recent?.length && typeof saveSpotifyListeningHistory === 'function') {
                await saveSpotifyListeningHistory(recent);
            }
        }
        const model = phaseBuildInsightModel(await phaseLoadInsightData(days), days);
        if (window.location.hash !== route) return;
        const relationship = phaseCorrelationCopy(model);
        const busiest = [...model.timePeriods].sort((a, b) => b.count - a.count)[0];
        const matchedTracks = model.topTracks.filter(track => track.moodScores.length >= 3);
        const strongestTrack = matchedTracks.sort((a, b) => b.moodScores.length - a.moodScores.length)[0];
        const current = typeof fetchCurrentlyPlayingTrack === 'function' && isSpotifyConnected()
            ? await fetchCurrentlyPlayingTrack().catch(() => null) : null;
        const active = current?.item;

        pageContent.innerHTML = `
            <div class="phase-page-toolbar">
                <p>Permanent listening history and mood overlap.</p>
                <div class="range-switcher">${[7, 30, 90].map(value => `
                    <button type="button" class="range-btn ${value === days ? 'active' : ''}" data-music-range="${value}">${value}D</button>
                `).join('')}</div>
            </div>
            ${active ? `<div class="music-current">
                ${active.album?.images?.[0]?.url ? `<img src="${phaseInsightEscape(active.album.images[0].url)}" alt="Album art">` : ''}
                <div><span class="prompt-title">PLAYING NOW</span><h3>${phaseInsightEscape(active.name)}</h3><p>${phaseInsightEscape(active.artists?.map(artist => artist.name).join(', '))}</p></div>
            </div>` : ''}
            <div class="phase-page-stats music-stats">
                <div class="phase-page-stat listening"><strong>${model.plays.length}</strong><span>Saved plays</span></div>
                <div class="phase-page-stat listening"><strong>${model.uniqueTracks}</strong><span>Unique tracks</span></div>
                <div class="phase-page-stat listening"><strong>${phaseInsightFormatMinutes(model.totalMinutes)}</strong><span>Listening time</span></div>
                <div class="phase-page-stat listening"><strong>${model.repeatRate.toFixed(0)}%</strong><span>Repeat rate</span></div>
                <div class="phase-page-stat listening"><strong>${model.topArtists.length}</strong><span>Artists</span></div>
                <div class="phase-page-stat listening"><strong>${model.overlap.length}</strong><span>Mood overlap days</span></div>
            </div>
            <div class="phase-insight-grid">
                ${phasePatternCard(relationship.title, relationship.text, relationship.confidence)}
                ${phasePatternCard('Listening rhythm', model.plays.length
                    ? `${busiest.label} is your most active period, accounting for ${busiest.count} of ${model.plays.length} saved plays in this range.`
                    : 'No saved plays fall inside this range.', phaseInsightConfidence(model.plays.length, 10))}
                ${phasePatternCard('Track + mood signal', strongestTrack
                    ? `${strongestTrack.name} has ${strongestTrack.moodScores.length} nearby mood observations averaging ${phaseInsightMean(strongestTrack.moodScores).toFixed(1)}/5. More observations are needed before treating this as a stable pattern.`
                    : 'A track needs at least 3 plays within six hours of a mood entry before Phase displays a track-level mood signal.', phaseInsightConfidence(strongestTrack?.moodScores.length || 0, 5))}
            </div>
            <div class="phase-analysis-grid">
                <section class="phase-analysis-panel"><div class="phase-list-heading"><strong>Top artists</strong><span>Play frequency</span></div><div class="phase-bar-list">${phaseBarRows(model.topArtists, 'count', 6)}</div></section>
                <section class="phase-analysis-panel"><div class="phase-list-heading"><strong>Listening by time</strong><span>Daily rhythm</span></div><div class="phase-bar-list">${phaseBarRows(model.timePeriods, 'count', 4)}</div></section>
            </div>
            <div class="phase-signal-list">
                <div class="phase-list-heading"><strong>Top tracks</strong><span>Saved listening history</span></div>
                ${model.topTracks.slice(0, 10).map(track => `
                    <div class="music-track-row">
                        ${track.artwork ? `<img src="${phaseInsightEscape(track.artwork)}" alt="">` : '<span class="music-art-placeholder">♪</span>'}
                        <div><strong>${phaseInsightEscape(track.name)}</strong><span>${phaseInsightEscape(track.artist)}</span></div>
                        <time>${track.count} play${track.count === 1 ? '' : 's'}</time>
                    </div>`).join('') || '<div class="phase-page-state">No saved tracks in this range.</div>'}
            </div>
            <p class="phase-page-note">Genre, tempo, energy, valence and danceability will appear when those optional metadata fields are populated. They are intentionally excluded instead of guessed.</p>`;

        pageContent.querySelectorAll('[data-music-range]').forEach(button =>
            button.addEventListener('click', () => renderMusicInsightsSubpage(Number(button.dataset.musicRange)))
        );
    } catch (error) {
        console.error('Persistent music analytics failed:', error);
        if (window.location.hash === route) phaseShowPageError('Music insights could not be calculated.', error, () => renderMusicInsightsSubpage(days));
    }
}

// Upgrade the dashboard wavelength to use saved listening history and
// replace the old hard-coded correlation sentence with calculated copy.
const phaseOriginalUpdateAnalytics =
    typeof window.updateAnalytics === 'function'
        ? window.updateAnalytics
        : null;

if (phaseOriginalUpdateAnalytics) {
    window.updateAnalytics = async function phasePersistentDashboardUpdate() {
        await phaseOriginalUpdateAnalytics();

        try {
            const model = phaseBuildInsightModel(
                await phaseLoadInsightData(currentWavelengthRange || 7),
                currentWavelengthRange || 7
            );

            if (cachedWavelengthData) {
                cachedWavelengthData.spotify = model.plays.map(play => ({
                    played_at: play.played_at,
                    track: {
                        name: play.track.track_name,
                        duration_ms: play.track.duration_ms,
                        artists: String(play.track.artist_names || '')
                            .split(',')
                            .map(name => ({ name: name.trim() }))
                    }
                }));

                renderPhaseWavelength();
            }

            const insightElement = document.getElementById('weeklyInsightText');
            if (insightElement) {
                insightElement.textContent = phaseCorrelationCopy(model).text;
            }
        } catch (error) {
            console.warn('Saved dashboard listening history could not be loaded:', error);
        }
    };
}