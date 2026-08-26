const dashboardView = document.getElementById('dashboard-view');
const subpageView = document.getElementById('subpage-view');
const pageTitle = document.getElementById('page-title');
const pageContent = document.getElementById('page-content');

async function handleRouting() {
    const hash = window.location.hash;

    // Update Top Navigation Active States
    document.querySelectorAll('.phase-nav .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if ((!hash || hash === '#') && href === '#') {
            link.classList.add('active');
        } else if (hash && href === hash) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Handle NFC tag modal opening without switching to a subpage view
    if (hash === '#log-dose') {
        dashboardView.style.display = 'block';
        subpageView.style.display = 'none';
        
        const medModal = document.getElementById('medModal');
        if (medModal) {
            medModal.style.display = 'flex';
        }
        return;
    }

    if (!hash || hash === '#') {
        dashboardView.style.display = 'block';
        subpageView.style.display = 'none';
        return;
    }

    dashboardView.style.display = 'none';
    subpageView.style.display = 'block';
    pageContent.innerHTML = '<p style="font-size: 0.85rem; color: var(--secondary-text);">Loading...</p>';

    if (hash === '#journal') {
        pageTitle.textContent = 'Journal & Reflections';
        renderFullJournalList();
    } else if (hash === '#medication') {
        pageTitle.textContent = 'Medication Tracker & History';
        renderFullMedicationList();
    } else if (hash === '#mood') {
        pageTitle.textContent = 'Mood Log History';
        renderFullMoodList();
    } else if (hash === '#analytics') {
        pageTitle.textContent = 'Personal Insights & Analytics';
        renderFullAnalyticsPage(30);
    } else if (hash === '#music') {
        pageTitle.textContent = 'Music & Audio Insights';
        if (typeof renderMusicInsightsSubpage === 'function') {
            renderMusicInsightsSubpage();
        } else {
            pageContent.innerHTML = `
                <div style="padding: 10px 0;">
                    <p style="color: var(--secondary-text); margin-bottom: 12px;">Track your listening behavior and explore audio-mood correlations.</p>
                    <div id="spotify-container" class="card" style="padding: 16px;"></div>
                </div>
            `;
            if (typeof initSpotifyIntegration === 'function') {
                initSpotifyIntegration();
            }
        }
    }
}

async function renderFullJournalList() {
    const { data: entries, error } = await supabaseClient
        .from('journal_entries')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error || !entries || entries.length === 0) {
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">No journal entries found.</p>';
        return;
    }

    pageContent.innerHTML = '';
    entries.forEach(entry => {
        const div = document.createElement('div');
        div.style.padding = '12px 0';
        div.style.borderBottom = '1px solid var(--sage)';
        div.style.fontSize = '0.85rem';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: var(--olive);">${new Date(entry.timestamp).toLocaleString()}</strong>
                <span style="color: var(--terracotta); font-size: 0.8rem; font-weight: 600;">Edit / View ›</span>
            </div>
            <p style="margin: 4px 0;"><em>${entry.prompt}</em></p>
            <p style="white-space: pre-wrap; margin-top: 4px;">${entry.response}</p>
        `;

        div.addEventListener('click', () => openJournalEditModal(entry));
        pageContent.appendChild(div);
    });
}

async function renderFullMedicationList() {
    // Fetch both Medication Logs and Mood Entries in parallel
    const [{ data: logs, error: medError }, { data: moodEntries, error: moodError }] = await Promise.all([
        supabaseClient.from('medication_log').select('*').order('timestamp', { ascending: false }),
        supabaseClient.from('mood_entries').select('*').order('date_time', { ascending: false })
    ]);

    pageContent.innerHTML = '';

    // --- SECTION 1: Medication History ---
    const medSection = document.createElement('div');
    medSection.style.marginBottom = '24px';
    medSection.innerHTML = `<h3 style="font-family: 'DM Serif Display', serif; color: var(--olive); margin-bottom: 12px; font-size: 1.05rem;">Medication History</h3>`;

    if (medError || !logs || logs.length === 0) {
        medSection.innerHTML += '<p style="font-size: 0.85rem; color: var(--secondary-text);">No medication logs found.</p>';
    } else {
        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.style.marginBottom = '8px';
            div.style.fontSize = '0.85rem';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <span><strong>${log.time_of_day}</strong> — ${new Date(log.timestamp).toLocaleString()}</span>
                <button class="delete-btn" data-id="${log.id}" data-type="medication" style="background: none; border: none; color: var(--terracotta); cursor: pointer; font-size: 0.8rem; font-weight: 600;">Delete</button>
            `;
            medSection.appendChild(div);
        });
    }
    pageContent.appendChild(medSection);

    // --- SECTION 2: Mood Log History ---
    const moodSection = document.createElement('div');
    moodSection.innerHTML = `<h3 style="font-family: 'DM Serif Display', serif; color: var(--olive); margin-bottom: 12px; font-size: 1.05rem;">Mood History</h3>`;

    if (moodError || !moodEntries || moodEntries.length === 0) {
        moodSection.innerHTML += '<p style="font-size: 0.85rem; color: var(--secondary-text);">No mood logs found.</p>';
    } else {
        moodEntries.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'entry';
            div.style.marginBottom = '8px';
            div.style.fontSize = '0.85rem';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <div>
                    <span class="mood ${entry.mood.toLowerCase()}">${entry.mood}</span>
                    <p style="display:inline; margin-left:8px;">${entry.notes || ''}</p>
                    <span class="dateTime" style="display:block; font-size:0.75rem;">${formatDate(entry.date_time)}</span>
                </div>
                <button class="delete-btn" data-id="${entry.id}" data-type="mood" style="background: none; border: none; color: var(--terracotta); cursor: pointer; font-size: 0.8rem; font-weight: 600;">Delete</button>
            `;
            moodSection.appendChild(div);
        });
    }
    pageContent.appendChild(moodSection);
}

async function renderFullMoodList() {
    const { data: entries, error } = await supabaseClient
        .from('mood_entries')
        .select('*')
        .order('date_time', { ascending: false });

    if (error || !entries || entries.length === 0) {
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">No mood logs found.</p>';
        return;
    }

    pageContent.innerHTML = '';
    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'entry';
        div.style.marginBottom = '8px';
        div.style.fontSize = '0.85rem';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
            <div>
                <span class="mood ${entry.mood.toLowerCase()}">${entry.mood}</span>
                <p style="display:inline; margin-left:8px;">${entry.notes || ''}</p>
                <span class="dateTime" style="display:block; font-size:0.75rem;">${formatDate(entry.date_time)}</span>
            </div>
            <button class="delete-btn" data-id="${entry.id}" data-type="mood" style="background: none; border: none; color: var(--terracotta); cursor: pointer; font-size: 0.8rem; font-weight: 600;">Delete</button>
        `;
        pageContent.appendChild(div);
    });
}

pageContent.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete-btn')) {
        const id = e.target.getAttribute('data-id');
        const type = e.target.getAttribute('data-type');

        if (type === 'medication') {
            await supabaseClient.from('medication_log').delete().eq('id', id);
            await renderFullMedicationList();
            await renderMedLogs();
        } else if (type === 'mood') {
            await supabaseClient.from('mood_entries').delete().eq('id', id);
            await renderFullMoodList();
            await renderHistory();
        }
        await updateAnalytics();
    }
});

window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', handleRouting);