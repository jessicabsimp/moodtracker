// Initial Data Renders
renderHistory();
renderMedLogs();
renderJournalEntries();
updateAnalytics();

// Phase 5: Spotify Connect Placeholder Action
const connectSpotifyBtn = document.getElementById('connectSpotifyBtn');
if (connectSpotifyBtn) {
    connectSpotifyBtn.addEventListener('click', () => {
        alert('Spotify OAuth Flow (Phase 5) will be initialized here.');
    });
}