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

// ==========================================
// DASHBOARD ANALYTICS WIDGET ENGINE
// ==========================================

let activeWavelengthSignals = new Set(['mood', 'listening', 'medication', 'journal']);
let cachedWavelengthData = null;
let selectedMonthOffset = 0; // 0 = This Month, -1 = Last Month
let customHabits = JSON.parse(localStorage.getItem('user_custom_habits')) || ['Hydration 💧', 'Meditation 🧘'];

async function updateAnalytics() {
    const buckets = get7DayDateBuckets();
    const startDate = new Date(buckets[0].rawDate);
    startDate.setHours(0, 0, 0, 0);

    // Query Supabase Datasets & Spotify Recent Tracks
    const [{ data: moodEntries }, { data: medLogs }, { data: journalEntries }] = await Promise.all([
        supabaseClient.from('mood_entries').select('mood, date_time, notes').gte('date_time', startDate.toISOString()),
        supabaseClient.from('medication_log').select('timestamp, time_of_day').gte('timestamp', startDate.toISOString()),
        supabaseClient.from('journal_entries').select('timestamp, prompt').gte('timestamp', startDate.toISOString())
    ]);

    // Fetch Spotify Tracks if token exists
    let spotifyItems = [];
    const spotifyToken = localStorage.getItem('spotify_access_token');
    if (spotifyToken && typeof fetchRecentlyPlayedTracks === 'function') {
        const tracks = await fetchRecentlyPlayedTracks(spotifyToken);
        if (tracks) spotifyItems = tracks;
    }

    // Cache dataset for signal toggling
    cachedWavelengthData = {
        mood: moodEntries || [],
        medication: medLogs || [],
        journal: journalEntries || [],
        spotify: spotifyItems || [],
        buckets: buckets
    };

    // 1. Update Left-Column Consolidated "Today" Card Statuses
    updateTodayCardStatuses(moodEntries || [], medLogs || [], journalEntries || [], spotifyItems);

    // 2. Compute Metrics for "This Week" Tile Summary
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

    // Badges / Summary Text
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
    const medAdherence = Math.round((medDays / 7) * 100);

    const elemStreak = document.getElementById('streakBadgeText');
    const elemMedAdherence = document.getElementById('medAdherenceText');
    if (elemStreak) elemStreak.textContent = `${streak}d`;
    if (elemMedAdherence) elemMedAdherence.textContent = `${medAdherence}%`;

    // 3. Dynamic Weekly Pattern Insight Text
    const insightElem = document.getElementById('weeklyInsightText');
    if (insightElem) {
        if (loggedDaysSet.size === 0) {
            insightElem.textContent = "Log daily mood, meds, or journaling to reveal your pattern.";
        } else if (parseFloat(overallAvgMood) >= 4.0) {
            insightElem.textContent = "Your overall signals show high emotional stability and consistency this week.";
        } else if (parseFloat(overallAvgMood) >= 3.0) {
            insightElem.textContent = "A steady week overall. Notice how medication adherence aligns with higher mood days.";
        } else {
            insightElem.textContent = "Lower mood scores detected recently. Prioritize rest and quick reflections.";
        }
    }

    // 4. Render Phase Wavelength Visualization
    renderPhaseWavelength();
}

function updateTodayCardStatuses(moodEntries, medLogs, journalEntries, spotifyItems) {
    const todayStr = new Date().toISOString().split('T')[0];

    // A. Medication Status Row
    const todayMeds = medLogs.filter(m => m.timestamp && new Date(m.timestamp).toISOString().split('T')[0] === todayStr);
    const hasMorning = todayMeds.some(m => (m.time_of_day || '').toLowerCase() === 'morning');
    const hasBedtime = todayMeds.some(m => (m.time_of_day || '').toLowerCase() === 'bedtime');

    const elemMed = document.getElementById('todayMedText');
    if (elemMed) {
        if (hasMorning && hasBedtime) {
            elemMed.innerHTML = 'Morning <span style="color:var(--olive); font-weight:700;">✓</span> · Bedtime <span style="color:var(--olive); font-weight:700;">✓</span>';
        } else if (hasMorning) {
            elemMed.innerHTML = 'Morning <span style="color:var(--olive); font-weight:700;">✓</span> · Bedtime ○';
        } else if (hasBedtime) {
            elemMed.innerHTML = 'Morning ○ · Bedtime <span style="color:var(--olive); font-weight:700;">✓</span>';
        } else if (todayMeds.length > 0) {
            elemMed.innerHTML = `${todayMeds.length} dose(s) logged today <span style="color:var(--olive); font-weight:700;">✓</span>`;
        } else {
            elemMed.textContent = 'Not logged today';
        }
    }

    // B. Listening Status Row
    const elemAudioDesc = document.getElementById('spotifyVibeSubtitle');
    const connectBtn = document.getElementById('connectSpotifyBtn');
    const isSpotifyConnected = !!localStorage.getItem('spotify_access_token');

    if (elemAudioDesc) {
        if (isSpotifyConnected) {
            const todayTracks = spotifyItems.filter(i => i.played_at && new Date(i.played_at).toISOString().split('T')[0] === todayStr);
            elemAudioDesc.textContent = todayTracks.length > 0 ? `${todayTracks.length} tracks logged today` : 'Spotify active';
            if (connectBtn) {
                connectBtn.textContent = 'Active';
                connectBtn.style.color = 'var(--olive)';
            }
        } else {
            elemAudioDesc.textContent = 'Spotify not connected';
            if (connectBtn) connectBtn.textContent = 'Connect';
        }
    }

    // C. Journal Status Row
    const todayJournal = journalEntries.some(j => j.timestamp && new Date(j.timestamp).toISOString().split('T')[0] === todayStr);
    const elemJournal = document.getElementById('todayJournalText');
    if (elemJournal) {
        elemJournal.innerHTML = todayJournal 
            ? 'Reflected today <span style="color:var(--olive); font-weight:700;">✓</span>' 
            : 'Not logged today';
    }
}

function toggleWavelengthSignal(signalName) {
    if (activeWavelengthSignals.has(signalName)) {
        if (activeWavelengthSignals.size > 1) { // Maintain at least one signal
            activeWavelengthSignals.delete(signalName);
        }
    } else {
        activeWavelengthSignals.add(signalName);
    }

    // Update Pill Buttons Styling
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
                btn.textContent = `${sig.charAt(0).toUpperCase() + sig.slice(1)} ✓`;
            } else {
                btn.className = 'signal-pill';
                btn.textContent = sig.charAt(0).toUpperCase() + sig.slice(1);
            }
        }
    });

    renderPhaseWavelength();
}

// ==========================================
// PHASE WAVELENGTH MULTI-SIGNAL SVG RENDERER
// ==========================================

function renderPhaseWavelength() {
    if (!cachedWavelengthData) return;

    const gridGroup = document.getElementById('wavelengthGridGroup');
    const pathsGroup = document.getElementById('wavelengthPathsGroup');
    const eventsGroup = document.getElementById('wavelengthEventsGroup');
    const labelsContainer = document.getElementById('dynamicChartLabels');
    const tooltip = document.getElementById('chartTooltip');

    if (!pathsGroup || !labelsContainer) return;

    gridGroup.innerHTML = '';
    pathsGroup.innerHTML = '';
    eventsGroup.innerHTML = '';

    const { buckets, mood, spotify, medication, journal } = cachedWavelengthData;
    labelsContainer.innerHTML = buckets.map(b => `<span>${b.label}</span>`).join('');

    const xPositions = [15, 69, 123, 177, 231, 285, 335];

    // Draw horizontal signal lane separators
    const lanes = [
        { id: 'mood', yTop: 15, height: 75, label: 'MOOD' },
        { id: 'listening', yTop: 100, height: 50, label: 'AUDIO' },
        { id: 'medication', yTop: 165, height: 40, label: 'MEDS' },
        { id: 'journal', yTop: 220, height: 40, label: 'JOURNAL' }
    ];

    lanes.forEach(lane => {
        if (!activeWavelengthSignals.has(lane.id)) return;

        // Faint horizontal divider
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', lane.yTop + lane.height);
        line.setAttribute('x2', '350');
        line.setAttribute('y2', lane.yTop + lane.height);
        line.setAttribute('stroke', 'rgba(90, 80, 60, 0.08)');
        line.setAttribute('stroke-dasharray', '3 3');
        gridGroup.appendChild(line);

        // Subtle lane text tag
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', lane.yTop + 10);
        text.setAttribute('fill', '#6E6B61');
        text.setAttribute('font-size', '7');
        text.setAttribute('font-weight', '700');
        text.setAttribute('opacity', '0.5');
        text.textContent = lane.label;
        gridGroup.appendChild(text);
    });

    // 1. RENDER MOOD SIGNAL WAVE (Lane 1: y: 15 to 90)
    if (activeWavelengthSignals.has('mood')) {
        const moodNorm = normalizeMoodData(mood, buckets);
        const moodPoints = moodNorm.map((d, i) => {
            const y = 85 - (d.val * 60); // Invert scale for SVG Y-axis
            return { x: xPositions[i], y: Math.round(y), score: (d.val * 5).toFixed(1), day: d.label };
        });

        let pathD = `M ${moodPoints[0].x},${moodPoints[0].y}`;
        for (let i = 0; i < moodPoints.length - 1; i++) {
            const p0 = moodPoints[i];
            const p1 = moodPoints[i + 1];
            const cpX = (p0.x + p1.x) / 2;
            pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#56613B');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        pathsGroup.appendChild(path);

        const areaD = `${pathD} L 335,90 L 15,90 Z`;
        const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', areaD);
        area.setAttribute('fill', 'url(#moodWaveGradient)');
        pathsGroup.appendChild(area);

        // Dynamic Tooltip Nodes
        moodPoints.forEach(pt => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', 3.5);
            circle.setAttribute('fill', '#56613B');
            circle.setAttribute('class', 'chart-node');

            circle.addEventListener('mouseenter', () => {
                if (!tooltip) return;
                tooltip.style.display = 'block';
                tooltip.style.left = `${(pt.x / 350) * 100}%`;
                tooltip.style.top = `${pt.y - 10}px`;
                tooltip.textContent = `${pt.day}: ${pt.score} Mood`;
            });
            circle.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none'; });
            eventsGroup.appendChild(circle);
        });
    }

    // 2. RENDER LISTENING SIGNAL WAVE (Lane 2: y: 100 to 150)
    if (activeWavelengthSignals.has('listening')) {
        const listeningNorm = normalizeListeningData(spotify, buckets);
        
        if (localStorage.getItem('spotify_access_token')) {
            listeningNorm.forEach((d, i) => {
                const barHeight = Math.max(d.norm * 35, 4);
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', xPositions[i] - 4);
                rect.setAttribute('y', 145 - barHeight);
                rect.setAttribute('width', '8');
                rect.setAttribute('height', barHeight);
                rect.setAttribute('rx', '3');
                rect.setAttribute('fill', '#1DB954');
                rect.setAttribute('opacity', d.count > 0 ? '0.85' : '0.2');

                rect.addEventListener('mouseenter', () => {
                    if (!tooltip) return;
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${(xPositions[i] / 350) * 100}%`;
                    tooltip.style.top = `130px`;
                    tooltip.textContent = `${d.label}: ${d.count} Spotify Tracks`;
                });
                rect.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none'; });
                eventsGroup.appendChild(rect);
            });
        } else {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '175');
            text.setAttribute('y', '130');
            text.setAttribute('fill', '#6E6B61');
            text.setAttribute('font-size', '8');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = 'Connect Spotify to activate listening signal.';
            eventsGroup.appendChild(text);
        }
    }

    // 3. RENDER MEDICATION EVENT MARKERS (Lane 3: y: 165 to 205)
    if (activeWavelengthSignals.has('medication')) {
        const medEvents = mapMedicationEvents(medication, buckets);
        medEvents.forEach((d, i) => {
            const x = xPositions[i];
            const y = 185;

            // Horizontal reference line
            const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            refLine.setAttribute('x1', '15'); refLine.setAttribute('y1', y);
            refLine.setAttribute('x2', '335'); refLine.setAttribute('y2', y);
            refLine.setAttribute('stroke', '#D8A646');
            refLine.setAttribute('stroke-width', '1');
            refLine.setAttribute('opacity', '0.25');
            eventsGroup.appendChild(refLine);

            if (d.count > 0) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x); circle.setAttribute('cy', y);
                circle.setAttribute('r', 5);
                circle.setAttribute('fill', '#D8A646');

                circle.addEventListener('mouseenter', () => {
                    if (!tooltip) return;
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${(x / 350) * 100}%`;
                    tooltip.style.top = `${y - 10}px`;
                    tooltip.textContent = `${d.label}: ${d.count} Med Dose(s) Logged`;
                });
                circle.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none'; });
                eventsGroup.appendChild(circle);
            }
        });
    }

    // 4. RENDER JOURNAL EVENT MARKERS (Lane 4: y: 220 to 260)
    if (activeWavelengthSignals.has('journal')) {
        const journalEvents = mapJournalEvents(journal, buckets);
        journalEvents.forEach((d, i) => {
            const x = xPositions[i];
            const y = 240;

            const refLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            refLine.setAttribute('x1', '15'); refLine.setAttribute('y1', y);
            refLine.setAttribute('x2', '335'); refLine.setAttribute('y2', y);
            refLine.setAttribute('stroke', '#C96F4A');
            refLine.setAttribute('stroke-width', '1');
            refLine.setAttribute('opacity', '0.25');
            eventsGroup.appendChild(refLine);

            if (d.count > 0) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x - 4); rect.setAttribute('y', y - 4);
                rect.setAttribute('width', '8'); rect.setAttribute('height', '8');
                rect.setAttribute('rx', '2');
                rect.setAttribute('fill', '#C96F4A');

                rect.addEventListener('mouseenter', () => {
                    if (!tooltip) return;
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${(x / 350) * 100}%`;
                    tooltip.style.top = `${y - 10}px`;
                    tooltip.textContent = `${d.label}: ${d.count} Journal Reflection(s)`;
                });
                rect.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none'; });
                eventsGroup.appendChild(rect);
            }
        });
    }
}

// ==========================================
// CALENDAR MONTH HABIT MATRIX & DETAILED PAGES
// ==========================================

async function renderHabitMatrix(monthOffset = 0) {
    selectedMonthOffset = monthOffset;
    const container = document.getElementById('habitMatrixRows');
    const labelElem = document.getElementById('habitMatrixMonthLabel');
    if (!container) return;

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const monthName = targetDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (labelElem) labelElem.textContent = `Habit Matrix — ${monthName}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDaysInMonth = lastDay.getDate();

    const startDate = new Date(firstDay);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(lastDay);
    endDate.setHours(23, 59, 59, 999);

    const [{ data: moodEntries }, { data: medLogs }, { data: journalEntries }] = await Promise.all([
        supabaseClient.from('mood_entries').select('date_time').gte('date_time', startDate.toISOString()).lte('date_time', endDate.toISOString()),
        supabaseClient.from('medication_log').select('timestamp').gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString()),
        supabaseClient.from('journal_entries').select('timestamp').gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString())
    ]);

    const logsMap = { mood: new Set(), med: new Set(), journal: new Set() };
    if (moodEntries) moodEntries.forEach(m => m.date_time && logsMap.mood.add(new Date(m.date_time).toISOString().split('T')[0]));
    if (medLogs) medLogs.forEach(m => m.timestamp && logsMap.med.add(new Date(m.timestamp).toISOString().split('T')[0]));
    if (journalEntries) journalEntries.forEach(j => j.timestamp && logsMap.journal.add(new Date(j.timestamp).toISOString().split('T')[0]));

    const defaultHabits = [
        { id: 'mood', name: 'Mood Logs', colorClass: 'active-mood' },
        { id: 'med', name: 'Medication', colorClass: 'active-med' },
        { id: 'journal', name: 'Journaling', colorClass: 'active-journal' }
    ];

    container.innerHTML = '';
    const allHabits = [
        ...defaultHabits, 
        ...customHabits.map((h, idx) => ({ id: `custom_${idx}`, name: h, colorClass: 'active-custom', isCustom: true }))
    ];

    allHabits.forEach(habit => {
        const row = document.createElement('div');
        row.className = 'habit-matrix-row';

        let dotsHtml = '<div class="habit-dots-flex">';
        for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
            const currentDayDate = new Date(year, month, dayNum);
            const dateStr = currentDayDate.toISOString().split('T')[0];

            if (currentDayDate.getDay() === 0 && dayNum !== 1) {
                dotsHtml += `<div class="week-separator" title="Week Divider"></div>`;
            }
            
            let isLogged = false;
            if (habit.id === 'mood' || habit.id === 'med' || habit.id === 'journal') {
                isLogged = logsMap[habit.id].has(dateStr);
            } else {
                const customLogs = JSON.parse(localStorage.getItem(`habit_log_${habit.name}`)) || [];
                isLogged = customLogs.includes(dateStr);
            }

            const activeClass = isLogged ? habit.colorClass : '';
            const dayFormatted = currentDayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dotsHtml += `<div class="matrix-dot ${activeClass}" title="${habit.name} — ${dayFormatted}" onclick="toggleCustomHabit('${habit.name}', '${dateStr}')"></div>`;
        }
        dotsHtml += '</div>';

        row.innerHTML = `
            <span class="habit-label">
                ${habit.name}
                ${habit.isCustom ? `<span onclick="deleteCustomHabit('${habit.name}')" style="cursor:pointer; color:var(--terracotta); font-size:0.65rem;">✕</span>` : ''}
            </span>
            ${dotsHtml}
        `;
        container.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('thisMonthBtn')?.addEventListener('click', () => renderHabitMatrix(0));
    document.getElementById('lastMonthBtn')?.addEventListener('click', () => renderHabitMatrix(-1));
});

function deleteCustomHabit(habitName) {
    if (confirm(`Remove habit "${habitName}"?`)) {
        customHabits = customHabits.filter(h => h !== habitName);
        localStorage.setItem('user_custom_habits', JSON.stringify(customHabits));
        renderHabitMatrix(selectedMonthOffset);
    }
}

function toggleCustomHabit(habitName, dateStr) {
    if (['Mood Logs', 'Medication', 'Journaling'].includes(habitName)) return;

    let customLogs = JSON.parse(localStorage.getItem(`habit_log_${habitName}`)) || [];
    if (customLogs.includes(dateStr)) {
        customLogs = customLogs.filter(d => d !== dateStr);
    } else {
        customLogs.push(dateStr);
    }
    localStorage.setItem(`habit_log_${habitName}`, JSON.stringify(customLogs));
    renderHabitMatrix(selectedMonthOffset);
}

async function renderFullAnalyticsPage(daysFilter = 30) {
    const pageTitle = document.getElementById('page-title');
    const pageContent = document.getElementById('page-content');
    if (!pageTitle || !pageContent) return;

    pageTitle.textContent = 'Detailed Analytics & Insights';

    const now = new Date();
    const startDate = new Date();
    const filterKey = String(daysFilter).toLowerCase();

    if (filterKey !== 'all') {
        const numDays = parseInt(filterKey, 10) || 30;
        startDate.setDate(now.getDate() - numDays);
        startDate.setHours(0, 0, 0, 0);
    }

    let moodQuery = supabaseClient.from('mood_entries').select('*');
    let medQuery = supabaseClient.from('medication_log').select('*');
    let journalQuery = supabaseClient.from('journal_entries').select('*');

    if (filterKey !== 'all') {
        moodQuery = moodQuery.gte('date_time', startDate.toISOString());
        medQuery = medQuery.gte('timestamp', startDate.toISOString());
        journalQuery = journalQuery.gte('timestamp', startDate.toISOString());
    }

    const [{ data: moodEntries }, { data: medLogs }, { data: journalEntries }] = await Promise.all([
        moodQuery, medQuery, journalQuery
    ]);

    const moodScores = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
    const counts = { great: 0, good: 0, okay: 0, bad: 0, terrible: 0 };
    let totalScore = 0;

    if (moodEntries) {
        moodEntries.forEach(entry => {
            const key = (entry.mood || '').toLowerCase().trim();
            if (counts[key] !== undefined) {
                counts[key]++;
                totalScore += moodScores[key];
            }
        });
    }

    const totalMoods = moodEntries ? moodEntries.length : 0;
    const avgScore = totalMoods > 0 ? (totalScore / totalMoods).toFixed(2) : '0.00';

    const habitSummaryList = [
        { name: 'Mood Logs', count: totalMoods },
        { name: 'Medication Logs', count: medLogs ? medLogs.length : 0 },
        { name: 'Journal Reflections', count: journalEntries ? journalEntries.length : 0 },
        ...customHabits.map(h => {
            const logs = JSON.parse(localStorage.getItem(`habit_log_${h}`)) || [];
            return { name: h, count: logs.length };
        })
    ];

    pageContent.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
            <button class="time-filter-btn ${filterKey === '7' ? 'active-btn' : 'inactive-btn'}" data-days="7">Last 7 Days</button>
            <button class="time-filter-btn ${filterKey === '30' ? 'active-btn' : 'inactive-btn'}" data-days="30">Last 30 Days</button>
            <button class="time-filter-btn ${filterKey === 'all' ? 'active-btn' : 'inactive-btn'}" data-days="all">All Time</button>
        </div>

        <div class="stats-grid" style="margin-bottom: 20px;">
            <div class="stat-box sage-box">
                <span class="stat-value">${avgScore}</span>
                <span class="stat-label">Average Score (Out of 5)</span>
            </div>
            <div class="stat-box gold-box">
                <span class="stat-value">${totalMoods}</span>
                <span class="stat-label">Mood Logs</span>
            </div>
            <div class="stat-box terracotta-box">
                <span class="stat-value">${(medLogs ? medLogs.length : 0) + (journalEntries ? journalEntries.length : 0)}</span>
                <span class="stat-label">Meds & Journal Actions</span>
            </div>
        </div>

        <h4 style="font-family: 'DM Serif Display', serif; margin: 20px 0 10px 0; color: var(--olive);">Habit & Activity Data Summary</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 25px;">
            <thead>
                <tr style="border-bottom: 2px solid var(--sage); color: var(--olive); text-align: left;">
                    <th style="padding: 6px;">Habit / Activity Name</th>
                    <th style="padding: 6px; text-align: right;">Total Logs</th>
                </tr>
            </thead>
            <tbody>
                ${habitSummaryList.map(h => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 8px 6px; font-weight: 600;">${h.name}</td>
                        <td style="padding: 8px 6px; text-align: right; color: var(--olive); font-weight: 700;">${h.count} logged</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const daysAttr = e.currentTarget.getAttribute('data-days');
            renderFullAnalyticsPage(daysAttr);
        });
    });
}