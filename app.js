// Initialize Supabase Client
const SUPABASE_URL = 'https://exghnybsjhxnmydktqch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Z2hueWJzamh4bm15ZGt0cWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDAyNDMsImV4cCI6MjEwMzAxNjI0M30.Xz9OEWkUy1RRYR8hxLkGJFnxBUvyZLLV-J89v5emIco';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const moodForm = document.getElementById('moodForm');
const historyDiv = document.getElementById('history');

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Fetch and Render Mood Entries from Supabase
async function renderHistory() {
    const { data: entries, error } = await supabaseClient
        .from('mood_entries')
        .select('*')
        .order('date_time', { ascending: false });

    if (error) {
        console.error('Error fetching mood history:', error);
        return;
    }

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

// Mood Selection Listener
moodForm.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.name === 'mood') {
        const selectedMoodButton = e.target;
        document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => {
            button.classList.remove('selected');
        });
        selectedMoodButton.classList.add('selected');
    }
});

// Mood Form Submission Handler
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

    if (error) {
        console.error('Error saving mood entry:', error);
        return;
    }

    await renderHistory();
    moodForm.reset();
    document.querySelectorAll('#moodForm .mood-buttons button').forEach(button => button.classList.remove('selected'));
});

// Delete Mood Entry Handler
historyDiv.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete')) {
        const id = e.target.getAttribute('data-id');

        const { error } = await supabaseClient
            .from('mood_entries')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting mood entry:', error);
            return;
        }

        await renderHistory();
    }
});

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

// Handle Web NFC Scan API
if ('NDEFReader' in window) {
  try {
    const reader = new NDEFReader();
    reader.scan().then(() => {
      reader.ondiscovered = () => openMedModal();
    });
  } catch (error) {
    console.log("NFC permission or device unsupported.");
  }
}

// Medication Submission Handler
if (medForm) {
  medForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const timeRadio = document.querySelector('input[name="time"]:checked');
    if (!timeRadio) return;
    
    const timeOfDay = timeRadio.value;
    const timestamp = new Date().toISOString();

    const { error } = await supabaseClient
        .from('medication_logs')
        .insert([{ time_of_day: timeOfDay, timestamp: timestamp }]);

    if (error) {
        console.error('Error logging medication:', error);
        return;
    }

    medModal.style.display = 'none';
    await renderMedLogs();
  });
}

// Fetch and Render Medication Logs
async function renderMedLogs() {
  const logContainer = document.getElementById('med-log-history');
  if (!logContainer) return;

  const { data: logs, error } = await supabaseClient
      .from('medication_logs')
      .select('*')
      .order('timestamp', { ascending: false });

  if (error) {
      console.error('Error fetching medication logs:', error);
      return;
  }

  logContainer.innerHTML = '';

  if (!logs || logs.length === 0) {
    logContainer.innerHTML = '<p class="empty-state" style="color:var(--secondary-text); font-size:0.85rem;">No doses logged today.</p>';
    return;
  }

  logs.forEach((log) => {
    const date = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.innerHTML = `
      <span><strong>${log.time_of_day}</strong> meds taken at ${date}</span>
      <button class="delete-med" data-id="${log.id}">Delete</button>
    `;
    logContainer.appendChild(logItem);
  });
}

// Delete Medication Log Handler
if (medLogHistory) {
  medLogHistory.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('delete-med')) {
      const id = e.target.getAttribute('data-id');

      const { error } = await supabaseClient
          .from('medication_logs')
          .delete()
          .eq('id', id);

      if (error) {
          console.error('Error deleting medication log:', error);
          return;
      }

      await renderMedLogs();
    }
  });
}

// Initial Data Renders
renderHistory();
renderMedLogs();