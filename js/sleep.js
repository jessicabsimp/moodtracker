// ==========================================
// PHASE SLEEP WINDOW ENGINE
// ==========================================
//
// Phase intentionally records a "Sleep Window":
// the time between deciding to go to bed and
// getting up / starting the day.
//
// This is NOT presented as measured sleep duration.
//
// Future sources may include:
// - NFC / manual
// - Apple Health
// - Android Health Connect
// ==========================================


const PHASE_SLEEP_MOODS = [
    'Great',
    'Good',
    'Okay',
    'Bad',
    'Terrible'
];

const PHASE_SLEEP_SOURCE = 'nfc';


// ==========================================
// DATE / DURATION HELPERS
// ==========================================

function phaseSleepFormatTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    });
}


function phaseSleepFormatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}


function phaseSleepFormatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}


function phaseSleepDurationMinutes(startValue, endValue) {
    if (!startValue || !endValue) {
        return null;
    }

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return null;
    }

    const minutes =
        Math.round(
            (end.getTime() - start.getTime()) /
            60000
        );

    return minutes >= 0
        ? minutes
        : null;
}


function phaseSleepFormatDuration(minutes) {
    if (
        minutes === null ||
        minutes === undefined ||
        !Number.isFinite(minutes)
    ) {
        return '—';
    }

    const rounded =
        Math.max(0, Math.round(minutes));

    const hours =
        Math.floor(rounded / 60);

    const remainingMinutes =
        rounded % 60;

    if (hours === 0) {
        return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
}


// ==========================================
// SLEEP SESSION DATA
// ==========================================

async function phaseGetOpenSleepSession() {
    const {
        data,
        error
    } = await supabaseClient
        .from('sleep_sessions')
        .select('*')
        .is('wake_time', null)
        .order('bedtime', {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


async function phaseGetLatestSleepSession() {
    const {
        data,
        error
    } = await supabaseClient
        .from('sleep_sessions')
        .select('*')
        .order('bedtime', {
            ascending: false
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data || null;
}


async function phaseLoadSleepSessions(
    daysCount = 30
) {
    const days =
        Number.isFinite(Number(daysCount))
            ? Math.max(
                1,
                Number(daysCount)
            )
            : 30;

    const start = new Date();

    start.setDate(
        start.getDate() - (days - 1)
    );

    start.setHours(
        0,
        0,
        0,
        0
    );

    const {
        data,
        error
    } = await supabaseClient
        .from('sleep_sessions')
        .select('*')
        .gte(
            'bedtime',
            start.toISOString()
        )
        .order(
            'bedtime',
            {
                ascending: true
            }
        );

    if (error) {
        throw error;
    }

    return data || [];
}


// ==========================================
// SCREEN STATE
// ==========================================

function phaseSleepSuggestedScreen(
    openSession = null,
    now = new Date()
) {
    // Session state always outranks clock time.
    //
    // If Phase knows we went to bed,
    // the next scan means we're getting up.
    if (openSession) {
        return 'morning';
    }

    const hour =
        now.getHours();

    // Default NFC behavior:
    //
    // Midnight – 1:59 AM:
    // assume this is still the bedtime side
    // of the night.
    //
    // 2:00 AM – 11:59 AM:
    // assume morning.
    //
    // Noon onward:
    // assume the next use is bedtime.
    //
    // Importantly, this is only a UI default.
    // The user can always switch manually.
    if (
        hour >= 2 &&
        hour < 12
    ) {
        return 'morning';
    }

    return 'bedtime';
}


// ==========================================
// MOOD HELPER
// ==========================================

async function phaseSaveBedtimeMood(
    mood,
    note,
    timestamp
) {
    if (
        !mood ||
        !PHASE_SLEEP_MOODS.includes(mood)
    ) {
        return;
    }

    const {
        error
    } = await supabaseClient
        .from('mood_entries')
        .insert([
            {
                mood,
                notes:
                    note
                        ? note
                        : '',
                date_time: timestamp
            }
        ]);

    if (error) {
        throw error;
    }
}


// ==========================================
// START SLEEP WINDOW
// ==========================================

async function phaseStartSleepWindow({
    mood = null,
    note = '',
    source = PHASE_SLEEP_SOURCE
} = {}) {
    const existingSession =
        await phaseGetOpenSleepSession();

    if (existingSession) {
        throw new Error(
            'A sleep window is already open.'
        );
    }

    const timestamp =
        new Date().toISOString();

    const safeMood =
        PHASE_SLEEP_MOODS.includes(mood)
            ? mood
            : null;

    const {
        data,
        error
    } = await supabaseClient
        .from('sleep_sessions')
        .insert([
            {
                bedtime: timestamp,
                bedtime_mood: safeMood,
                bedtime_note:
                    note?.trim() || null,
                source
            }
        ])
        .select()
        .single();

    if (error) {
        throw error;
    }

    // The optional bedtime mood also becomes
    // a normal Phase mood observation.
    //
    // This means sleep does not create a second,
    // disconnected mood system.
    if (safeMood) {
        try {
            await phaseSaveBedtimeMood(
                safeMood,
                note?.trim() || '',
                timestamp
            );
        } catch (moodError) {
            console.warn(
                'Sleep window was saved, but bedtime mood could not be added to mood history:',
                moodError
            );
        }
    }

    if (
        typeof updateAnalytics ===
        'function'
    ) {
        try {
            await updateAnalytics();
        } catch (analyticsError) {
            console.warn(
                'Sleep window saved, but dashboard analytics could not refresh:',
                analyticsError
            );
        }
    }

    return data;
}


// ==========================================
// CLOSE SLEEP WINDOW
// ==========================================

async function phaseCloseSleepWindow(
    sessionId,
    {
        sleepQuality = null,
        restedRating = null
    } = {}
) {
    if (!sessionId) {
        throw new Error(
            'No sleep session was supplied.'
        );
    }

    const quality =
        Number(sleepQuality);

    const rested =
        Number(restedRating);

    if (
        !Number.isInteger(quality) ||
        quality < 1 ||
        quality > 5
    ) {
        throw new Error(
            'Please choose a sleep quality from 1 to 5.'
        );
    }

    const validRested =
        Number.isInteger(rested) &&
        rested >= 1 &&
        rested <= 5
            ? rested
            : null;

    const wakeTime =
        new Date().toISOString();

    const {
        data,
        error
    } = await supabaseClient
        .from('sleep_sessions')
        .update({
            wake_time: wakeTime,
            sleep_quality: quality,
            rested_rating: validRested
        })
        .eq(
            'id',
            sessionId
        )
        .is(
            'wake_time',
            null
        )
        .select()
        .single();

    if (error) {
        throw error;
    }

    if (
        typeof updateAnalytics ===
        'function'
    ) {
        try {
            await updateAnalytics();
        } catch (analyticsError) {
            console.warn(
                'Sleep window closed, but dashboard analytics could not refresh:',
                analyticsError
            );
        }
    }

    return data;
}


// ==========================================
// BEDTIME VIEW
// ==========================================

function phaseSleepBedtimeMarkup() {
    return `
        <div class="sleep-checkin sleep-bedtime-view">

            <div class="sleep-hero">
                <div class="sleep-hero-icon">
                    🌙
                </div>

                <span class="prompt-title">
                    SLEEP WINDOW
                </span>

                <h2>
                    Sweet Dreams
                </h2>

                <p>
                    Mark when you're settling in for the night.
                    Phase will use this time as the beginning of
                    your sleep window.
                </p>
            </div>

            <div class="sleep-time-display">
                <span>
                    Going to bed
                </span>

                <strong id="sleepCurrentTime">
                    ${phaseSleepFormatTime(new Date())}
                </strong>
            </div>

            <form id="sleepBedtimeForm">

                <div class="sleep-form-section">
                    <label class="sleep-field-label">
                        How are you feeling?
                        <span>Optional</span>
                    </label>

                    <div
                        class="mood-buttons sleep-mood-buttons"
                        id="sleepMoodButtons"
                    >
                        ${PHASE_SLEEP_MOODS.map(
                            mood => `
                                <button
                                    type="button"
                                    class="mood-btn"
                                    data-sleep-mood="${mood}"
                                >
                                    ${mood}
                                </button>
                            `
                        ).join('')}
                    </div>
                </div>

                <div class="sleep-form-section notes">
                    <label
                        class="sleep-field-label"
                        for="sleepBedtimeNote"
                    >
                        Anything affecting this check-in?
                        <span>Optional</span>
                    </label>

                    <textarea
                        id="sleepBedtimeNote"
                        rows="3"
                        placeholder="Add optional context..."
                    ></textarea>
                </div>

                <button
                    type="submit"
                    class="save-btn sleep-primary-action"
                    id="startSleepWindowBtn"
                >
                    I'm going to bed
                </button>

            </form>

            <button
                type="button"
                class="sleep-mode-switch"
                id="switchToMorningBtn"
            >
                ☀️ I'm actually getting up
            </button>

            <p class="sleep-definition-note">
                Phase records a sleep window, not measured
                time asleep.
            </p>

        </div>
    `;
}


// ==========================================
// MORNING VIEW
// ==========================================

function phaseSleepMorningMarkup(
    openSession
) {
    if (!openSession) {
        return phaseSleepNoOpenSessionMarkup();
    }

    const now =
        new Date();

    const elapsed =
        phaseSleepDurationMinutes(
            openSession.bedtime,
            now
        );

    return `
        <div class="sleep-checkin sleep-morning-view">

            <div class="sleep-hero">
                <div class="sleep-hero-icon">
                    ☀️
                </div>

                <span class="prompt-title">
                    SLEEP WINDOW
                </span>

                <h2>
                    Good Morning
                </h2>

                <p>
                    Tell Phase how the night felt before
                    you start your day.
                </p>
            </div>

            <div class="sleep-window-summary">

                <div>
                    <span>
                        Went to bed
                    </span>

                    <strong>
                        ${phaseSleepFormatTime(
                            openSession.bedtime
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Getting up
                    </span>

                    <strong id="sleepCurrentTime">
                        ${phaseSleepFormatTime(now)}
                    </strong>
                </div>

                <div class="sleep-window-duration">
                    <span>
                        Sleep Window
                    </span>

                    <strong id="sleepWindowPreview">
                        ${phaseSleepFormatDuration(
                            elapsed
                        )}
                    </strong>
                </div>

            </div>

            <form id="sleepMorningForm">

                <input
                    type="hidden"
                    id="sleepSessionId"
                    value="${phaseEscapeHtml(
                        openSession.id
                    )}"
                >

                <div class="sleep-form-section">
                    <label class="sleep-field-label">
                        How was your sleep?
                    </label>

                    <div
                        class="sleep-rating-row"
                        id="sleepQualityButtons"
                    >
                        ${[1, 2, 3, 4, 5].map(
                            value => `
                                <button
                                    type="button"
                                    class="sleep-rating-btn"
                                    data-sleep-quality="${value}"
                                    aria-label="Sleep quality ${value} out of 5"
                                >
                                    <strong>${value}</strong>
                                    <span>
                                        ${
                                            value === 1
                                                ? 'Awful'
                                                : value === 2
                                                    ? 'Poor'
                                                    : value === 3
                                                        ? 'Okay'
                                                        : value === 4
                                                            ? 'Good'
                                                            : 'Great'
                                        }
                                    </span>
                                </button>
                            `
                        ).join('')}
                    </div>
                </div>

                <div class="sleep-form-section">
                    <label class="sleep-field-label">
                        How rested do you feel?
                        <span>Optional</span>
                    </label>

                    <div
                        class="sleep-rating-row sleep-rested-row"
                        id="sleepRestedButtons"
                    >
                        ${[1, 2, 3, 4, 5].map(
                            value => `
                                <button
                                    type="button"
                                    class="sleep-rating-btn"
                                    data-rested-rating="${value}"
                                    aria-label="Rested rating ${value} out of 5"
                                >
                                    ${value}
                                </button>
                            `
                        ).join('')}
                    </div>
                </div>

                <button
                    type="submit"
                    class="save-btn sleep-primary-action"
                    id="closeSleepWindowBtn"
                >
                    Start my day
                </button>

            </form>

            <button
                type="button"
                class="sleep-mode-switch"
                id="switchToBedtimeBtn"
            >
                🌙 I'm actually going to bed
            </button>

            <p class="sleep-definition-note">
                Sleep Window measures time between your
                bedtime and morning check-ins. It does not
                claim that you were asleep for this entire
                period.
            </p>

        </div>
    `;
}


// ==========================================
// MORNING FALLBACK
// ==========================================

function phaseSleepNoOpenSessionMarkup() {
    return `
        <div class="sleep-checkin sleep-morning-view">

            <div class="sleep-hero">
                <div class="sleep-hero-icon">
                    ☀️
                </div>

                <span class="prompt-title">
                    SLEEP WINDOW
                </span>

                <h2>
                    Good Morning
                </h2>

                <p>
                    Phase doesn't have an open sleep window
                    from last night, so there isn't a bedtime
                    timestamp to close.
                </p>
            </div>

            <div class="sleep-missing-window">
                <strong>
                    No bedtime check-in found
                </strong>

                <p>
                    Nothing has been recorded. If you're
                    actually heading to bed now, switch modes
                    below.
                </p>
            </div>

            <button
                type="button"
                class="sleep-mode-switch sleep-mode-switch-primary"
                id="switchToBedtimeBtn"
            >
                🌙 I'm going to bed instead
            </button>

        </div>
    `;
}


// ==========================================
// PAGE RENDERING
// ==========================================

async function renderSleepCheckInPage(
    forcedMode = null
) {
    if (
        typeof pageContent ===
        'undefined' ||
        !pageContent
    ) {
        console.error(
            'Sleep page could not render because pageContent is unavailable.'
        );

        return;
    }

    if (
        typeof pageTitle !==
        'undefined' &&
        pageTitle
    ) {
        pageTitle.textContent =
            'Sleep';
    }

    pageContent.innerHTML = `
        <div class="phase-page-state">
            Checking your sleep window…
        </div>
    `;

    try {
        const openSession =
            await phaseGetOpenSleepSession();

        const mode =
            forcedMode ||
            phaseSleepSuggestedScreen(
                openSession
            );

        if (mode === 'morning') {
            pageContent.innerHTML =
                phaseSleepMorningMarkup(
                    openSession
                );

            phaseBindMorningSleepView(
                openSession
            );
        } else {
            pageContent.innerHTML =
                phaseSleepBedtimeMarkup();

            phaseBindBedtimeSleepView();
        }

        phaseStartSleepClock(
            openSession,
            mode
        );

    } catch (error) {
        console.error(
            'Unable to load sleep page:',
            error
        );

        if (
            typeof phaseShowPageError ===
            'function'
        ) {
            phaseShowPageError(
                'Sleep could not be loaded.',
                error,
                () =>
                    renderSleepCheckInPage(
                        forcedMode
                    )
            );
        } else {
            pageContent.innerHTML = `
                <p class="phase-page-state">
                    Sleep could not be loaded.
                </p>
            `;
        }
    }
}


// ==========================================
// BEDTIME INTERACTIONS
// ==========================================

function phaseBindBedtimeSleepView() {
    const form =
        document.getElementById(
            'sleepBedtimeForm'
        );

    const moodButtons =
        document.querySelectorAll(
            '[data-sleep-mood]'
        );

    const switchButton =
        document.getElementById(
            'switchToMorningBtn'
        );

    moodButtons.forEach(
        button => {
            button.addEventListener(
                'click',
                () => {
                    const wasSelected =
                        button.classList.contains(
                            'selected'
                        );

                    moodButtons.forEach(
                        item =>
                            item.classList.remove(
                                'selected'
                            )
                    );

                    if (!wasSelected) {
                        button.classList.add(
                            'selected'
                        );
                    }
                }
            );
        }
    );

    if (switchButton) {
        switchButton.addEventListener(
            'click',
            () =>
                renderSleepCheckInPage(
                    'morning'
                )
        );
    }

    if (!form) {
        return;
    }

    form.addEventListener(
        'submit',
        async event => {
            event.preventDefault();

            const submitButton =
                document.getElementById(
                    'startSleepWindowBtn'
                );

            const selectedMood =
                document.querySelector(
                    '[data-sleep-mood].selected'
                );

            const note =
                document.getElementById(
                    'sleepBedtimeNote'
                )?.value
                    ?.trim() || '';

            if (submitButton) {
                submitButton.disabled =
                    true;

                submitButton.textContent =
                    'Starting sleep window…';
            }

            try {
                await phaseStartSleepWindow({
                    mood:
                        selectedMood
                            ?.dataset
                            ?.sleepMood ||
                        null,
                    note,
                    source:
                        PHASE_SLEEP_SOURCE
                });

                await renderSleepCheckInPage(
                    'morning'
                );

            } catch (error) {
                console.error(
                    'Unable to start sleep window:',
                    error
                );

                alert(
                    error?.message ||
                    'Phase could not start your sleep window.'
                );

                if (submitButton) {
                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        "I'm going to bed";
                }
            }
        }
    );
}


// ==========================================
// MORNING INTERACTIONS
// ==========================================

function phaseBindMorningSleepView(
    openSession
) {
    const form =
        document.getElementById(
            'sleepMorningForm'
        );

    const qualityButtons =
        document.querySelectorAll(
            '[data-sleep-quality]'
        );

    const restedButtons =
        document.querySelectorAll(
            '[data-rested-rating]'
        );

    const switchButton =
        document.getElementById(
            'switchToBedtimeBtn'
        );

    qualityButtons.forEach(
        button => {
            button.addEventListener(
                'click',
                () => {
                    qualityButtons.forEach(
                        item =>
                            item.classList.remove(
                                'selected'
                            )
                    );

                    button.classList.add(
                        'selected'
                    );
                }
            );
        }
    );

    restedButtons.forEach(
        button => {
            button.addEventListener(
                'click',
                () => {
                    const wasSelected =
                        button.classList.contains(
                            'selected'
                        );

                    restedButtons.forEach(
                        item =>
                            item.classList.remove(
                                'selected'
                            )
                    );

                    if (!wasSelected) {
                        button.classList.add(
                            'selected'
                        );
                    }
                }
            );
        }
    );

    if (switchButton) {
        switchButton.addEventListener(
            'click',
            () =>
                renderSleepCheckInPage(
                    'bedtime'
                )
        );
    }

    if (
        !form ||
        !openSession
    ) {
        return;
    }

    form.addEventListener(
        'submit',
        async event => {
            event.preventDefault();

            const selectedQuality =
                document.querySelector(
                    '[data-sleep-quality].selected'
                );

            const selectedRested =
                document.querySelector(
                    '[data-rested-rating].selected'
                );

            if (!selectedQuality) {
                alert(
                    'Choose a sleep quality before starting your day.'
                );

                return;
            }

            const submitButton =
                document.getElementById(
                    'closeSleepWindowBtn'
                );

            if (submitButton) {
                submitButton.disabled =
                    true;

                submitButton.textContent =
                    'Saving…';
            }

            try {
                const completed =
                    await phaseCloseSleepWindow(
                        openSession.id,
                        {
                            sleepQuality:
                                Number(
                                    selectedQuality
                                        .dataset
                                        .sleepQuality
                                ),

                            restedRating:
                                selectedRested
                                    ? Number(
                                        selectedRested
                                            .dataset
                                            .restedRating
                                    )
                                    : null
                        }
                    );

                pageContent.innerHTML =
                    phaseSleepCompletedMarkup(
                        completed
                    );

                phaseBindCompletedSleepView();

            } catch (error) {
                console.error(
                    'Unable to close sleep window:',
                    error
                );

                alert(
                    error?.message ||
                    'Phase could not save your morning check-in.'
                );

                if (submitButton) {
                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        'Start my day';
                }
            }
        }
    );
}


// ==========================================
// COMPLETED STATE
// ==========================================

function phaseSleepCompletedMarkup(
    session
) {
    const minutes =
        phaseSleepDurationMinutes(
            session.bedtime,
            session.wake_time
        );

    return `
        <div class="sleep-checkin sleep-complete-view">

            <div class="sleep-hero">
                <div class="sleep-hero-icon">
                    ◐
                </div>

                <span class="prompt-title">
                    SLEEP WINDOW SAVED
                </span>

                <h2>
                    Morning logged
                </h2>
            </div>

            <div class="sleep-window-summary sleep-window-complete">

                <div>
                    <span>
                        Went to bed
                    </span>

                    <strong>
                        ${phaseSleepFormatTime(
                            session.bedtime
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Got up
                    </span>

                    <strong>
                        ${phaseSleepFormatTime(
                            session.wake_time
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Sleep Window
                    </span>

                    <strong>
                        ${phaseSleepFormatDuration(
                            minutes
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Sleep quality
                    </span>

                    <strong>
                        ${
                            session.sleep_quality
                                ? `${session.sleep_quality}/5`
                                : '—'
                        }
                    </strong>
                </div>

                <div>
                    <span>
                        Rested
                    </span>

                    <strong>
                        ${
                            session.rested_rating
                                ? `${session.rested_rating}/5`
                                : '—'
                        }
                    </strong>
                </div>

            </div>

            <button
                type="button"
                class="save-btn sleep-primary-action"
                id="sleepDoneBtn"
            >
                Done
            </button>

            <p class="sleep-definition-note">
                Sleep Window reflects the time between
                your two check-ins, not measured time asleep.
            </p>

        </div>
    `;
}


function phaseBindCompletedSleepView() {
    const doneButton =
        document.getElementById(
            'sleepDoneBtn'
        );

    if (!doneButton) {
        return;
    }

    doneButton.addEventListener(
        'click',
        () => {
            window.location.hash = '';
        }
    );
}


// ==========================================
// LIVE CLOCK / WINDOW PREVIEW
// ==========================================

let phaseSleepClockInterval = null;


function phaseStartSleepClock(
    openSession,
    mode
) {
    if (phaseSleepClockInterval) {
        clearInterval(
            phaseSleepClockInterval
        );
    }

    const update =
        () => {
            const currentTime =
                document.getElementById(
                    'sleepCurrentTime'
                );

            if (currentTime) {
                currentTime.textContent =
                    phaseSleepFormatTime(
                        new Date()
                    );
            }

            if (
                mode === 'morning' &&
                openSession
            ) {
                const preview =
                    document.getElementById(
                        'sleepWindowPreview'
                    );

                if (preview) {
                    const minutes =
                        phaseSleepDurationMinutes(
                            openSession.bedtime,
                            new Date()
                        );

                    preview.textContent =
                        phaseSleepFormatDuration(
                            minutes
                        );
                }
            }
        };

    update();

    phaseSleepClockInterval =
        window.setInterval(
            update,
            30000
        );
}


// ==========================================
// SLEEP HISTORY
// ==========================================

async function renderSleepHistory() {
    if (
        typeof pageContent ===
        'undefined' ||
        !pageContent
    ) {
        return;
    }

    if (
        typeof pageTitle !==
        'undefined' &&
        pageTitle
    ) {
        pageTitle.textContent =
            'Sleep History';
    }

    pageContent.innerHTML = `
        <div class="phase-page-state">
            Loading sleep history…
        </div>
    `;

    try {
        const {
            data,
            error
        } = await supabaseClient
            .from('sleep_sessions')
            .select('*')
            .order(
                'bedtime',
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        const sessions =
            data || [];

        if (!sessions.length) {
            pageContent.innerHTML = `
                <p class="phase-page-state">
                    No sleep windows have been recorded yet.
                </p>
            `;

            return;
        }

        pageContent.innerHTML = `
            <div class="sleep-history-list">
                ${sessions.map(
                    session => {
                        const duration =
                            session.wake_time
                                ? phaseSleepDurationMinutes(
                                    session.bedtime,
                                    session.wake_time
                                )
                                : null;

                        return `
                            <article class="sleep-history-item">

                                <div class="sleep-history-heading">
                                    <div>
                                        <strong>
                                            ${phaseSleepFormatDate(
                                                session.bedtime
                                            )}
                                        </strong>

                                        <span>
                                            ${phaseSleepFormatTime(
                                                session.bedtime
                                            )}
                                            →
                                            ${
                                                session.wake_time
                                                    ? phaseSleepFormatTime(
                                                        session.wake_time
                                                    )
                                                    : 'Open'
                                            }
                                        </span>
                                    </div>

                                    <strong class="sleep-history-duration">
                                        ${
                                            session.wake_time
                                                ? phaseSleepFormatDuration(
                                                    duration
                                                )
                                                : 'In progress'
                                        }
                                    </strong>
                                </div>

                                <div class="sleep-history-details">
                                    <span>
                                        Quality:
                                        ${
                                            session.sleep_quality
                                                ? `${session.sleep_quality}/5`
                                                : '—'
                                        }
                                    </span>

                                    <span>
                                        Rested:
                                        ${
                                            session.rested_rating
                                                ? `${session.rested_rating}/5`
                                                : '—'
                                        }
                                    </span>
                                </div>

                            </article>
                        `;
                    }
                ).join('')}
            </div>
        `;

    } catch (error) {
        console.error(
            'Unable to load sleep history:',
            error
        );

        if (
            typeof phaseShowPageError ===
            'function'
        ) {
            phaseShowPageError(
                'Sleep history could not be loaded.',
                error,
                renderSleepHistory
            );
        }
    }
}


// ==========================================
// CLEANUP
// ==========================================

window.addEventListener(
    'hashchange',
    () => {
        if (
            window.location.hash !== '#sleep'
        ) {
            if (
                phaseSleepClockInterval
            ) {
                clearInterval(
                    phaseSleepClockInterval
                );

                phaseSleepClockInterval =
                    null;
            }
        }
    }
);


// ==========================================
// PUBLIC PHASE SLEEP API
// ==========================================
//
// These globals are intentional.
// router.js and analytics.js will use them
// in the next implementation stages.
// ==========================================

window.phaseGetOpenSleepSession =
    phaseGetOpenSleepSession;

window.phaseGetLatestSleepSession =
    phaseGetLatestSleepSession;

window.phaseLoadSleepSessions =
    phaseLoadSleepSessions;

window.phaseSleepDurationMinutes =
    phaseSleepDurationMinutes;

window.phaseSleepFormatDuration =
    phaseSleepFormatDuration;

window.renderSleepCheckInPage =
    renderSleepCheckInPage;

window.renderSleepHistory =
    renderSleepHistory;