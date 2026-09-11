const medModal = document.getElementById('medModal');
const closeModal = document.querySelector('.close');
const medForm = document.getElementById('medForm');
const simulateBtn = document.getElementById('simulateNFC');

function openMedModal() {
  if (medModal) medModal.style.display = 'flex';
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
        medForm.reset();
        await updateAnalytics();
    }
  });
}

