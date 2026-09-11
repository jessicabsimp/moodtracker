// Shared utilities for hash-routed subpages.

function phaseShowPageError(title, error, retry) {
    const detail = error?.message || 'An unexpected error occurred.';
    pageContent.innerHTML = `
        <div class="phase-page-error">
            <strong>${phaseEscapeHtml(title)}</strong>
            <p>${phaseEscapeHtml(detail)}</p>
            <button type="button" class="save-btn" id="phasePageRetry">Try again</button>
        </div>`;

    const retryButton = document.getElementById('phasePageRetry');
    if (retryButton && typeof retry === 'function') {
        retryButton.addEventListener('click', retry, { once: true });
    }
}
