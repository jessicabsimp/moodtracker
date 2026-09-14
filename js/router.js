// ==========================================
// PHASE ROUTER
// ==========================================

const dashboardView =
    document.getElementById(
        'dashboard-view'
    );

const subpageView =
    document.getElementById(
        'subpage-view'
    );

const pageTitle =
    document.getElementById(
        'page-title'
    );

const pageContent =
    document.getElementById(
        'page-content'
    );


// ==========================================
// MAIN ROUTING
// ==========================================

async function handleRouting() {
    const hash =
        window.location.hash;


    updatePhaseNavState(
        hash
    );


    // ======================================
    // MEDICATION NFC / QUICK LOG
    // ======================================

    if (
        hash === '#log-dose'
    ) {
        dashboardView.style.display =
            'block';

        subpageView.style.display =
            'none';

        const medModal =
            document.getElementById(
                'medModal'
            );

        if (medModal) {
            medModal.style.display =
                'flex';
        }

        return;
    }


    // ======================================
    // HOME
    // ======================================

    if (
        !hash ||
        hash === '#'
    ) {
        dashboardView.style.display =
            'block';

        subpageView.style.display =
            'none';

        return;
    }


    // ======================================
    // SUBPAGE FRAME
    // ======================================

    dashboardView.style.display =
        'none';

    subpageView.style.display =
        'block';

    pageContent.innerHTML = `
        <p class="phase-page-state">
            Loading…
        </p>
    `;


    // ======================================
    // SLEEP CHECK-IN
    // ======================================

    if (
        hash === '#sleep'
    ) {
        pageTitle.textContent =
            'Sleep';

        if (
            typeof renderSleepCheckInPage ===
            'function'
        ) {
            await renderSleepCheckInPage();
        } else {
            phaseShowSimpleError(
                'Sleep is not available yet.'
            );
        }

        return;
    }


    // ======================================
    // MORE / UTILITY HUB
    // ======================================

    if (
        hash === '#more'
    ) {
        pageTitle.textContent =
            'More';

        await renderMoreHub();

        return;
    }


    // ======================================
    // MOOD HISTORY
    // ======================================

    if (
        hash === '#mood'
    ) {
        pageTitle.textContent =
            'Mood History';

        await renderFullMoodList();

        return;
    }


    // ======================================
    // MEDICATION HISTORY
    // ======================================

    if (
        hash === '#medication'
    ) {
        pageTitle.textContent =
            'Medication History';

        await renderMedicationHistory();

        return;
    }


    // ======================================
    // SLEEP HISTORY
    // ======================================

    if (
        hash === '#sleep-history'
    ) {
        pageTitle.textContent =
            'Sleep History';

        if (
            typeof renderSleepHistory ===
            'function'
        ) {
            await renderSleepHistory();
        } else {
            phaseShowSimpleError(
                'Sleep history is not available yet.'
            );
        }

        return;
    }


    // ======================================
    // INSIGHTS
    // ======================================

    if (
        hash === '#analytics'
    ) {
        pageTitle.textContent =
            'Personal Insights & Analytics';

        if (
            typeof renderFullAnalyticsPage ===
            'function'
        ) {
            await renderFullAnalyticsPage(
                30
            );
        } else {
            phaseShowSimpleError(
                'Insights are not available.'
            );
        }

        return;
    }


    // ======================================
    // MUSIC
    // ======================================

    if (
        hash === '#music'
    ) {
        pageTitle.textContent =
            'Music & Audio Insights';

        if (
            typeof renderMusicInsightsSubpage ===
            'function'
        ) {
            await renderMusicInsightsSubpage();
        } else {
            phaseShowSimpleError(
                'Music insights are not available.'
            );
        }

        return;
    }


    // ======================================
    // UNKNOWN ROUTE
    // ======================================

    pageTitle.textContent =
        'Phase';

    pageContent.innerHTML = `
        <div class="phase-page-state">
            That page doesn't exist.
            <br><br>
            <a
                href="#"
                class="save-btn"
                style="text-decoration:none;"
            >
                Return to Phase
            </a>
        </div>
    `;
}


// ==========================================
// NAV ACTIVE STATE
// ==========================================

function updatePhaseNavState(
    hash
) {
    const normalizedHash =
        hash || '#';


    document
        .querySelectorAll(
            '.phase-nav .nav-link'
        )
        .forEach(link => {
            const href =
                link.getAttribute(
                    'href'
                );

            let isActive =
                false;


            if (
                normalizedHash === '#' &&
                href === '#'
            ) {
                isActive =
                    true;
            }


            if (
                href === '#analytics' &&
                normalizedHash ===
                    '#analytics'
            ) {
                isActive =
                    true;
            }


            if (
                href === '#music' &&
                normalizedHash ===
                    '#music'
            ) {
                isActive =
                    true;
            }


            // All utility/history pages live
            // conceptually under More.
            if (
                href === '#more' &&
                [
                    '#more',
                    '#mood',
                    '#medication',
                    '#sleep',
                    '#sleep-history'
                ].includes(
                    normalizedHash
                )
            ) {
                isActive =
                    true;
            }


            link.classList.toggle(
                'active',
                isActive
            );
        });
}


// ==========================================
// MORE / UTILITY HUB
// ==========================================

async function renderMoreHub() {
    let moodCount = null;
    let medicationCount = null;
    let sleepCount = null;

    let spotifyConnected =
        !!localStorage.getItem(
            'spotify_access_token'
        );


    try {
        const [
            moodResult,
            medicationResult,
            sleepResult
        ] =
            await Promise.all([
                supabaseClient
                    .from(
                        'mood_entries'
                    )
                    .select(
                        'id',
                        {
                            count:
                                'exact',

                            head:
                                true
                        }
                    ),

                supabaseClient
                    .from(
                        'medication_log'
                    )
                    .select(
                        'id',
                        {
                            count:
                                'exact',

                            head:
                                true
                        }
                    ),

                supabaseClient
                    .from(
                        'sleep_sessions'
                    )
                    .select(
                        'id',
                        {
                            count:
                                'exact',

                            head:
                                true
                        }
                    )
            ]);


        if (
            !moodResult.error
        ) {
            moodCount =
                moodResult.count;
        }


        if (
            !medicationResult.error
        ) {
            medicationCount =
                medicationResult.count;
        }


        if (
            !sleepResult.error
        ) {
            sleepCount =
                sleepResult.count;
        }

    } catch (error) {
        console.warn(
            'More hub counts could not be loaded:',
            error
        );
    }


    pageContent.innerHTML = `
        <div class="phase-more-hub">

            <div class="phase-page-intro">

                <span class="prompt-title">
                    HISTORY & UTILITIES
                </span>

                <p>
                    Review individual signals,
                    manage connections, and access
                    Phase tools.
                </p>

            </div>


            <div class="phase-utility-grid">


                <!-- Mood History -->

                <a
                    href="#mood"
                    class="phase-utility-card mood"
                >

                    <div class="phase-utility-icon">
                        ●
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            HISTORY
                        </span>

                        <strong>
                            Mood
                        </strong>

                        <p>
                            Review check-ins and
                            the context attached to
                            each moment.
                        </p>

                        ${
                            moodCount !==
                            null
                                ? `
                                    <span class="phase-utility-meta">
                                        ${moodCount}
                                        check-in${moodCount === 1 ? '' : 's'}
                                    </span>
                                `
                                : ''
                        }

                    </div>

                    <span class="phase-utility-arrow">
                        →
                    </span>

                </a>


                <!-- Medication History -->

                <a
                    href="#medication"
                    class="phase-utility-card medication"
                >

                    <div class="phase-utility-icon">
                        💊
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            HISTORY
                        </span>

                        <strong>
                            Medication
                        </strong>

                        <p>
                            Review logged dose
                            events and timestamps.
                        </p>

                        ${
                            medicationCount !==
                            null
                                ? `
                                    <span class="phase-utility-meta">
                                        ${medicationCount}
                                        log${medicationCount === 1 ? '' : 's'}
                                    </span>
                                `
                                : ''
                        }

                    </div>

                    <span class="phase-utility-arrow">
                        →
                    </span>

                </a>


                <!-- Sleep History -->

                <a
                    href="#sleep-history"
                    class="phase-utility-card sleep"
                >

                    <div class="phase-utility-icon">
                        ◐
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            HISTORY
                        </span>

                        <strong>
                            Sleep
                        </strong>

                        <p>
                            Review sleep windows,
                            quality, and rested
                            ratings.
                        </p>

                        ${
                            sleepCount !==
                            null
                                ? `
                                    <span class="phase-utility-meta">
                                        ${sleepCount}
                                        window${sleepCount === 1 ? '' : 's'}
                                    </span>
                                `
                                : ''
                        }

                    </div>

                    <span class="phase-utility-arrow">
                        →
                    </span>

                </a>


                <!-- Sleep Quick Access -->

                <a
                    href="#sleep"
                    class="phase-utility-card sleep-action"
                >

                    <div class="phase-utility-icon">
                        ☾
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            QUICK ACTION
                        </span>

                        <strong>
                            Sleep check-in
                        </strong>

                        <p>
                            Start or close your
                            current sleep window.
                        </p>

                    </div>

                    <span class="phase-utility-arrow">
                        →
                    </span>

                </a>


                <!-- Spotify -->

                <div
                    class="phase-utility-card listening connection-card"
                >

                    <div class="phase-utility-icon">
                        🎧
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            CONNECTION
                        </span>

                        <strong>
                            Spotify
                        </strong>

                        <p>
                            ${
                                spotifyConnected
                                    ? 'Listening data is connected and available to Phase.'
                                    : 'Connect Spotify to add listening behavior to your Phase.'
                            }
                        </p>

                        <span class="phase-utility-meta">
                            ${
                                spotifyConnected
                                    ? 'Connected'
                                    : 'Not connected'
                            }
                        </span>

                    </div>

                    ${
                        spotifyConnected
                            ? `
                                <a
                                    href="#music"
                                    class="phase-utility-inline-action"
                                >
                                    View →
                                </a>
                            `
                            : `
                                <button
                                    type="button"
                                    id="moreSpotifyConnectBtn"
                                    class="phase-utility-inline-action"
                                >
                                    Connect
                                </button>
                            `
                    }

                </div>


                <!-- Data / Architecture -->

                <div
                    class="phase-utility-card neutral"
                >

                    <div class="phase-utility-icon">
                        ◫
                    </div>

                    <div class="phase-utility-copy">

                        <span class="phase-utility-label">
                            DATA
                        </span>

                        <strong>
                            Phase data
                        </strong>

                        <p>
                            Export and account
                            controls will live here
                            when user accounts are
                            added.
                        </p>

                        <span class="phase-utility-meta">
                            Coming later
                        </span>

                    </div>

                </div>

            </div>

        </div>
    `;


    const moreSpotifyButton =
        document.getElementById(
            'moreSpotifyConnectBtn'
        );


    if (moreSpotifyButton) {
        moreSpotifyButton
            .addEventListener(
                'click',
                async () => {
                    const dashboardButton =
                        document.getElementById(
                            'connectSpotifyBtn'
                        );


                    if (
                        dashboardButton
                    ) {
                        dashboardButton.click();

                        return;
                    }


                    if (
                        typeof redirectToSpotifyLogin ===
                        'function'
                    ) {
                        await redirectToSpotifyLogin();

                        return;
                    }


                    alert(
                        'Spotify connection could not be started.'
                    );
                }
            );
    }
}


// ==========================================
// MOOD HISTORY
// ==========================================

async function renderFullMoodList() {
    pageContent.innerHTML = `
        <div class="phase-page-state">
            Loading mood history…
        </div>
    `;


    const {
        data: entries,
        error
    } =
        await supabaseClient
            .from(
                'mood_entries'
            )
            .select('*')
            .order(
                'date_time',
                {
                    ascending:
                        false
                }
            );


    if (error) {
        console.error(
            'Mood history failed:',
            error
        );

        phaseShowSimpleError(
            'Mood history could not be loaded.'
        );

        return;
    }


    if (
        !entries ||
        entries.length === 0
    ) {
        pageContent.innerHTML = `
            <div class="phase-empty-history">

                <strong>
                    No mood check-ins yet
                </strong>

                <p>
                    Mood observations will appear
                    here after you record them.
                </p>

                <a
                    href="#"
                    class="save-btn"
                    style="text-decoration:none;"
                >
                    Add a check-in
                </a>

            </div>
        `;

        return;
    }


    pageContent.innerHTML = `
        <div class="phase-history-list">

            ${entries.map(
                entry => `
                    <article
                        class="phase-history-item mood-history-item"
                    >

                        <div class="phase-history-main">

                            <span
                                class="mood ${phaseEscapeHtml(
                                    String(
                                        entry.mood ||
                                        ''
                                    )
                                        .toLowerCase()
                                )}"
                            >
                                ${phaseEscapeHtml(
                                    entry.mood ||
                                    'Mood'
                                )}
                            </span>

                            ${
                                entry.notes
                                    ? `
                                        <p class="phase-history-note">
                                            ${phaseEscapeHtml(
                                                entry.notes
                                            )}
                                        </p>
                                    `
                                    : ''
                            }

                            <span class="phase-history-date">
                                ${formatDate(
                                    entry.date_time
                                )}
                            </span>

                        </div>

                        <button
                            class="delete-btn"
                            data-id="${entry.id}"
                            data-type="mood"
                            type="button"
                        >
                            Delete
                        </button>

                    </article>
                `
            ).join('')}

        </div>
    `;
}


// ==========================================
// MEDICATION HISTORY
// ==========================================

async function renderMedicationHistory() {
    pageContent.innerHTML = `
        <div class="phase-page-state">
            Loading medication history…
        </div>
    `;


    const {
        data: logs,
        error
    } =
        await supabaseClient
            .from(
                'medication_log'
            )
            .select('*')
            .order(
                'timestamp',
                {
                    ascending:
                        false
                }
            );


    if (error) {
        console.error(
            'Medication history failed:',
            error
        );

        phaseShowSimpleError(
            'Medication history could not be loaded.'
        );

        return;
    }


    if (
        !logs ||
        logs.length === 0
    ) {
        pageContent.innerHTML = `
            <div class="phase-empty-history">

                <strong>
                    No medication logs yet
                </strong>

                <p>
                    Logged doses will appear here.
                </p>

                <a
                    href="#log-dose"
                    class="save-btn"
                    style="text-decoration:none;"
                >
                    Log a dose
                </a>

            </div>
        `;

        return;
    }


    pageContent.innerHTML = `
        <div class="phase-history-list">

            ${logs.map(
                log => `
                    <article
                        class="phase-history-item medication-history-item"
                    >

                        <div class="phase-history-main">

                            <strong>
                                ${phaseEscapeHtml(
                                    log.time_of_day ||
                                    'Dose'
                                )}
                            </strong>

                            <span class="phase-history-date">
                                ${new Date(
                                    log.timestamp
                                ).toLocaleString()}
                            </span>

                        </div>

                        <button
                            class="delete-btn"
                            data-id="${log.id}"
                            data-type="medication"
                            type="button"
                        >
                            Delete
                        </button>

                    </article>
                `
            ).join('')}

        </div>
    `;
}


// ==========================================
// DELETE HISTORY EVENTS
// ==========================================

pageContent.addEventListener(
    'click',
    async event => {
        const button =
            event.target.closest(
                '.delete-btn'
            );


        if (!button) {
            return;
        }


        const id =
            button.getAttribute(
                'data-id'
            );

        const type =
            button.getAttribute(
                'data-type'
            );


        if (
            !id ||
            !type
        ) {
            return;
        }


        const confirmed =
            window.confirm(
                'Delete this entry?'
            );


        if (!confirmed) {
            return;
        }


        button.disabled =
            true;


        try {

            if (
                type ===
                'medication'
            ) {
                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            'medication_log'
                        )
                        .delete()
                        .eq(
                            'id',
                            id
                        );

                if (error) {
                    throw error;
                }

                await renderMedicationHistory();
            }


            if (
                type ===
                'mood'
            ) {
                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            'mood_entries'
                        )
                        .delete()
                        .eq(
                            'id',
                            id
                        );

                if (error) {
                    throw error;
                }

                await renderFullMoodList();
            }


            if (
                typeof updateAnalytics ===
                'function'
            ) {
                await updateAnalytics();
            }

        } catch (error) {
            console.error(
                'History entry could not be deleted:',
                error
            );

            alert(
                'Phase could not delete this entry.'
            );

            button.disabled =
                false;
        }
    }
);


// ==========================================
// SIMPLE ERROR FALLBACK
// ==========================================

function phaseShowSimpleError(
    message
) {
    pageContent.innerHTML = `
        <div class="phase-page-state">

            <p>
                ${phaseEscapeHtml(
                    message
                )}
            </p>

            <button
                type="button"
                class="save-btn"
                onclick="handleRouting()"
            >
                Try again
            </button>

        </div>
    `;
}


// ==========================================
// HASH LISTENER
// ==========================================

window.addEventListener(
    'hashchange',
    handleRouting
);