// ==========================================
// PHASE WAVELENGTH DATA NORMALIZATION ENGINE
// ==========================================

function get7DayDateBuckets() {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push({
            dateString: d.toISOString().split('T')[0],
            label: dayNames[d.getDay()],
            rawDate: d
        });
    }
    return days;
}

function normalizeMoodData(moodEntries, buckets) {
    const moodScores = { 'great': 1.0, 'good': 0.75, 'okay': 0.5, 'bad': 0.25, 'terrible': 0.0 };
    let lastValidScore = 0.5; // Default fallback to "Okay"

    return buckets.map(bucket => {
        const dayEntries = (moodEntries || []).filter(entry => {
            if (!entry.date_time) return false;
            return new Date(entry.date_time).toISOString().split('T')[0] === bucket.dateString;
        });

        if (dayEntries.length > 0) {
            const sum = dayEntries.reduce((acc, curr) => {
                const norm = (curr.mood || '').toLowerCase().trim();
                return acc + (moodScores[norm] !== undefined ? moodScores[norm] : 0.5);
            }, 0);
            lastValidScore = sum / dayEntries.length;
        }

        return {
            dateString: bucket.dateString,
            label: bucket.label,
            val: lastValidScore,
            hasData: dayEntries.length > 0
        };
    });
}

function normalizeListeningData(spotifyItems, buckets) {
    if (!spotifyItems || spotifyItems.length === 0) {
        return buckets.map(b => ({ dateString: b.dateString, label: b.label, count: 0, norm: 0 }));
    }

    const countsMap = {};
    spotifyItems.forEach(item => {
        if (!item.played_at) return;
        const dStr = new Date(item.played_at).toISOString().split('T')[0];
        countsMap[dStr] = (countsMap[dStr] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(countsMap), 1);

    return buckets.map(b => {
        const count = countsMap[b.dateString] || 0;
        return {
            dateString: b.dateString,
            label: b.label,
            count: count,
            norm: count / maxCount
        };
    });
}

function mapMedicationEvents(medLogs, buckets) {
    return buckets.map(b => {
        const dayLogs = (medLogs || []).filter(m => {
            if (!m.timestamp) return false;
            return new Date(m.timestamp).toISOString().split('T')[0] === b.dateString;
        });

        return {
            dateString: b.dateString,
            label: b.label,
            count: dayLogs.length,
            doses: dayLogs.map(l => l.time_of_day)
        };
    });
}

function mapJournalEvents(journalEntries, buckets) {
    return buckets.map(b => {
        const dayEntries = (journalEntries || []).filter(j => {
            if (!j.timestamp) return false;
            return new Date(j.timestamp).toISOString().split('T')[0] === b.dateString;
        });

        return {
            dateString: b.dateString,
            label: b.label,
            count: dayEntries.length
        };
    });
}