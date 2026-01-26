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
  - **Nested Replies**: Support for threaded conversations with visual indentation.
  - **Threaded Notifications**: Automatic alerts for all participants in a comment thread (original commenter + previous repliers).
  - Visiting friends' calendars with distinct UI (color banners, read-only mode).
- [x] **Goal Tracking**: Monthly goal management with deletion and completion features.

## Technical Details
- **Nested Replies:** Implemented using a `parentId` field in the `comments` collection, allowing one level of threading for clear communication.
- **Threaded Notifications:** When a reply is added, the system queries for the `parentId` owner and all existing replies with the same `parentId` to notify all involved parties (excluding the current actor).
- **Fuzzy Search:** Implemented a scoring algorithm based on character order and string proximity.
- **Visual Continuity:** CSS trickery with negative margins and group ordering to ensure multi-day task bars appear seamless across the calendar grid.
- **Real-time UI:** Leveraged `onSnapshot` from Firestore for zero-refresh updates on tasks, comments, and notifications.

## Current Plan: Global Expansion & SEO (2026-01-20)
- [ ] **SEO Overhaul**:
    - Update `index.html` meta tags to be bilingual or English-friendly.
    - Expand keywords to include global search terms (Planner, Schedule, MBTI J, etc.).
    - Enhance Open Graph and Twitter Card descriptions.
- [x] **Internationalization (i18n) Fixes**:
    - **Help Modal**: Move hardcoded Korean text to the `TRANSLATIONS` object.
    - **Alerts/Dialogs**: Replace hardcoded alert strings in `main.js` with dynamic translations.
    - **UI Consistency**: Ensure all buttons and placeholders update immediately upon language toggle.
    - **Notifications**: Implemented dynamic translation for new notifications (Tag, Bloom, Comment) using `messageKey` storage.
- [x] **AdSense Policy Compliance**:
    - **Legal Pages**: Created `privacy.html` and `terms.html` to meet strict policy requirements.
    - **Sitemap & Robots**: Updated `sitemap.xml` and `robots.txt` to ensure crawlers can find the new legal pages.
    - **Verification**: Added `google-adsense-account` meta tag to `index.html`.
    - **Accessibility**: Added `<noscript>` content with links to legal pages for better crawler visibility.
    - **Delayed Script Loading**: AdSense script now loads dynamically only after the main app content or enhanced login content is visible. This prevents ads from appearing on the "Loading..." screen.
    - **Enhanced Login Content**: Added a detailed "About Daily Bloom" section to the login page with feature descriptions in English and Korean to satisfy "publisher content" requirements.
    - **Empty State Improvements**: Added descriptive and encouraging text to empty task and goal lists to maintain content value.
- [ ] **Feature Fixes**:
    - **Help Button**: Add the missing "Heart" button in the header to re-open the Help modal as described in the guide.
    - **English Naturalization**: Review and polish English text to sound more native ("Think like a foreigner").