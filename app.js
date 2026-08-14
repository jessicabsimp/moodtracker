const moodForm = document.getElementById('moodForm');
const historyDiv = document.getElementById('history');

const moods = ['Great', 'Good', 'Okay', 'Bad', 'Terrible'];

function getLocalStorageData() {
    return JSON.parse(localStorage.getItem('moodEntries')) || [];
}

function setLocalStorageData(data) {
    localStorage.setItem('moodEntries', JSON.stringify(data));
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function renderHistory() {
    const entries = getLocalStorageData().sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    historyDiv.innerHTML = '';

    entries.forEach(entry => {
        const entryElement = document.createElement('div');
        entryElement.className = 'entry';

        entryElement.innerHTML = `
            <span class="mood ${entry.mood.toLowerCase()}">${entry.mood}</span>
            <p>${entry.notes}</p>
            <span class="dateTime">${formatDate(entry.dateTime)}</span>
            <button class="delete" data-id=${entries.indexOf(entry)}>Delete</button>
        `;

        historyDiv.appendChild(entryElement);
    });
}

moodForm.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.name === 'mood') {
        const selectedMoodButton = e.target;
        document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => {
            button.classList.remove('selected');
        });
        selectedMoodButton.classList.add('selected');
    }
});

moodForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const moodButtons = document.querySelectorAll('#moodForm .mood-buttons button.selected');
    let selectedMood = null;

    if (moodButtons.length > 0) {
        selectedMood = moodButtons[0].value;
    } else {
        alert('Please select a mood.');
        return;
    }

    const notes = document.getElementById('notes').value.trim();
    const dateTime = document.getElementById('dateTime').value || new Date().toISOString();

    if (!selectedMood) {
        alert('Please select a mood.');
        return;
    }

    const entry = { mood: selectedMood, notes, dateTime };
    let entries = getLocalStorageData();
    entries.push(entry);
    setLocalStorageData(entries);

    renderHistory();
    moodForm.reset();
    document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => button.classList.remove('selected'));
});

historyDiv.addEventListener('click', (e) => {
    if (e.target && e.target.className === 'delete') {
        const entries = getLocalStorageData();
        const id = parseInt(e.target.getAttribute('data-id'));
        entries.splice(id, 1);
        setLocalStorageData(entries);

        renderHistory();
    }
});

renderHistory();
