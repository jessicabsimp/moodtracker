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
    if (journalModal) journalModal.style.display = 'flex';
  });
}

if (freeWriteBtn) {
  freeWriteBtn.addEventListener('click', () => {
    if (modalPromptContainer) modalPromptContainer.style.display = 'none';
    if (modalPromptText) modalPromptText.textContent = 'Free Reflection';
    if (journalModal) journalModal.style.display = 'flex';
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
    journalEditModal.style.display = 'flex';
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
            if (window.location.hash === '#journal') {
                await renderFullJournalList();
            }
            await updateAnalytics();
        }
    });
}

