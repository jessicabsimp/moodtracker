# Warm & Organic Health & Mood Dashboard

## Project Overview
A modern, responsive wellness dashboard built with vanilla JavaScript, HTML5, and CSS Grid. Features an earthy, warm cream visual aesthetic (`#F8F4EC`), persistent local storage, and modular cards designed for future API and hardware integrations.

---

## Core File Architecture
- `index.html`: Dashboard UI structure containing top feature cards, mood logging form, dynamic history list, medication status widget, journal prompts, and analytics view.
- `styles.css`: Responsive CSS Grid layout (`.dashboard-grid`), design variables (`--olive`, `--sage`, `--terracotta`, `--gold`), typography rules ('DM Serif Display' + 'Inter'), and botanical SVG accents.
- `app.js`: Application logic handling local storage persistence, dynamic DOM rendering, date/time formatting, and event handlers.
- `PROJECT.md`: Source of truth for project architecture, current state, and development roadmap.

---

## Current Design Tokens & Styling Rules
- **Background Palette**: Warm Cream (`#F8F4EC`), Card Shells (`#FFFDF8` with `20px` border-radius)
- **Accent Palette**: 
  - Olive: `#56613B`
  - Sage: `#A7AF8B`
  - Terracotta: `#C96F4A`
  - Gold: `#D8A646`
  - Dark Terracotta: `#8B4A3E`
- **Typography**: `DM Serif Display` (Headings) & `Inter` (Body/UI)
- **Layout Constraints**: Responsive CSS Grid. `#history` container constrained with `max-height: 200px` and `overflow-y: auto`.

---

## Technical Stack & State Management
- **Persistence**: Browser `localStorage` using JSON keys:
  - `moodEntries`: Array of `{ mood, notes, dateTime }`
  - `medicationLogs`: Array of `{ timeOfDay, timestamp }`
  - `journalEntries`: Array of `{ prompt, response, timestamp }`
- **DOM Targets**:
  - Mood Form: `#moodForm`, `.mood-buttons button`, `#notes`, `#dateTime`, `#history`
  - Medication Widget: `#medication-card`, `#med-log-history`, `#nfc-modal`
  - Journal Widget: `.prompt-box`, `.recent-entries`, `#journal-modal`
  - Analytics Widget: `.stats-grid`, `.stat-value`, `.trend-svg`

---

## Feature Roadmap (Ordered Logic)

### Phase 1: Core Foundation & Mood Tracking (COMPLETED)
- [x] Responsive bento grid layout and warm organic CSS theme.
- [x] Interactive mood selector buttons with persistent state selection.
- [x] Dynamic mood entry logging to `localStorage` with date/time formatting and notes.
- [x] Render history list with color-coded badges (`great`, `good`, `okay`, `bad`, `terrible`) and delete capability.
- [x] Inner scroll boundary (`max-height: 200px`) for entry history.

---

### Phase 2: Web NFC Medication Tracker (NEXT STEP)
*Logical Priority: Clean up local card interactions before external APIs.*
- [ ] **Remove Hardcoded List**: Strip static default medication lists from `index.html`.
- [ ] **NFC Tag Listener & Modal Trigger**:
  - Listen for Web NFC scan events (`NDEFReader`).
  - Fallback/testing trigger button for desktop debugging ("Simulate NFC Scan").
- [ ] **Logging Modal**:
  - Open a pop-up modal on scan asking for dose timing: `Morning`, `Lunch`, `Dinner`, or `Bedtime`.
  - Save log entry (`timeOfDay` + current timestamp) to `localStorage.medicationLogs`.
- [ ] **Card Display**:
  - Display clean timeline list: `"[Morning] meds taken at [8:15 AM, Oct 24]"`.

---

### Phase 3: Weekly Guided Journal & Prompts
*Logical Priority: Completes all local user-input modules before analytics/integrations.*
- [ ] **Journal Input Modal**:
  - Interactive "New Entry" button opening a reflective prompt popup.
- [ ] **Local Persistence**:
  - Save journal entries to `localStorage.journalEntries`.
- [ ] **Display Recent Entries**:
  - Render latest reflections dynamically inside the Journal card's `.recent-entries` container.

---

### Phase 4: Dynamic Analytics Engine
*Logical Priority: Relies on data collected in Phases 1, 2, and 3.*
- [ ] **Real-Time Calculations**:
  - Compute `Avg Mood` score dynamically from logged mood values.
  - Calculate `% Positive Days` (ratio of Great/Good logs over total logged days).
  - Calculate total logged activities (meds taken + journal entries).
- [ ] **Dynamic Trend Graph**:
  - Plot points on the `.trend-svg` polyline based on chronological mood entries.

---

### Phase 5: Client-Side Spotify Web API Integration
*Logical Priority: External authentication builds on top of a fully working local dashboard.*
- [ ] **Client-Side OAuth Authentication**:
  - Add "Connect Spotify" button using PKCE / Implicit Grant flow (no server backend required).
- [ ] **Recently Played Tracks Fetch**:
  - Fetch user's recent 50 played tracks via Spotify REST API (`/v1/me/player/recently-played`).
- [ ] **Mood & Music Correlation**:
  - Match track play timestamps with mood entry timestamps to display song/mood pairs in the Music card.