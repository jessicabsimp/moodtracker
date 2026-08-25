// ==========================================
// 1. DASHBOARD ANALYTICS WIDGET ENGINE
// ==========================================

let selectedMonthOffset = 0; // 0 = This Month, -1 = Last Month
let customHabits = JSON.parse(localStorage.getItem('user_custom_habits')) || ['Hydration 💧', 'Meditation 🧘'];

async function updateAnalytics() {
    // A. Define 7-Day Rolling Window (6 days ago through today)
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // B. Query Supabase Datasets
    const [{ data: moodEntries }, { data: medLogs }, { data: journalEntries }] = await Promise.all([
        supabaseClient.from('mood_entries').select('mood, date_time').gte('date_time', sevenDaysAgo.toISOString()),
        supabaseClient.from('medication_log').select('timestamp').gte('timestamp', sevenDaysAgo.toISOString()),
        supabaseClient.from('journal_entries').select('timestamp').gte('timestamp', sevenDaysAgo.toISOString())
    ]);

    const moodScores = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
    const dailyMoodMap = {};
    const loggedDaysSet = new Set();

    let highCount = 0, medCount = 0, lowCount = 0;

    if (moodEntries && moodEntries.length > 0) {
        moodEntries.forEach(entry => {
            if (!entry.date_time) return;
            const dateStr = new Date(entry.date_time).toISOString().split('T')[0];
            loggedDaysSet.add(dateStr);

            if (!dailyMoodMap[dateStr]) dailyMoodMap[dateStr] = [];
            
            const normalizedMood = (entry.mood || '').toLowerCase().trim();
            const score = moodScores[normalizedMood] || 3;
            dailyMoodMap[dateStr].push(score);

            if (score >= 4) highCount++;
            else if (score === 3) medCount++;
            else lowCount++;
        });
    }

    if (medLogs) medLogs.forEach(m => m.timestamp && loggedDaysSet.add(new Date(m.timestamp).toISOString().split('T')[0]));
    if (journalEntries) journalEntries.forEach(j => j.timestamp && loggedDaysSet.add(new Date(j.timestamp).toISOString().split('T')[0]));

    // C. Compute Summary Stat Cards
    const totalMoodDays = Object.keys(dailyMoodMap).length;
    let sumOfDailyAverages = 0;
    let positiveDaysCount = 0;

    Object.values(dailyMoodMap).forEach(scores => {
        const dayAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        sumOfDailyAverages += dayAvg;
        if (dayAvg >= 4.0) positiveDaysCount++;
    });

    const overallAvgMood = totalMoodDays > 0 ? (sumOfDailyAverages / totalMoodDays).toFixed(1) : '0.0';

    // Update target stat elements
    const statValues = document.querySelectorAll('.analytics-card .stat-value');
    const elemAvgMood = document.getElementById('avgMoodValue') || (statValues.length > 0 ? statValues[0] : null);
    const elemDaysLogged = document.getElementById('daysLoggedValue') || (statValues.length > 1 ? statValues[1] : null);

    if (elemAvgMood) elemAvgMood.textContent = overallAvgMood;
    if (elemDaysLogged) elemDaysLogged.textContent = loggedDaysSet.size;

    // D. Render Mood Distribution Bar
    const totalMoodEntries = highCount + medCount + lowCount;
    const barGreat = document.getElementById('barGreat');
    const barGood = document.getElementById('barGood');
    const barLow = document.getElementById('barLow');

    if (totalMoodEntries > 0) {
        if (barGreat) barGreat.style.width = `${(highCount / totalMoodEntries) * 100}%`;
        if (barGood) barGood.style.width = `${(medCount / totalMoodEntries) * 100}%`;
        if (barLow) barLow.style.width = `${(lowCount / totalMoodEntries) * 100}%`;
    } else {
        if (barGreat) barGreat.style.width = '0%';
        if (barGood) barGood.style.width = '0%';
        if (barLow) barLow.style.width = '0%';
    }

    const elemHigh = document.getElementById('countHigh');
    const elemMed = document.getElementById('countMed');
    const elemLow = document.getElementById('countLow');

    if (elemHigh) elemHigh.textContent = highCount;
    if (elemMed) elemMed.textContent = medCount;
    if (elemLow) elemLow.textContent = lowCount;

    // E. Dynamic Insight Text
    const insightElem = document.getElementById('weeklyInsightText');
    if (insightElem) {
        if (totalMoodEntries === 0) {
            insightElem.textContent = "Log your daily mood to generate insights.";
        } else if (parseFloat(overallAvgMood) >= 4.0) {
            insightElem.textContent = "Your mood is consistently high this week. Great job maintaining balance!";
        } else if (parseFloat(overallAvgMood) >= 3.0) {
            insightElem.textContent = "A steady week overall. Consider adding a quick reflection on lower days.";
        } else {
            insightElem.textContent = "Mood scores have been lower recently. Remember to prioritize rest and self-care.";
        }
    }

    // F. Badges, SVG Graph & Monthly Habit Matrix
    updateBadges(loggedDaysSet, medLogs || []);
    renderTrendLine(moodEntries || []);
    await renderHabitMatrix(selectedMonthOffset);
}

function updateBadges(loggedDaysSet, medLogs) {
    const streakBadge = document.getElementById('streakBadge');
    const medBadge = document.getElementById('medAdherenceBadge');

    // Active Consecutive Days Streak
    let streak = 0;
    const checkDate = new Date();
    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (loggedDaysSet.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else break;
    }

    if (streakBadge) streakBadge.textContent = `🔥 ${streak}-Day Streak`;

    // Med Adherence Percentage
    const medDays = new Set(medLogs.map(m => new Date(m.timestamp).toISOString().split('T')[0])).size;
    const medAdherence = Math.round((medDays / 7) * 100);
    if (medBadge) medBadge.textContent = `💊 ${medAdherence}% Med Adherence`;
}

function renderTrendLine(moodEntries) {
    const chartPath = document.getElementById('chartPath');
    const chartArea = document.getElementById('chartArea');
    const chartNodes = document.getElementById('chartNodes');
    const labelsContainer = document.getElementById('dynamicChartLabels');
    const tooltip = document.getElementById('chartTooltip');

    if (!chartPath || !labelsContainer) return;

    const moodScores = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push({
            dateString: d.toISOString().split('T')[0],
            label: dayNames[d.getDay()],
            scores: []
        });
    }

    moodEntries.forEach(entry => {
        if (!entry.date_time) return;
        const entryDate = new Date(entry.date_time).toISOString().split('T')[0];
        const dayMatch = days.find(d => d.dateString === entryDate);
        if (dayMatch) {
            const normalizedMood = (entry.mood || '').toLowerCase().trim();
            dayMatch.scores.push(moodScores[normalizedMood] || 3);
        }
    });

    labelsContainer.innerHTML = days.map(d => `<span>${d.label}</span>`).join('');

    const xPositions = [0, 58, 116, 175, 233, 291, 350];
    let lastValidAvg = 3;
    const points = days.map((day, i) => {
        if (day.scores.length > 0) {
            lastValidAvg = day.scores.reduce((a, b) => a + b, 0) / day.scores.length;
        }
        // Scaled for 140px height canvas
        const y = 125 - ((lastValidAvg - 1) / 4) * 110;
        return { x: xPositions[i], y: Math.round(y), score: lastValidAvg.toFixed(1), day: day.label };
    });

    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        pathD += ` C ${cpX},${p0.y} ${cpX},${p1.y} ${p1.x},${p1.y}`;
    }

    chartPath.setAttribute('d', pathD);

    const areaD = `${pathD} L 350,140 L 0,140 Z`;
    if (chartArea) chartArea.setAttribute('d', areaD);

    if (chartNodes) {
        chartNodes.innerHTML = '';
        points.forEach(pt => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', 4);
            circle.setAttribute('fill', '#56613B');
            circle.setAttribute('class', 'chart-node');

            circle.addEventListener('mouseenter', () => {
                if (!tooltip) return;
                tooltip.style.display = 'block';
                tooltip.style.left = `${(pt.x / 350) * 100}%`;
                tooltip.style.top = `${pt.y - 10}px`;
                tooltip.textContent = `${pt.day}: ${pt.score} Avg Mood`;
            });

            circle.addEventListener('mouseleave', () => {
                if (tooltip) tooltip.style.display = 'none';
            });

            chartNodes.appendChild(circle);
        });
    }
}

// ==========================================
// 2. CALENDAR MONTH HABIT MATRIX ENGINE
// ==========================================

async function renderHabitMatrix(monthOffset = 0) {
    selectedMonthOffset = monthOffset;
    const container = document.getElementById('habitMatrixRows');
    const labelElem = document.getElementById('habitMatrixMonthLabel');
    if (!container) return;

    const btnThis = document.getElementById('thisMonthBtn');
    const btnLast = document.getElementById('lastMonthBtn');

    if (btnThis && btnLast) {
        btnThis.className = monthOffset === 0 ? 'time-filter-btn active-btn' : 'time-filter-btn inactive-btn';
        btnLast.className = monthOffset === -1 ? 'time-filter-btn active-btn' : 'time-filter-btn inactive-btn';
    }

    // A. Parse Start & End boundaries for selected month
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

    // B. Fetch Supabase Data within target calendar month
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

    // C. Render Habit Matrix Rows with Faint Week Separators
    allHabits.forEach(habit => {
        const row = document.createElement('div');
        row.className = 'habit-matrix-row';

        let dotsHtml = '<div class="habit-dots-flex">';
        
        for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
            const currentDayDate = new Date(year, month, dayNum);
            const dateStr = currentDayDate.toISOString().split('T')[0];

            // Check if day is a Sunday (start of week) and insert faint vertical line separator
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

// Add & Toggle Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('thisMonthBtn')?.addEventListener('click', () => renderHabitMatrix(0));
    document.getElementById('lastMonthBtn')?.addEventListener('click', () => renderHabitMatrix(-1));

    document.getElementById('addHabitBtn')?.addEventListener('click', () => {
        const habitName = prompt('Enter a new habit to track (e.g., Water 💧, Exercise 🏃):');
        if (habitName && habitName.trim() !== '') {
            customHabits.push(habitName.trim());
            localStorage.setItem('user_custom_habits', JSON.stringify(customHabits));
            renderHabitMatrix(selectedMonthOffset);
        }
    });
});

function deleteCustomHabit(habitName) {
    if (confirm(`Remove custom habit "${habitName}"?`)) {
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


// ==========================================
// 3. DETAILED ANALYTICS SUBPAGE ENGINE (#analytics)
// ==========================================

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

    // Calculate Habit Summary Totals
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
<!-- Filter Switcher Bar -->
<div style="display: flex; gap: 8px; margin-bottom: 20px;">
    <button class="time-filter-btn ${filterKey === '7' ? 'active-btn' : 'inactive-btn'}" data-days="7">Last 7 Days</button>
    <button class="time-filter-btn ${filterKey === '30' ? 'active-btn' : 'inactive-btn'}" data-days="30">Last 30 Days</button>
    <button class="time-filter-btn ${filterKey === 'all' ? 'active-btn' : 'inactive-btn'}" data-days="all">All Time</button>
</div>

        <!-- Metric Summary Cards -->
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

        <!-- Habit Summary Data Table -->
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

        <!-- Mood Breakdown Bars -->
        <h4 style="font-family: 'DM Serif Display', serif; margin: 20px 0 10px 0; color: var(--olive);">Mood Distribution Breakdown</h4>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
            ${Object.entries(counts).map(([mood, count]) => {
                const pct = totalMoods > 0 ? Math.round((count / totalMoods) * 100) : 0;
                const barColor = mood === 'great' ? 'var(--olive)' : mood === 'good' ? 'var(--sage)' : mood === 'okay' ? 'var(--gold)' : 'var(--terracotta)';
                return `
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                            <span style="text-transform: capitalize; font-weight: 600;">${mood}</span>
                            <span>${count} logs (${pct}%)</span>
                        </div>
                        <div style="height: 8px; background: #FAF8F3; border-radius: 10px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: ${barColor}; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <!-- Action Row -->
        <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
            <button id="exportCsvBtn" class="save-btn" style="background: var(--terracotta);">Export Data (CSV)</button>
        </div>
    `;

    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const daysAttr = e.currentTarget.getAttribute('data-days');
            renderFullAnalyticsPage(daysAttr);
        });
    });

    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportToCSV(moodEntries || []));
    }
}

function exportToCSV(entries) {
    if (entries.length === 0) {
        alert('No data available to export.');
        return;
    }

    const headers = ['ID', 'Date Time', 'Mood', 'Notes'];
    const rows = entries.map(e => [
        e.id,
        `"${new Date(e.date_time).toLocaleString()}"`,
        `"${e.mood}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wellness_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}