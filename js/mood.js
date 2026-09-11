const moodForm = document.getElementById('moodForm');

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
            .insert([{ 
                mood: selectedMood, 
                notes: notes,
                date_time: dateTime 
            }]);

        if (error) {
            console.error('Error saving mood:', error);
            return;
        }

        await updateAnalytics();
        moodForm.reset();
        document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => button.classList.remove('selected'));
    });
}

