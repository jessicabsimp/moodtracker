const dashboardView = document.getElementById('dashboard-view');
const subpageView = document.getElementById('subpage-view');
const pageTitle = document.getElementById('page-title');
const pageContent = document.getElementById('page-content');

async function handleRouting() {
    const hash = window.location.hash;

    if (!hash || hash === '#') {
        dashboardView.style.display = 'block';
        subpageView.style.display = 'none';
        return;
    }

    dashboardView.style.display = 'none';
    subpageView.style.display = 'block';
    pageContent.innerHTML = '<p style="font-size: 0.85rem; color: var(--secondary-text);">Loading entries...</p>';

    if (hash === '#journal') {
        pageTitle.textContent = 'Journal History';
        renderFullJournalList();
    } else if (hash === '#medication') {
        pageTitle.textContent = 'Medication History';
        renderFullMedicationList();
    } else if (hash === '#mood') {
        pageTitle.textContent = 'Mood Log History';
        renderFullMoodList();
    } else if (hash === '#analytics') {
        pageTitle.textContent = 'Detailed Analytics';
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">Detailed analytics and correlation views active!</p>';
    } else if (hash === '#music') {
        pageTitle.textContent = 'Music Insights';
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">Spotify integrations coming soon in Phase 5!</p>';
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
    const { data: logs, error } = await supabaseClient
        .from('medication_log')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error || !logs || logs.length === 0) {
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">No medication logs found.</p>';
        return;
    }

    pageContent.innerHTML = '';
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
        pageContent.appendChild(div);
    });
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