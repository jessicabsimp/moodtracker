# Warm & Organic Health & Mood Dashboard

## Project Overview
A modern, responsive wellness dashboard built with vanilla JavaScript, HTML5, and CSS Grid. Features an earthy, warm cream visual aesthetic (`#F8F4EC`), persistent cloud storage powered by Supabase, and modular cards designed for future API and hardware integrations.

---

## Core File Architecture
- `index.html`: Dashboard UI structure containing top feature cards, mood logging form, dynamic history list, medication status widget, journal prompts, and analytics view.
- `styles.css`: Responsive CSS Grid layout (`.dashboard-grid`), design variables (`--olive`, `--sage`, `--terracotta`, `--gold`), typography rules ('DM Serif Display' + 'Inter'), and botanical SVG accents.
- `app.js`: Application logic handling Supabase Cloud DB interactions, Web NFC scanning, dynamic DOM rendering, and event handlers.
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
- **Persistence**: Remote Database via Supabase:
  - Table `mood_entries`: `id`, `created_at`, `mood`, `notes`, `date_time`
  - Table `medication_logs`: `id`, `created_at`, `time_of_day`, `timestamp`
  - Table `journal_entries`: `id`, `created_at`, `prompt`, `response`, `timestamp`
- **DOM Targets**:
  - Mood Form: `#moodForm`, `.mood-buttons button`, `#notes`, `#dateTime`, `#history`
  - Medication Widget: `#medication-card`, `#med-log-history`, `#medModal`
  - Journal Widget: `.prompt-box`, `.recent-entries`, `#journal-modal`
  - Analytics Widget: `.stats-grid`, `.stat-value`, `.trend-svg`

---

## Feature Roadmap (Ordered Logic)

### Phase 1: Core Foundation & Cloud Data Storage (COMPLETED)
- [x] Responsive bento grid layout and warm organic CSS theme.
- [x] Interactive mood selector buttons with dynamic state selection.
- [x] Cloud persistent logging via Supabase DB (`mood_entries` and `medication_logs`).
- [x] Render history list dynamically with real-time UI updates upon insert/delete operations.
- [x] Inner scroll boundary (`max-height: 200px`) for entry history.

---

### Phase 2: Web NFC Medication Tracker (COMPLETED)
- [x] Web NFC scan event hook (`NDEFReader`) with fallback simulation button.
- [x] Interactive dose timing popup modal (`Morning`, `Lunch`, `Dinner`, `Bedtime`).
- [x] Asynchronous database persistence and deletion for dose history.

---

### Phase 3: Weekly Guided Journal & Prompts (NEXT STEP)
- [ ] **Journal Input Modal**:
  - Interactive "New Entry" button opening a reflective prompt popup.
- [ ] **Supabase Integration**:
  - Save journal entries to `journal_entries` table.
- [ ] **Display Recent Entries**:
  - Render latest reflections dynamically inside the Journal card's `.recent-entries` container.

---

### Phase 4: Dynamic Analytics Engine
- [ ] **Real-Time Calculations**:
  - Compute `Avg Mood` score dynamically from logged Supabase entries.
  - Calculate `% Positive Days` (ratio of Great/Good logs over total logged days).
  - Calculate total logged activities (meds taken + journal entries).
- [ ] **Dynamic Trend Graph**:
  - Plot points on the `.trend-svg` polyline based on chronological mood entries.

---

### Phase 5: Client-Side Spotify Web API Integration
- [ ] **Client-Side OAuth Authentication**:
  - Add "Connect Spotify" button using PKCE / Implicit Grant flow (no server backend required).
- [ ] **Recently Played Tracks Fetch**:
  - Fetch user's recent 50 played tracks via Spotify REST API (`/v1/me/player/recently-played`).
- [ ] **Mood & Music Correlation**:
  - Match track play timestamps with mood entry timestamps to display song/mood pairs in the Music card.







  Change the icons for the notes section on the mood log, pair mood with song option, icons for analytics