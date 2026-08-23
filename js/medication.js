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
        await updateAnalytics();
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