async function updateAnalytics() {
    const { data: moodData } = await supabaseClient.from('mood_entries').select('mood');
    const { count: medCount } = await supabaseClient.from('medication_log').select('*', { count: 'exact', head: true });
    const { count: journalCount } = await supabaseClient.from('journal_entries').select('*', { count: 'exact', head: true });

    const statValues = document.querySelectorAll('.analytics-card .stat-value');
    if (!statValues || statValues.length < 3) return;

    if (!moodData || moodData.length === 0) {
        statValues[0].textContent = '0.0';
        statValues[1].textContent = '0%';
        statValues[2].textContent = (medCount || 0) + (journalCount || 0);
        return;
    }

    const moodScores = { 'great': 5, 'good': 4, 'okay': 3, 'bad': 2, 'terrible': 1 };
    let totalScore = 0;
    let positiveCount = 0;

    moodData.forEach(entry => {
        const score = moodScores[entry.mood.toLowerCase()] || 3;
        totalScore += score;
        if (score >= 4) positiveCount++;
    });

    const avgMood = (totalScore / moodData.length).toFixed(1);
    const positivePercent = Math.round((positiveCount / moodData.length) * 100);
    const totalLogged = moodData.length + (medCount || 0) + (journalCount || 0);

    statValues[0].textContent = avgMood;
    statValues[1].textContent = `${positivePercent}%`;
    statValues[2].textContent = totalLogged;
}