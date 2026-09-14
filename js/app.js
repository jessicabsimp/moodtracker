let phaseAppStarted = false;

async function initializePhaseApp() {
    if (phaseAppStarted) return;
    phaseAppStarted = true;

    try {
        await initSpotifyAuth();

        if (
            typeof enrichPendingTracksWithReccoBeats ===
            'function'
        ) {
            await enrichPendingTracksWithReccoBeats();
        }

        await updateAnalytics();
        await handleRouting();
    } catch (error) {
        console.error(
            'Phase initialization failed:',
            error
        );
    }
}

document.addEventListener(
    'DOMContentLoaded',
    initializePhaseApp
);