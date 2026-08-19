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
            <button class="delete" data-id="${entries.indexOf(entry)}">Delete</button>
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

    const entry = { mood: selectedMood, notes, dateTime };
    let entries = getLocalStorageData();
    entries.push(entry);
    setLocalStorageData(entries);

    renderHistory();
    moodForm.reset();
    document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => button.classList.remove('selected'));
});

historyDiv.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete')) {
        const entries = getLocalStorageData();
        const id = parseInt(e.target.getAttribute('data-id'));
        entries.splice(id, 1);
        setLocalStorageData(entries);

        renderHistory();
    }
});

renderHistory();

// Medication Tracker Logic
const medModal = document.getElementById('medModal');
const closeModal = document.querySelector('.close');
const medForm = document.getElementById('medForm');
const simulateBtn = document.getElementById('simulateNFC');
const medLogHistory = document.getElementById('med-log-history');

function openMedModal() {
  if (medModal) medModal.style.display = 'block';
}

if (simulateBtn) simulateBtn.addEventListener('click', openMedModal);
if (closeModal) closeModal.addEventListener('click', () => medModal.style.display = 'none');

window.addEventListener('click', (e) => {
  if (e.target === medModal) medModal.style.display = 'none';
});

// Handle NFC Web API Scan
if ('NDEFReader' in window) {
  try {
    const reader = new NDEFReader();
    reader.scan().then(() => {
      reader.ondiscovered = () => openMedModal();
    });
  } catch (error) {
    console.log("NFC permission/device unsupported.");
  }
}

if (medForm) {
  medForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const timeRadio = document.querySelector('input[name="time"]:checked');
    if (!timeRadio) return;
    
    const timeOfDay = timeRadio.value;
    const timestamp = new Date().toISOString();

    const logs = JSON.parse(localStorage.getItem('medicationLogs') || '[]');
    logs.push({ timeOfDay, timestamp });
    localStorage.setItem('medicationLogs', JSON.stringify(logs));

    medModal.style.display = 'none';
    renderMedLogs();
  });
}

function renderMedLogs() {
  const logContainer = document.getElementById('med-log-history');
  if (!logContainer) return;
  
  const logs = JSON.parse(localStorage.getItem('medicationLogs') || '[]');
  logContainer.innerHTML = '';

  if (logs.length === 0) {
    logContainer.innerHTML = '<p class="empty-state" style="color:var(--secondary-text); font-size:0.85rem;">No doses logged today.</p>';
    return;
  }

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach((log, index) => {
    const date = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.innerHTML = `
      <span><strong>${log.timeOfDay}</strong> meds taken at ${date}</span>
      <button class="delete-med" data-index="${index}">Delete</button>
    `;
    logContainer.appendChild(logItem);
  });
}

// Delete Medication Log Handler
if (medLogHistory) {
  medLogHistory.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete-med')) {
      const index = parseInt(e.target.getAttribute('data-index'));
      let logs = JSON.parse(localStorage.getItem('medicationLogs') || '[]');
      
      // Sort array to match rendering order before deletion
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      logs.splice(index, 1);
      
      localStorage.setItem('medicationLogs', JSON.stringify(logs));
      renderMedLogs();
    }
  });
}

// Initial render
renderMedLogs();