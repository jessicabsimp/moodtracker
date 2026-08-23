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

if (writeWithPromptBtn) {
  writeWithPromptBtn.addEventListener('click', () => {
    if (modalPromptContainer) modalPromptContainer.style.display = 'block';
    if (modalPromptText && dashboardPromptText) modalPromptText.textContent = dashboardPromptText.textContent;
    if (journalModal) journalModal.style.display = 'block';
  });
}

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
        await updateAnalytics();
    }
  });
}

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
            await updateAnalytics();
        }
    });
}

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
            await updateAnalytics();
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