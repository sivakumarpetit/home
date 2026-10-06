# Family Hub Dashboard

A real-time, touch-optimized progressive family dashboard designed for household coordination, 5/3/1 strength and running workout tracking, meal planning, grocery lists, and family event scheduling.

## 🚀 Key Features

### 🏠 Main Hub
- **Task Management**: Drag-and-drop or status-toggle tasks across **Today**, **This Week**, and **Someday** columns. Filter tasks by assignee (**Siva**, **Priya**, or **Unassigned**).
- **Quick-Add Templates**: Customizable quick-add pills for frequent household chores.
- **Completed Archive**: Grouped historical archive of completed tasks organized by date.
- **Meal Planning**: Weekly interactive breakfast, lunch, and dinner meal calendar.
- **Shopping Lists**: Multi-store itemized shopping lists (Grocery, Costco, Indian Market, Amazon, Walmart, and custom stores) with clear-checked capabilities.

### 🏋️ Siva's Workout Engine
- **5/3/1 Boring But Big (BBB) Program**: Auto-calculates warm-up sets, 5/3/1 main working sets, and BBB supplemental volume sets based on Training Max (TM).
- **Custom BBB Volume Rep Choices**: Selectable **5, 7, or 10 reps** for BBB volume sets.
- **Visual Barbell Plate Loader**: Dynamic, color-coded visual barbell display rendering exact plate calculations per side based on inventory:
  - **55 lbs**: Red (`#dc2626`)
  - **45 lbs**: Blue (`#2563eb`)
  - **35 lbs**: Yellow (`#ca8a04`)
  - **25 lbs**: Green (`#16a34a`)
  - **15 lbs**: Orange (`#ea580c`)
  - **10 lbs**: Grey (`#475569`)
  - **2.5 lbs**: Small Grey (`#94a3b8`)
- **Detailed Warm-Up Sets**: 3 individual checkable warm-up sets ($50\%\text{ TM} \times 5\text{ reps}$).
- **Running Tracker**: Log distance and run type (*Easy*, *Tempo*, *Long*).
- **Monthly Workout Calendar & Stats**: Monthly grid tracking total workouts, running mileage, quarter/year stats, and top lift frequency.

### 📅 Family Events & Schedule
- **Add Event Module**: Schedule events with descriptions, date pickers, and time block tags (🌅 **Morning**, ☀️ **Afternoon**, 🌙 **Evening**).
- **Events Monthly Calendar**: Monthly calendar grid featuring visual dot indicators on days with scheduled events.
- **Rolling 7-Day Agenda**: Chronological agenda view displaying all events scheduled over the next 7 days.

---

## 🛠️ Technology Stack
- **Frontend**: Vanilla HTML5, CSS3 (CSS Variables, Flexbox/Grid), JavaScript (ES Modules).
- **Backend & Real-Time Sync**: Firebase Firestore (`onSnapshot` real-time listeners).
- **Hosting & Deployment**: GitHub Pages with Progressive Web App (PWA) manifest support.

---
