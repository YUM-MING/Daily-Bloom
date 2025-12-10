# Daily Bloom - Planner for MBTI "J"

## Overview
A modern, minimalist daily planner web application designed for MBTI "J" types who value structure and planning. The app features schedule management, social interaction (friend comments), and monthly goal tracking. It adheres to a clean White/Black/Pink color scheme and supports Dark Mode and English/Korean localization.

## Project Structure & Architecture
- **Framework:** Vanilla JavaScript with Web Components.
- **Styling:** CSS Variables, Flexbox/Grid, Modern CSS (Oklch colors if supported, or standard HSL/RGB).
- **Data Persistence:** `localStorage` for prototype (Tasks, Goals, Comments, Settings).
- **Localization:** Simple JSON-based dictionary in `main.js`.

## Current State
- Initial HTML/CSS/JS boilerplate.

## Features Checklist
- [ ] **Core Layout**: Responsive layout with White/Black/Pink theme.
- [ ] **Localization**: Toggle between Korean and English.
- [ ] **Theme**: Light/Dark mode toggle.
- [ ] **Navigation**: Simple top bar with Search and Settings.
- [ ] **Calendar View**: Monthly grid showing dates.
- [ ] **Daily View**: Task list for selected date.
- [ ] **Goal List**: Monthly goals section.
- [ ] **Social**: "Friend Comments" section on daily view.
- [ ] **Search**: Search functionality for tasks.

## Implementation Plan (Current Sprint)
1.  **Global Styles (`style.css`)**: Define CSS variables for colors (Light/Dark), typography, and utility classes.
2.  **State Management (`main.js`)**: Create a `Store` class for managing tasks, goals, comments, and app settings (date, theme, lang).
3.  **Components**:
    -   `<app-header>`: Contains logo, search input, theme toggle, lang toggle.
    -   `<calendar-view>`: Displays the monthly grid. Clicking a day switches to Daily View.
    -   `<daily-view>`: Displays tasks for the active date. Allows adding/checking tasks. Includes "Friend Comments" section.
    -   `<goal-list>`: Displays monthly goals.
4.  **Integration (`index.html`)**: Assemble components into the main layout.
