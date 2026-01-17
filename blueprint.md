# Daily Bloom - Planner for MBTI "J"

## Overview
A modern, minimalist daily planner web application designed for MBTI "J" types who value structure and planning. The app features schedule management, social interaction (friend comments/Blooms), and monthly goal tracking. It adheres to a clean White/Black/Pink color scheme and supports Dark Mode and English/Korean localization.

## Project Structure & Architecture
- **Framework:** Vanilla JavaScript with Web Components.
- **Styling:** CSS Variables, Flexbox/Grid, Modern CSS (Oklch/HSL).
- **Backend:** Firebase Auth (Google) & Firestore (Real-time sync).
- **Data Model:**
  - `users`: Profiles, nickname, photo, bloom (friend) list.
  - `tasks`: Daily tasks with support for `#d` (duration) and `#w` (weekly) tags.
  - `goals`: Monthly goals with completion status.
  - `comments`: Real-time "Bloom" interactions between friends.
  - `notifications`: Tag and comment alerts with direct navigation.

## Features
- [x] **Core Layout**: Responsive White/Black/Pink theme with Dark Mode support.
- [x] **Localization**: Full English and Korean translation toggle.
- [x] **Smart Task Entry**:
  - `#d{n}`: Multi-day events with connected visual bars.
  - `#w{n}`: Weekly repeating tasks.
  - `@name`: Friend tagging with shared visibility.
- [x] **Advanced Search**: Fuzzy search across all tasks with auto-navigation to the selected date and month.
- [x] **Quick Navigation**: Grid-based year/month jump picker and one-click home return via logo.
- [x] **Social (Bloom)**:
  - Friend search by email and mutual "Blooming".
  - Real-time "Bloom" (comment) section with inline edit/delete.
  - Visiting friends' calendars with distinct UI (color banners, read-only mode).
- [x] **Goal Tracking**: Monthly goal management with deletion and completion features.

## Technical Details
- **Fuzzy Search:** Implemented a scoring algorithm based on character order and string proximity.
- **Visual Continuity:** CSS trickery with negative margins and group ordering to ensure multi-day task bars appear seamless across the calendar grid.
- **Real-time UI:** Leveraged `onSnapshot` from Firestore for zero-refresh updates on tasks, comments, and notifications.