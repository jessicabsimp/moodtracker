// Initialize Supabase Client
const SUPABASE_URL = 'https://exghnybsjhxnmydktqch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Z2hueWJzamh4bm15ZGt0cWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDAyNDMsImV4cCI6MjEwMzAxNjI0M30.Xz9OEWkUy1RRYR8hxLkGJFnxBUvyZLLV-J89v5emIco';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// --- 50 DYNAMIC JOURNAL PROMPTS ---
const journalPrompts = [
  "What is one small win from today that I want to celebrate?",
  "What is something that brought you unexpected joy recently?",
  "What is a challenge you are facing, and what is one small step forward?",
  "List three things you feel grateful for in this exact moment.",
  "How did you practice self-care or prioritize rest today?",
  "What is a thought or feeling you need to give yourself permission to release?",
  "What is something kind someone said or did for you recently?",
  "Describe a moment today when you felt fully present.",
  "What is a personal boundary you set or maintained recently?",
  "What is a goal for this month, and why does it matter to you?",
  "Write about a song, place, or smell that brought back a good memory.",
  "What is one thing you can do tomorrow to make your day easier?",
  "How are you feeling physically right now, and what does your body need?",
  "What is a quality or skill you appreciate about yourself?",
  "What was the most peaceful part of your day?",
  "Describe a mistake you made recently and what it taught you.",
  "Who is someone you miss, and what would you tell them right now?",
  "What is something new or interesting you learned this week?",
  "What does your ideal restful weekend look like?",
  "How do you handle stress when it first shows up?",
  "What is a favorite memory from your childhood that makes you smile?",
  "What is one area of your life where you feel ready for change?",
  "Write down three positive affirmations that resonate with you today.",
  "What is a book, movie, or conversation that changed your perspective?",
  "How do you show love to the people closest to you?",
  "What is a habit you want to build, and why?",
  "If you could give your past self one piece of advice, what would it be?",
  "What is something you are looking forward to in the near future?",
  "Describe your current morning routine and how it makes you feel.",
  "What is a belief you used to hold that you no longer believe?",
  "How do you bounce back when feeling overwhelmed?",
  "What is a hobby or activity that makes you lose track of time?",
  "Write about a time you surprised yourself with your own strength.",
  "What environment helps you feel the most creative or productive?",
  "How do you react when things don't go according to plan?",
  "What is a quote or lyric that inspires you right now?",
  "What is one thing in your living space that brings you comfort?",
  "How have your priorities shifted over the past year?",
  "What is a compliment you received that meant a lot to you?",
  "If you had a completely free day with no obligations, what would you do?",
  "What does self-compassion mean to you, and how can you practice it?",
  "What is a tough emotion you experienced recently, and how did you process it?",
  "What is something you take for granted that you are actually thankful for?",
  "How do you set time aside to recharge your mental energy?",
  "What is a promise you want to make to yourself moving forward?",
  "Write about a mentor or friend who positively impacted your life.",
  "What is a fear you have overcome, and how did you do it?",
  "How do you define success at this stage of your life?",
  "What is something you want to say 'no' to more often?",
  "What is a topic or activity you want to explore more deeply?"
];

// Dynamic Dashboard Prompt Shuffle Logic
const shufflePromptBtn = document.getElementById('shufflePromptBtn');
const dashboardPromptText = document.getElementById('dashboardPromptText');

if (shufflePromptBtn && dashboardPromptText) {
  shufflePromptBtn.addEventListener('click', () => {
    const currentText = dashboardPromptText.textContent;
    const availablePrompts = journalPrompts.filter(p => p !== currentText);
    const randomPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    dashboardPromptText.textContent = randomPrompt;
  });
}

// --- HASH ROUTER & SUB-PAGE LOGIC ---
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
        pageContent.innerHTML = '<p style="font-size: 0.85rem;">Detailed analytics and trends view coming soon in Phase 4!</p>';

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

// Global Delete Handler for Medication and Mood in Sub-Pages
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
    }
});

window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', handleRouting);

// --- MOOD TRACKER MODULE ---
const moodForm = document.getElementById('moodForm');
const historyDiv = document.getElementById('history');

async function renderHistory() {
    if (!historyDiv) return;

    const { data: entries, error } = await supabaseClient
        .from('mood_entries')
        .select('*')
        .order('date_time', { ascending: false })
        .limit(2);

    if (error) return;

    historyDiv.innerHTML = '';

    entries.forEach(entry => {
        const entryElement = document.createElement('div');
        entryElement.className = 'entry';
        entryElement.innerHTML = `
            <span class="mood ${entry.mood.toLowerCase()}">${entry.mood}</span>
            <p>${entry.notes || ''}</p>
            <span class="dateTime">${formatDate(entry.date_time)}</span>
            <button class="delete" data-id="${entry.id}">Delete</button>
        `;
        historyDiv.appendChild(entryElement);
    });
}

if (moodForm) {
    moodForm.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.name === 'mood') {
            document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => {
                button.classList.remove('selected');
            });
            e.target.classList.add('selected');
        }
    });

    moodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const moodButtons = document.querySelectorAll('#moodForm .mood-buttons button.selected');
        let selectedMood = moodButtons.length > 0 ? moodButtons[0].value : null;

        if (!selectedMood) {
            alert('Please select a mood.');
            return;
        }

        const notes = document.getElementById('notes').value.trim();
        const dateTime = document.getElementById('dateTime').value || new Date().toISOString();

        const { error } = await supabaseClient
            .from('mood_entries')
            .insert([{ mood: selectedMood, notes: notes, date_time: dateTime }]);

        if (error) return;

        await renderHistory();
        moodForm.reset();
        document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => button.classList.remove('selected'));
    });
}

if (historyDiv) {
    historyDiv.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('delete')) {
            const id = e.target.getAttribute('data-id');
            await supabaseClient.from('mood_entries').delete().eq('id', id);
            await renderHistory();
        }
    });
}

// --- MEDICATION TRACKER MODULE ---
const medModal = document.getElementById('medModal');
const closeModal = document.querySelector('.close');
const medForm = document.getElementById('medForm');
const simulateBtn = document.getElementById('simulateNFC');

function openMedModal() {
  if (medModal) medModal.style.display = 'block';
}

if (simulateBtn) simulateBtn.addEventListener('click', openMedModal);
if (closeModal) closeModal.addEventListener('click', () => medModal.style.display = 'none');

if (medForm) {
  medForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const timeRadio = document.querySelector('input[name="time"]:checked');
    if (!timeRadio) return;

    const { error } = await supabaseClient
        .from('medication_log')
        .insert([{ time_of_day: timeRadio.value, timestamp: new Date().toISOString() }]);

    if (!error) {
        medModal.style.display = 'none';
        await renderMedLogs();
    }
  });
}

async function renderMedLogs() {
  const logContainer = document.getElementById('med-log-history');
  if (!logContainer) return;

  const { data: logs, error } = await supabaseClient
      .from('medication_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(2);

  if (error) return;

  logContainer.innerHTML = '';
  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<p class="empty-state" style="color:var(--secondary-text); font-size:0.85rem;">No doses logged today.</p>';
    return;
  }

  logs.forEach((log) => {
    const date = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.innerHTML = `<span><strong>${log.time_of_day}</strong> meds taken at ${date}</span>`;
    logContainer.appendChild(logItem);
  });
}

// --- JOURNAL MODULE & MODALS ---
const journalModal = document.getElementById('journalModal');
const writeWithPromptBtn = document.getElementById('writeWithPromptBtn');
const freeWriteBtn = document.getElementById('freeWriteBtn');
const closeJournalBtn = document.querySelector('.close-journal');
const modalPromptContainer = document.getElementById('modalPromptContainer');
const modalPromptText = document.getElementById('modalPromptText');
const journalForm = document.getElementById('journalForm');

const journalEditModal = document.getElementById('journalEditModal');
const closeEditJournal = document.getElementById('closeEditJournal');
const editJournalForm = document.getElementById('editJournalForm');
const deleteModalEntryBtn = document.getElementById('deleteModalEntryBtn');

// Open Modal with Selected Prompt
if (writeWithPromptBtn) {
  writeWithPromptBtn.addEventListener('click', () => {
    if (modalPromptContainer) modalPromptContainer.style.display = 'block';
    if (modalPromptText && dashboardPromptText) modalPromptText.textContent = dashboardPromptText.textContent;
    if (journalModal) journalModal.style.display = 'block';
  });
}

// Open Modal for Free Writing
if (freeWriteBtn) {
  freeWriteBtn.addEventListener('click', () => {
    if (modalPromptContainer) modalPromptContainer.style.display = 'none';
    if (modalPromptText) modalPromptText.textContent = 'Free Reflection';
    if (journalModal) journalModal.style.display = 'block';
  });
}

if (closeJournalBtn) closeJournalBtn.addEventListener('click', () => journalModal.style.display = 'none');
if (closeEditJournal) closeEditJournal.addEventListener('click', () => journalEditModal.style.display = 'none');

window.addEventListener('click', (e) => {
  if (e.target === medModal) medModal.style.display = 'none';
  if (e.target === journalModal) journalModal.style.display = 'none';
  if (e.target === journalEditModal) journalEditModal.style.display = 'none';
});

// Populates read-only prompt and editable reflection box
function openJournalEditModal(entry) {
    document.getElementById('editJournalId').value = entry.id;
    document.getElementById('editModalDate').textContent = `Journal Entry — ${new Date(entry.timestamp).toLocaleDateString()}`;
    document.getElementById('editJournalPromptText').textContent = entry.prompt || 'Free Reflection';
    document.getElementById('editJournalResponse').value = entry.response;
    journalEditModal.style.display = 'block';
}

if (journalForm) {
  journalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const promptToSave = (modalPromptContainer && modalPromptContainer.style.display === 'none') 
      ? 'Free Reflection' 
      : (modalPromptText ? modalPromptText.textContent : 'Free Reflection');
      
    const response = document.getElementById('journalResponse').value.trim();

    if (!response) return;

    const { error } = await supabaseClient
      .from('journal_entries')
      .insert([{ prompt: promptToSave, response: response, timestamp: new Date().toISOString() }]);

    if (!error) {
        journalForm.reset();
        journalModal.style.display = 'none';
        await renderJournalEntries();
    }
  });
}

// Save Updated Reflection
if (editJournalForm) {
    editJournalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editJournalId').value;
        const response = document.getElementById('editJournalResponse').value.trim();

        const { error } = await supabaseClient
            .from('journal_entries')
            .update({ response: response })
            .eq('id', id);

        if (!error) {
            journalEditModal.style.display = 'none';
            await renderJournalEntries();
            if (window.location.hash === '#journal') {
                await renderFullJournalList();
            }
        }
    });
}

// Delete Entry from Modal
if (deleteModalEntryBtn) {
    deleteModalEntryBtn.addEventListener('click', async () => {
        const id = document.getElementById('editJournalId').value;
        if (!id) return;

        const { error } = await supabaseClient
            .from('journal_entries')
            .delete()
            .eq('id', id);

        if (!error) {
            journalEditModal.style.display = 'none';
            await renderJournalEntries();
            if (window.location.hash === '#journal') {
                await renderFullJournalList();
            }
        }
    });
}

async function renderJournalEntries() {
  const container = document.querySelector('.recent-entries');
  if (!container) return;

  const { data: entries, error } = await supabaseClient
    .from('journal_entries')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(3);

  if (error) return;

  container.innerHTML = '<span class="section-subtitle">Recent Entries</span>';
  if (!entries || entries.length === 0) {
    container.innerHTML += '<p style="color:var(--secondary-text); font-size:0.85rem;">No journal entries yet.</p>';
    return;
  }

  entries.forEach((entry) => {
    const formattedDate = new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const entryRow = document.createElement('div');
    entryRow.className = 'entry-row';
    entryRow.style.cursor = 'pointer';
    entryRow.innerHTML = `
      <div>
        <strong>${formattedDate}</strong>
        <p>${entry.response.substring(0, 35)}${entry.response.length > 35 ? '...' : ''}</p>
      </div>
      <span class="chevron">›</span>
    `;

    entryRow.addEventListener('click', () => openJournalEditModal(entry));

    container.appendChild(entryRow);
  });
}

// Initial Data Renders
renderHistory();
renderMedLogs();
renderJournalEntries();