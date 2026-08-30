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
        
        // Conditionally render the note toggle only if entry.notes exists
        const notesHTML = entry.notes 
            ? `<details class="note-toggle">
                 <summary title="View Note">📝</summary>
                 <p class="note-content">${entry.notes}</p>
               </details>`
            : '';

        entryElement.innerHTML = `
            <span class="mood ${entry.mood.toLowerCase()}">${entry.mood}</span>
            ${notesHTML}
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

    // REPLACE YOUR EXISTING 'submit' EVENT LISTENER WITH THIS:
    moodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const moodButtons = document.querySelectorAll('#moodForm .mood-buttons button.selected');
        let selectedMood = moodButtons.length > 0 ? moodButtons[0].value : null;

        if (!selectedMood) {
            alert('Please select a mood.');
            return;
        }

        const notes = document.getElementById('notes').value.trim();
        const songPairing = document.getElementById('songPairingInput')?.value.trim() || '';
        const dateTime = document.getElementById('dateTime').value || new Date().toISOString();

        const { error } = await supabaseClient
            .from('mood_entries')
            .insert([{ 
                mood: selectedMood, 
                notes: notes, 
                song_pairing: songPairing, 
                date_time: dateTime 
            }]);

        if (error) {
            console.error('Error saving mood:', error);
            return;
        }

        await renderHistory();
        await updateAnalytics();
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
            await updateAnalytics();
        }
    });
}