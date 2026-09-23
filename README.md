# 🏡 Family Home Dashboard

A lightweight, real-time family dashboard application designed to coordinate household tasks, grocery lists, and weekly meal planning across all family devices.

---

## ✨ Features

- **📋 Task Kanban Board**: Organize household tasks across **Today**, **This Week**, and **Someday** columns with full touch and mouse drag-and-drop support.
- **📦 Completed Task Archive**: Completed tasks auto-archive with completion timestamps, categorized chronologically with a collapsible/hideable toggle.
- **🛒 Store Shopping Lists**: Manage customized store columns (Grocery, Costco, Amazon, etc.) with dynamic item checking, quick-clearing, and inline store renaming.
- **🍳 Rolling 7-Day Meal Planner**: Automatically rolls forward daily to keep "Today" at the top for breakfast, lunch, and dinner planning.
- **🔐 PIN Access Gate**: Built-in alphanumeric passcode overlay stored in browser local storage for basic access protection and manual dashboard locking.
- **⚡ Real-Time Sync**: Synchronizes state instantly across all devices without page refreshes.

---

## 🛠️ Built With

- **Frontend**: Plain HTML5, CSS Variables, and Modern ES Modules (Vanilla JS).
- **Backend / Database**: Google Firebase Firestore (Real-time `onSnapshot` updates).
- **Hosting**: GitHub Pages.

---

## 📁 Repository Structure

```text
├── index.html   # Main application markup & structural layout
├── styles.css   # Global design system, theme variables, and responsive UI rules
├── app.js       # Firebase initialization, state management, UI rendering & PIN authentication
└── README.md    # Project documentation
