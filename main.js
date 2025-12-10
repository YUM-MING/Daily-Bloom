
/* 
  Daily Bloom - Main Application Logic
  - State Management
  - Localization
  - Web Components
*/

/**
 * Localization Data
 */
const TRANSLATIONS = {
  en: {
    appTitle: "Daily Bloom",
    searchPlaceholder: "Search tasks...",
    goalsTitle: "Monthly Goals",
    addGoal: "Add Goal",
    addTask: "Add Task",
    commentsTitle: "Friend Comments",
    addComment: "Leave a comment...",
    send: "Send",
    toggleTheme: "Toggle Theme",
    toggleLang: "한국어",
    backToMonth: "Back to Month",
    noTasks: "No tasks for this day.",
    noGoals: "No goals set for this month.",
    noComments: "No comments yet.",
    calendar: "Calendar",
  },
  ko: {
    appTitle: "데일리 블룸",
    searchPlaceholder: "일정 검색...",
    goalsTitle: "이달의 목표",
    addGoal: "목표 추가",
    addTask: "할 일 추가",
    commentsTitle: "친구들의 응원",
    addComment: "응원 댓글 남기기...",
    send: "전송",
    toggleTheme: "테마 변경",
    toggleLang: "English",
    backToMonth: "달력으로 돌아가기",
    noTasks: "일정이 없습니다.",
    noGoals: "등록된 목표가 없습니다.",
    noComments: "아직 댓글이 없습니다.",
    calendar: "달력",
  }
};

/**
 * State Management (Store)
 */
class Store extends EventTarget {
  constructor() {
    super();
    this.state = {
      lang: localStorage.getItem('lang') || 'ko',
      theme: localStorage.getItem('theme') || 'light',
      currentDate: new Date(),
      selectedDate: null, // If null, show calendar view. If set, show daily view.
      tasks: JSON.parse(localStorage.getItem('tasks')) || {}, // { "YYYY-MM-DD": [{id, text, completed}] }
      goals: JSON.parse(localStorage.getItem('goals')) || {}, // { "YYYY-MM": [{id, text, completed}] }
      comments: JSON.parse(localStorage.getItem('comments')) || {}, // { "YYYY-MM-DD": [{id, text, author}] }
    };

    this.initTheme();
  }

  get t() {
    return TRANSLATIONS[this.state.lang];
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.dispatchEvent(new CustomEvent('state-changed', { detail: this.state }));
    this.persist();
  }

  persist() {
    localStorage.setItem('lang', this.state.lang);
    localStorage.setItem('theme', this.state.theme);
    localStorage.setItem('tasks', JSON.stringify(this.state.tasks));
    localStorage.setItem('goals', JSON.stringify(this.state.goals));
    localStorage.setItem('comments', JSON.stringify(this.state.comments));
    this.initTheme();
  }

  initTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
  }

  toggleTheme() {
    this.setState({ theme: this.state.theme === 'light' ? 'dark' : 'light' });
  }

  toggleLang() {
    this.setState({ lang: this.state.lang === 'en' ? 'ko' : 'en' });
  }

  selectDate(date) {
    this.setState({ selectedDate: date });
  }

  addTask(dateStr, text) {
    const tasks = { ...this.state.tasks };
    if (!tasks[dateStr]) tasks[dateStr] = [];
    tasks[dateStr].push({ id: Date.now(), text, completed: false });
    this.setState({ tasks });
  }

  toggleTask(dateStr, taskId) {
    const tasks = { ...this.state.tasks };
    if (tasks[dateStr]) {
      tasks[dateStr] = tasks[dateStr].map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      this.setState({ tasks });
    }
  }

  deleteTask(dateStr, taskId) {
    const tasks = { ...this.state.tasks };
    if (tasks[dateStr]) {
        tasks[dateStr] = tasks[dateStr].filter(t => t.id !== taskId);
        this.setState({ tasks });
    }
  }

  addGoal(monthStr, text) {
    const goals = { ...this.state.goals };
    if (!goals[monthStr]) goals[monthStr] = [];
    goals[monthStr].push({ id: Date.now(), text, completed: false });
    this.setState({ goals });
  }
  
  toggleGoal(monthStr, goalId) {
    const goals = { ...this.state.goals };
    if (goals[monthStr]) {
      goals[monthStr] = goals[monthStr].map(g => 
        g.id === goalId ? { ...g, completed: !g.completed } : g
      );
      this.setState({ goals });
    }
  }

  addComment(dateStr, text) {
    const comments = { ...this.state.comments };
    if (!comments[dateStr]) comments[dateStr] = [];
    comments[dateStr].push({ id: Date.now(), text, author: 'Friend' }); // Simulating friend
    this.setState({ comments });
  }
}

const store = new Store();

/**
 * Base Component
 */
class BaseComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    store.addEventListener('state-changed', () => this.render());
  }

  getStyles() {
    return `
      <style>
        @import url('/style.css');
        :host { display: block; }
      </style>
    `;
  }

  render() {
    // Override in subclass
  }
}

/**
 * App Header Component
 */
class AppHeader extends BaseComponent {
  render() {
    const { t, theme, lang } = store;
    
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
          margin-bottom: 20px;
        }
        .logo {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--primary-color);
          cursor: pointer;
        }
        .controls {
          display: flex;
          gap: 10px;
        }
        .search-box {
            position: relative;
        }
        .search-input {
            padding-right: 30px;
        }
      </style>
      <header>
        <div class="logo" id="logo">${store.t.appTitle}</div>
        
        <div class="controls">
            <div class="search-box">
                 <input type="text" class="search-input" id="search" placeholder="${store.t.searchPlaceholder}">
            </div>
            <button class="btn-icon" id="theme-btn">${theme === 'light' ? '🌙' : '☀️'}</button>
            <button class="btn-primary" id="lang-btn">${store.t.toggleLang}</button>
        </div>
      </header>
    `;

    this.shadowRoot.getElementById('logo').addEventListener('click', () => {
        store.selectDate(null); // Go to calendar
    });

    this.shadowRoot.getElementById('theme-btn').addEventListener('click', () => {
      store.toggleTheme();
    });

    this.shadowRoot.getElementById('lang-btn').addEventListener('click', () => {
      store.toggleLang();
    });

    const searchInput = this.shadowRoot.getElementById('search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        // Dispatch a custom event or update store search query
        // For simplicity, let's just emit an event on window that CalendarView/DailyView can listen to
        window.dispatchEvent(new CustomEvent('app-search', { detail: query }));
    });
  }
}
customElements.define('app-header', AppHeader);


/**
 * Goal List Component
 */
class GoalList extends BaseComponent {
    render() {
        const date = store.state.currentDate;
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const goals = store.state.goals[monthStr] || [];

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .goal-container {
                    margin-bottom: 20px;
                }
                .goal-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .completed { text-decoration: line-through; color: #888; opacity: 0.6; }
                .add-form { display: flex; gap: 5px; margin-top: 10px; }
            </style>
            <div class="card goal-container">
                <h3>${store.t.goalsTitle} (${monthStr})</h3>
                <div class="list">
                    ${goals.length === 0 ? `<p>${store.t.noGoals}</p>` : ''}
                    ${goals.map(g => `
                        <div class="goal-item">
                            <input type="checkbox" ${g.completed ? 'checked' : ''} data-id="${g.id}">
                            <span class="${g.completed ? 'completed' : ''}">${g.text}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="add-form">
                    <input type="text" id="goal-input" placeholder="${store.t.addGoal}">
                    <button class="btn-primary" id="add-btn">+</button>
                </div>
            </div>
        `;

        this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                store.toggleGoal(monthStr, parseInt(e.target.dataset.id));
            });
        });

        const addBtn = this.shadowRoot.getElementById('add-btn');
        const input = this.shadowRoot.getElementById('goal-input');
        
        const addGoal = () => {
             if(input.value.trim()) {
                store.addGoal(monthStr, input.value.trim());
                input.value = '';
            }
        };

        addBtn.addEventListener('click', addGoal);
        input.addEventListener('keypress', (e) => { if(e.key === 'Enter') addGoal() });
    }
}
customElements.define('goal-list', GoalList);


/**
 * Calendar View Component
 */
class CalendarView extends BaseComponent {
    constructor() {
        super();
        this.searchQuery = '';
        window.addEventListener('app-search', (e) => {
            this.searchQuery = e.detail;
            this.render();
        });
    }

    render() {
        if (store.state.selectedDate) return; // Don't render if in daily view (handled by main app logic usually, but here we can hide)

        const date = store.state.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Month logic
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sun

        const today = new Date();

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 8px;
                }
                .day-header {
                    text-align: center;
                    font-weight: bold;
                    color: var(--primary-color);
                    padding: 10px 0;
                }
                .day-cell {
                    background: var(--surface-color);
                    min-height: 100px;
                    border-radius: 8px;
                    padding: 8px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }
                .day-cell:hover {
                    border-color: var(--primary-color);
                    transform: translateY(-2px);
                }
                .day-number {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .today {
                    background-color: rgba(233, 30, 99, 0.1); /* Pink tint */
                    border: 1px solid var(--primary-color);
                }
                .task-dot {
                    width: 6px;
                    height: 6px;
                    background-color: var(--text-color);
                    border-radius: 50%;
                    display: inline-block;
                    margin-right: 2px;
                }
                .task-preview {
                    font-size: 0.75rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                }
                .highlight {
                    background-color: yellow; 
                    color: black;
                }
                [data-theme="dark"] .highlight {
                    background-color: #ffeb3b;
                    color: black;
                }
            </style>
            <div class="card">
                <h2>${year}. ${month + 1}</h2>
                <div class="calendar-grid">
                    <div class="day-header">Sun</div>
                    <div class="day-header">Mon</div>
                    <div class="day-header">Tue</div>
                    <div class="day-header">Wed</div>
                    <div class="day-header">Thu</div>
                    <div class="day-header">Fri</div>
                    <div class="day-header">Sat</div>
                    
                    ${Array(startDayOfWeek).fill('<div class="empty"></div>').join('')}
                    
                    ${Array.from({length: daysInMonth}, (_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = today.toDateString() === new Date(year, month, d).toDateString();
                        const tasks = store.state.tasks[dateStr] || [];
                        
                        // Search Filter
                        const matchingTasks = this.searchQuery 
                            ? tasks.filter(t => t.text.toLowerCase().includes(this.searchQuery)) 
                            : tasks;
                        
                        // If searching, only show days with matches? Or highlight matches?
                        // Let's show all, but highlight matching text in list if search is active
                        const hasMatch = this.searchQuery && matchingTasks.length > 0;
                        const opacity = (this.searchQuery && !hasMatch) ? '0.3' : '1';

                        return `
                            <div class="day-cell ${isToday ? 'today' : ''}" data-date="${dateStr}" style="opacity: ${opacity}">
                                <div class="day-number">${d}</div>
                                ${matchingTasks.slice(0, 3).map(t => `
                                    <div class="task-preview">
                                        ${t.completed ? '✓' : '•'} ${t.text}
                                    </div>
                                `).join('')}
                                ${matchingTasks.length > 3 ? `<div class="task-preview">+${matchingTasks.length - 3}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        this.shadowRoot.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                store.selectDate(cell.dataset.date);
            });
        });
    }
}
customElements.define('calendar-view', CalendarView);


/**
 * Daily View Component
 */
class DailyView extends BaseComponent {
    render() {
        if (!store.state.selectedDate) return;

        const dateStr = store.state.selectedDate;
        const tasks = store.state.tasks[dateStr] || [];
        const comments = store.state.comments[dateStr] || [];

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .daily-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .task-list, .comment-section {
                    background: var(--surface-color);
                    padding: 20px;
                    border-radius: 12px;
                }
                .task-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .task-text {
                    flex-grow: 1;
                }
                .completed { text-decoration: line-through; opacity: 0.6; }
                .comment-item {
                    background: var(--bg-color);
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 3px solid var(--primary-color);
                }
                .comment-author { font-weight: bold; font-size: 0.8rem; margin-bottom: 4px; color: var(--primary-color); }
                .back-btn { margin-bottom: 10px; display: inline-block;}
                .delete-btn { color: #ff0000; background: none; font-size: 1.2rem; margin-left: auto; }
            </style>
            
            <div class="container daily-container">
                <button class="btn-primary back-btn" id="back-btn">← ${store.t.backToMonth}</button>
                <h2>${dateStr}</h2>

                <div class="task-list">
                    <h3>Tasks</h3>
                    ${tasks.length === 0 ? `<p>${store.t.noTasks}</p>` : ''}
                    ${tasks.map(t => `
                        <div class="task-item">
                            <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
                            <span class="task-text ${t.completed ? 'completed' : ''}">${t.text}</span>
                            <button class="delete-btn" data-id="${t.id}">×</button>
                        </div>
                    `).join('')}
                    
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <input type="text" id="task-input" placeholder="${store.t.addTask}" style="flex-grow:1">
                        <button class="btn-primary" id="add-task-btn">+</button>
                    </div>
                </div>

                <div class="comment-section">
                    <h3>${store.t.commentsTitle}</h3>
                    ${comments.length === 0 ? `<p>${store.t.noComments}</p>` : ''}
                    ${comments.map(c => `
                        <div class="comment-item">
                            <div class="comment-author">${c.author}</div>
                            <div>${c.text}</div>
                        </div>
                    `).join('')}
                    
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <input type="text" id="comment-input" placeholder="${store.t.addComment}" style="flex-grow:1">
                        <button class="btn-primary" id="add-comment-btn">${store.t.send}</button>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot.getElementById('back-btn').addEventListener('click', () => {
            store.selectDate(null);
        });

        // Task Events
        this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                store.toggleTask(dateStr, parseInt(e.target.dataset.id));
            });
        });

         this.shadowRoot.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                store.deleteTask(dateStr, parseInt(e.target.dataset.id));
            });
        });

        const addTask = () => {
            const input = this.shadowRoot.getElementById('task-input');
            if (input.value.trim()) {
                store.addTask(dateStr, input.value.trim());
                input.value = '';
            }
        };
        this.shadowRoot.getElementById('add-task-btn').addEventListener('click', addTask);
        this.shadowRoot.getElementById('task-input').addEventListener('keypress', (e) => { if(e.key==='Enter') addTask(); });


        // Comment Events
        const addComment = () => {
            const input = this.shadowRoot.getElementById('comment-input');
            if (input.value.trim()) {
                store.addComment(dateStr, input.value.trim());
                input.value = '';
            }
        }
        this.shadowRoot.getElementById('add-comment-btn').addEventListener('click', addComment);
        this.shadowRoot.getElementById('comment-input').addEventListener('keypress', (e) => { if(e.key==='Enter') addComment(); });
    }
}
customElements.define('daily-view', DailyView);

// Main App Controller
const appContainer = document.getElementById('app');

function renderApp() {
    const isDaily = !!store.state.selectedDate;
    
    // We update the DOM classes or visibility here
    const calendarView = document.querySelector('calendar-view');
    const goalList = document.querySelector('goal-list');
    const dailyView = document.querySelector('daily-view');

    if (isDaily) {
        calendarView.classList.add('hidden');
        goalList.classList.add('hidden');
        dailyView.classList.remove('hidden');
        // Force re-render of daily view to ensure fresh data
        dailyView.render(); 
    } else {
        calendarView.classList.remove('hidden');
        goalList.classList.remove('hidden');
        dailyView.classList.add('hidden');
        calendarView.render(); // Re-render calendar to show search results or updates
    }
}

store.addEventListener('state-changed', renderApp);
// Initial check handled by components, but we might need initial visibility toggle
