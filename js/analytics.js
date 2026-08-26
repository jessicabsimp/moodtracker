// ==========================================
// PHASE WAVELENGTH DATA NORMALIZATION ENGINE
// ==========================================

function getRangeDateBuckets(daysCount = 7) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    const today = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push({
            dateString: d.toISOString().split('T')[0],
            label: daysCount <= 14 ? dayNames[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`,
            rawDate: d
        });
    }
    return days;
}

function normalizeMoodData(moodEntries, buckets) {
    const moodScores = { 'great': 1.0, 'good': 0.75, 'okay': 0.5, 'bad': 0.25, 'terrible': 0.0 };
    let lastValidScore = 0.5;

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
    const maxEntriesPerDay = 3;
    return buckets.map(b => {
        const dayEntries = (journalEntries || []).filter(j => {
            if (!j.timestamp) return false;
            return new Date(j.timestamp).toISOString().split('T')[0] === b.dateString;
        });

        return {
            dateString: b.dateString,
            label: b.label,
            count: dayEntries.length,
            norm: Math.min(dayEntries.length / maxEntriesPerDay, 1.0)
        };
    });
}

// ==========================================
// DASHBOARD ANALYTICS & WAVELENGTH ENGINE
// ==========================================

let activeWavelengthSignals = new Set(['mood', 'listening', 'medication', 'journal']);
let cachedWavelengthData = null;
let currentWavelengthRange = 7;

async function updateAnalytics() {
    const buckets = getRangeDateBuckets(currentWavelengthRange);
    const startDate = new Date(buckets[0].rawDate);
    startDate.setHours(0, 0, 0, 0);

    const [{ data: moodEntries }, { data: medLogs }, { data: journalEntries }] = await Promise.all([
        supabaseClient.from('mood_entries').select('mood, date_time, notes').gte('date_time', startDate.toISOString()),
        supabaseClient.from('medication_log').select('timestamp, time_of_day').gte('timestamp', startDate.toISOString()),
        supabaseClient.from('journal_entries').select('timestamp, prompt').gte('timestamp', startDate.toISOString())
    ]);

    let spotifyItems = [];
    const spotifyToken = localStorage.getItem('spotify_access_token');
    if (spotifyToken && typeof fetchRecentlyPlayedTracks === 'function') {
        const tracks = await fetchRecentlyPlayedTracks(spotifyToken);
        if (tracks) spotifyItems = tracks;
    }

    cachedWavelengthData = {
        mood: moodEntries || [],
        medication: medLogs || [],
        journal: journalEntries || [],
        spotify: spotifyItems || [],
        buckets: buckets
    };

    updateTodayCardStatuses(moodEntries || [], medLogs || [], journalEntries || [], spotifyItems);

    const loggedDaysSet = new Set();
    const moodScores = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
    const dailyMoodMap = {};

    (moodEntries || []).forEach(e => {
        if (!e.date_time) return;
        const dateStr = new Date(e.date_time).toISOString().split('T')[0];
        loggedDaysSet.add(dateStr);
        if (!dailyMoodMap[dateStr]) dailyMoodMap[dateStr] = [];
        dailyMoodMap[dateStr].push(moodScores[(e.mood || '').toLowerCase().trim()] || 3);
    });

    (medLogs || []).forEach(m => m.timestamp && loggedDaysSet.add(new Date(m.timestamp).toISOString().split('T')[0]));
    (journalEntries || []).forEach(j => j.timestamp && loggedDaysSet.add(new Date(j.timestamp).toISOString().split('T')[0]));

    const totalMoodDays = Object.keys(dailyMoodMap).length;
    let sumOfAverages = 0;
    Object.values(dailyMoodMap).forEach(scores => {
        sumOfAverages += scores.reduce((a, b) => a + b, 0) / scores.length;
    });
    const overallAvgMood = totalMoodDays > 0 ? (sumOfAverages / totalMoodDays).toFixed(1) : '0.0';

    const elemAvgMood = document.getElementById('avgMoodValue');
    const elemDaysLogged = document.getElementById('daysLoggedValue');
    if (elemAvgMood) elemAvgMood.textContent = overallAvgMood;
    if (elemDaysLogged) elemDaysLogged.textContent = loggedDaysSet.size;

    let streak = 0;
    const checkDate = new Date();
    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (loggedDaysSet.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else break;
    }

    const medDays = new Set((medLogs || []).map(m => new Date(m.timestamp).toISOString().split('T')[0])).size;
    const medAdherence = Math.round((medDays / currentWavelengthRange) * 100);

    const elemStreak = document.getElementById('streakBadgeText');
    const elemMedAdherence = document.getElementById('medAdherenceText');
    if (elemStreak) elemStreak.textContent = `${streak}d`;
    if (elemMedAdherence) elemMedAdherence.textContent = `${medAdherence}%`;

    const insightElem = document.getElementById('weeklyInsightText');
    if (insightElem) {
        if (loggedDaysSet.size === 0) {
            insightElem.textContent = "Log daily mood, meds, or journaling to reveal your pattern.";
        } else if (parseFloat(overallAvgMood) >= 4.0) {
            insightElem.textContent = "Your overall signals show high emotional stability and consistency across this period.";
        } else if (parseFloat(overallAvgMood) >= 3.0) {
            insightElem.textContent = "A steady pattern overall. Listening behavior correlates smoothly with your balanced days.";
        } else {
            insightElem.textContent = "Lower mood scores detected recently. Prioritize rest and quick reflections.";
        }
    }

    renderPhaseWavelength();
}

function updateTodayCardStatuses(moodEntries, medLogs, journalEntries, spotifyItems) {
    const todayStr = new Date().toISOString().split('T')[0];

    const todayMeds = medLogs.filter(m => m.timestamp && new Date(m.timestamp).toISOString().split('T')[0] === todayStr);
    const hasMorning = todayMeds.some(m => (m.time_of_day || '').toLowerCase() === 'morning');
    const hasBedtime = todayMeds.some(m => (m.time_of_day || '').toLowerCase() === 'bedtime');

    const elemMed = document.getElementById('todayMedText');
    if (elemMed) {
        if (hasMorning && hasBedtime) {
            elemMed.innerHTML = 'Morning <span style="color:var(--signal-medication); font-weight:700;">✓</span> · Bedtime <span style="color:var(--signal-medication); font-weight:700;">✓</span>';
        } else if (hasMorning) {
            elemMed.innerHTML = 'Morning <span style="color:var(--signal-medication); font-weight:700;">✓</span> · Evening ○';
        } else if (hasBedtime) {
            elemMed.innerHTML = 'Morning ○ · Evening <span style="color:var(--signal-medication); font-weight:700;">✓</span>';
        } else if (todayMeds.length > 0) {
            elemMed.innerHTML = `${todayMeds.length} dose(s) logged today <span style="color:var(--signal-medication); font-weight:700;">✓</span>`;
        } else {
            elemMed.textContent = 'Not logged today';
        }
    }

    const elemAudioDesc = document.getElementById('spotifyVibeSubtitle');
    const connectBtn = document.getElementById('connectSpotifyBtn');
    const isSpotifyConnected = !!localStorage.getItem('spotify_access_token');

    if (elemAudioDesc) {
        if (isSpotifyConnected) {
            const todayTracks = spotifyItems.filter(i => i.played_at && new Date(i.played_at).toISOString().split('T')[0] === todayStr);
            elemAudioDesc.textContent = todayTracks.length > 0 ? `${todayTracks.length} tracks logged today` : 'Connected & Active';
            if (connectBtn) {
                connectBtn.textContent = 'Active';
                connectBtn.style.color = 'var(--signal-listening-hover)';
            }
        } else {
            elemAudioDesc.textContent = 'Spotify not connected';
            if (connectBtn) connectBtn.textContent = 'Connect';
        }
    }

    const todayJournal = journalEntries.some(j => j.timestamp && new Date(j.timestamp).toISOString().split('T')[0] === todayStr);
    const elemJournal = document.getElementById('todayJournalText');
    if (elemJournal) {
        elemJournal.innerHTML = todayJournal 
            ? 'Reflected today <span style="color:var(--signal-journal); font-weight:700;">✓</span>' 
            : 'Not logged today';
    }
}

function setWavelengthRange(days, btnElem) {
    currentWavelengthRange = days;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    if (btnElem) btnElem.classList.add('active');
    updateAnalytics();
}

function toggleWavelengthSignal(signalName) {
    if (activeWavelengthSignals.has(signalName)) {
        if (activeWavelengthSignals.size > 1) {
            activeWavelengthSignals.delete(signalName);
        }
    } else {
        activeWavelengthSignals.add(signalName);
    }

    const btnMap = {
        mood: 'btnSignalMood',
        listening: 'btnSignalListening',
        medication: 'btnSignalMedication',
        journal: 'btnSignalJournal'
    };

    Object.entries(btnMap).forEach(([sig, btnId]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (activeWavelengthSignals.has(sig)) {
                btn.className = 'signal-pill active';
            } else {
                btn.className = 'signal-pill inactive';
            }
        }
    });

    renderPhaseWavelength();
}

// ==========================================
// RENDER ATMOSPHERIC DARK WAVELENGTH
// ==========================================

function renderPhaseWavelength() {
    if (!cachedWavelengthData) return;

    const gridGroup = document.getElementById('wavelengthGridGroup');
    const pathsGroup = document.getElementById('wavelengthPathsGroup');
    const eventsGroup = document.getElementById('wavelengthEventsGroup');
    const labelsContainer = document.getElementById('dynamicChartLabels');
    const tooltip = document.getElementById('chartTooltip');
    const crosshair = document.getElementById('wavelengthCrosshair');
    const svgElem = document.querySelector('.wavelength-svg');

    if (!pathsGroup || !labelsContainer || !svgElem) return;

    svgElem.setAttribute('viewBox', '0 0 780 180');
    svgElem.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    gridGroup.innerHTML = '';
    pathsGroup.innerHTML = '';
    eventsGroup.innerHTML = '';

    const { buckets, mood, spotify, medication, journal } = cachedWavelengthData;
    
    const labelStep = currentWavelengthRange > 14 ? Math.ceil(currentWavelengthRange / 7) : 1;
    labelsContainer.innerHTML = buckets.map((b, idx) => {
        if (idx % labelStep === 0 || idx === buckets.length - 1) {
            return `<span>${b.label}</span>`;
        }
        return `<span></span>`;
    }).join('');

    const canvasWidth = 780;
    const paddingLeftRight = 30;
    const xPositions = buckets.map((_, i) => (i / (buckets.length - 1)) * (canvasWidth - (paddingLeftRight * 2)) + paddingLeftRight);

    const lanes = [
        { id: 'mood', yBaseline: 45, height: 35, label: 'MOOD' },
        { id: 'listening', yBaseline: 85, height: 30, label: 'LISTENING' },
        { id: 'medication', yBaseline: 125, height: 15, label: 'MEDICATION' },
        { id: 'journal', yBaseline: 155, height: 15, label: 'JOURNAL' }
    ];

    lanes.forEach(lane => {
        if (!activeWavelengthSignals.has(lane.id)) return;

        // Ultra-subtle grid lines for dark mode
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '10'); line.setAttribute('y1', lane.yBaseline);
        line.setAttribute('x2', '770'); line.setAttribute('y2', lane.yBaseline);
        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.07)');
        line.setAttribute('stroke-dasharray', '3 4');
        gridGroup.appendChild(line);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '10'); text.setAttribute('y', lane.yBaseline - 12);
        text.setAttribute('fill', '#858A82');
        text.setAttribute('font-size', '8.5');
        text.setAttribute('font-weight', '700');
        text.setAttribute('letter-spacing', '0.5px');
        text.textContent = lane.label;
        gridGroup.appendChild(text);
    });

    const moodNorm = normalizeMoodData(mood, buckets);
    const listeningNorm = normalizeListeningData(spotify, buckets);
    const medEvents = mapMedicationEvents(medication, buckets);
    const journalEvents = mapJournalEvents(journal, buckets);

    // 1. Mood Wave Line (Moss - Restrained Gradient Fill)
    if (activeWavelengthSignals.has('mood')) {
        const moodPoints = moodNorm.map((d, i) => ({
            x: xPositions[i],
            y: Math.round(45 - (d.val * 30)),
            score: (d.val * 5).toFixed(1)
        }));

        let pathD = `M ${moodPoints[0].x},${moodPoints[0].y}`;
        for (let i = 0; i < moodPoints.length - 1; i++) {
            const p0 = moodPoints[i];
            const p1 = moodPoints[i + 1];
            const cpX = (p0.x + p1.x) / 2;
            pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD); path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#788D46'); path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        pathsGroup.appendChild(path);

        const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', `${pathD} L ${xPositions[xPositions.length-1]},45 L ${xPositions[0]},45 Z`);
        area.setAttribute('fill', 'url(#moodWaveGradient)');
        pathsGroup.appendChild(area);
    }

    // 2. Listening Wave Line (Violet - Dusty Electric Wave)
    if (activeWavelengthSignals.has('listening')) {
        const listeningPoints = listeningNorm.map((d, i) => ({
            x: xPositions[i],
            y: Math.round(85 - (d.norm * 25)),
            count: d.count
        }));

        let pathD = `M ${listeningPoints[0].x},${listeningPoints[0].y}`;
        for (let i = 0; i < listeningPoints.length - 1; i++) {
            const p0 = listeningPoints[i];
            const p1 = listeningPoints[i + 1];
            const cpX = (p0.x + p1.x) / 2;
            pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD); path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#9A75C4'); path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        pathsGroup.appendChild(path);

        const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', `${pathD} L ${xPositions[xPositions.length-1]},85 L ${xPositions[0]},85 Z`);
        area.setAttribute('fill', 'url(#listeningWaveGradient)');
        pathsGroup.appendChild(area);
    }

    // 3. Medication Events (Amber Baseline Markers)
    if (activeWavelengthSignals.has('medication')) {
        medEvents.forEach((d, i) => {
            const x = xPositions[i];
            const y = 125;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x); circle.setAttribute('cy', y);
            circle.setAttribute('r', d.count > 0 ? '4.5' : '2');
            circle.setAttribute('fill', d.count > 0 ? '#D49728' : '#171B19');
            circle.setAttribute('stroke', '#D49728');
            circle.setAttribute('stroke-width', '1.5');
            eventsGroup.appendChild(circle);
        });
    }

    // 4. Journal Activity Wave (Burnt Coral)
    if (activeWavelengthSignals.has('journal')) {
        const journalPoints = journalEvents.map((d, i) => ({
            x: xPositions[i],
            y: Math.round(155 - (d.norm * 18)),
            count: d.count
        }));

        let pathD = `M ${journalPoints[0].x},${journalPoints[0].y}`;
        for (let i = 0; i < journalPoints.length - 1; i++) {
            const p0 = journalPoints[i];
            const p1 = journalPoints[i + 1];
            const cpX = (p0.x + p1.x) / 2;
            pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD); path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#D56543'); path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-dasharray', '3 3');
        pathsGroup.appendChild(path);
    }

    // Shared Hover Cursor & Unified Dark Tooltip
    svgElem.onmousemove = (e) => {
        const rect = svgElem.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * canvasWidth;

        let closestIdx = 0;
        let minDiff = Infinity;
        xPositions.forEach((pos, idx) => {
            const diff = Math.abs(pos - mouseX);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = idx;
            }
        });

        const matchX = xPositions[closestIdx];
        if (crosshair) {
            crosshair.style.display = 'block';
            crosshair.setAttribute('x1', matchX);
            crosshair.setAttribute('x2', matchX);
            crosshair.setAttribute('y1', '10');
            crosshair.setAttribute('y2', '170');
            crosshair.setAttribute('stroke', '#41473E');
        }

        if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${(matchX / canvasWidth) * 100}%`;
            tooltip.style.top = `35px`;

            const b = buckets[closestIdx];
            const mVal = moodNorm[closestIdx].score;
            const lVal = listeningNorm[closestIdx].count;
            const medVal = medEvents[closestIdx].count > 0 ? 'Logged' : 'None';
            const jVal = journalEvents[closestIdx].count;

            tooltip.innerHTML = `
                <div class="tooltip-date">${b.dateString}</div>
                <div class="tooltip-row"><span style="color:#788D46">●</span> Mood: ${mVal}/5</div>
                <div class="tooltip-row"><span style="color:#9A75C4">●</span> Tracks: ${lVal}</div>
                <div class="tooltip-row"><span style="color:#D49728">●</span> Meds: ${medVal}</div>
                <div class="tooltip-row"><span style="color:#D56543">●</span> Journal: ${jVal} entries</div>
            `;
        }
    };

    svgElem.onmouseleave = () => {
        if (crosshair) crosshair.style.display = 'none';
        if (tooltip) tooltip.style.display = 'none';
    };
}