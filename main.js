
import { auth, provider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot, deleteDoc } from './firebase-config.js';

/**
 * Localization Data
 */
const TRANSLATIONS = {
  en: {
    appTitle: "Daily Bloom",
    searchPlaceholder: "Search tasks...",
    goalsTitle: "Monthly Goals",
    addGoal: "Add Goal",
    addTask: "Add Task (@friend to share)",
    commentsTitle: "Bloom",
    addComment: "Leave a bloom...",
    send: "Send",
    toggleTheme: "Toggle Theme",
    toggleLang: "한국어",
    backToMonth: "Back to Month",
    noTasks: "No tasks for this day.",
    noGoals: "No goals set for this month.",
    noComments: "No comments yet.",
    calendar: "Calendar",
    myPage: "My Bloom",
    login: "Sign in with Google",
    logout: "Log Out",
    searchFriend: "Find friend by email...",
    addFriend: "Bloom",
    friendList: "My Blooms",
    mutual: "Mutual Bloom",
    setNickname: "Set Nickname",
    selectDatePrompt: "Select a date from the calendar to view details.",
  },
  ko: {
    appTitle: "Daily Bloom",
    searchPlaceholder: "일정 검색...",
    goalsTitle: "이달의 목표",
    addGoal: "목표 추가",
    addTask: "할 일 추가 (@친구 태그)",
    commentsTitle: "블룸(Bloom)",
    addComment: "응원 남기기...",
    send: "전송",
    toggleTheme: "테마 변경",
    toggleLang: "English",
    backToMonth: "달력으로 돌아가기",
    noTasks: "일정이 없습니다.",
    noGoals: "등록된 목표가 없습니다.",
    noComments: "아직 댓글이 없습니다.",
    calendar: "달력",
    myPage: "마이 블룸",
    login: "구글로 시작하기",
    logout: "로그아웃",
    searchFriend: "이메일로 친구 찾기...",
    addFriend: "블룸 맺기",
    friendList: "나의 블룸",
    mutual: "서로 블룸",
    setNickname: "닉네임 설정",
    selectDatePrompt: "날짜를 선택하여 상세 일정을 확인하세요.",
  }
};

/**
 * Store - Now using Firestore
 */
class Store extends EventTarget {
  constructor() {
    super();
    this.state = {
      user: null, 
      lang: localStorage.getItem('lang') || 'ko',
      theme: localStorage.getItem('theme') || 'light',
      currentDate: new Date(),
      selectedDate: null,
      tasks: {}, 
      goals: {},
      comments: {},
      blooms: [], 
      notifications: [], 
      viewingUser: null,
    };

    this.initTheme();
    this.initAuth();
  }

  get t() {
    return TRANSLATIONS[this.state.lang];
  }

  initAuth() {
      onAuthStateChanged(auth, async (firebaseUser) => {
          const getLoadingScreen = () => document.getElementById('loading-screen');
          
          if (firebaseUser) {
              console.log("User detected (Auth Changed):", firebaseUser.email);
              
              const userRef = doc(db, "users", firebaseUser.uid);
              try {
                  console.log("Attempting to fetch user profile...");
                  const userSnap = await getDoc(userRef);
                  console.log("User profile fetch result:", userSnap.exists());

                  if (userSnap.exists()) {
                      const userData = userSnap.data();
                      const displayUser = { ...firebaseUser, ...userData };
                      if (!userData.photoURL) displayUser.photoURL = '/assets/logo.svg'; 
                      
                      this.setState({ user: displayUser });
                  } else {
                      console.log("Creating new user profile...");
                      const newUser = {
                          email: firebaseUser.email,
                          nickname: firebaseUser.displayName || "Bloomer",
                          photoURL: '/assets/logo.svg',
                          blooms: [] 
                      };
                      await setDoc(userRef, newUser);
                      this.setState({ user: { ...firebaseUser, ...newUser } });
                  }
                  
                  this.loadTasks();
                  this.loadGoals();
                  this.loadBlooms();
                  this.loadNotifications(); 

                  // Show App
                  const loader = getLoadingScreen();
                  if(loader) loader.remove(); 
                  
                  const loginView = document.getElementById('login-view');
                  const appView = document.getElementById('app-view');
                  
                  if(loginView) {
                      loginView.classList.add('hidden');
                      loginView.style.display = 'none';
                  }
                  if(appView) {
                      appView.classList.remove('hidden');
                      appView.style.display = 'block';
                      appView.style.visibility = 'visible'; 
                  }
                  console.log("App view forced shown and loading screen removed.");
              } catch (e) {
                  console.error("Error fetching/creating user profile:", e);
                  const loader = getLoadingScreen();
                  if(loader) loader.remove();
                  alert("Error loading profile: " + e.message);
              }
          } else {
              console.log("No user signed in.");
              this.setState({ user: null, tasks: {}, goals: {} });
              
              // Show Login
              const loader = getLoadingScreen();
              if(loader) loader.remove();
              
              const loginView = document.getElementById('login-view');
              const appView = document.getElementById('app-view');

              if(loginView) {
                  loginView.classList.remove('hidden');
                  loginView.style.display = 'flex'; 
              }
              if(appView) {
                  appView.classList.add('hidden');
                  appView.style.display = 'none';
              }
          }
      });
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.dispatchEvent(new CustomEvent('state-changed', { detail: this.state }));
    if(newState.lang) localStorage.setItem('lang', newState.lang);
    if(newState.theme) localStorage.setItem('theme', newState.theme);
    if(newState.theme) this.initTheme();
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
    if (date) {
        // Parse "YYYY-MM-DD" carefully to avoid timezone shifts
        const [year, month, day] = date.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        this.setState({ selectedDate: date, currentDate: d });
    } else {
        this.setState({ selectedDate: null });
    }
  }

  prevMonth() {
    const d = new Date(this.state.currentDate);
    d.setMonth(d.getMonth() - 1);
    this.setState({ currentDate: d, selectedDate: null });
  }

  nextMonth() {
    const d = new Date(this.state.currentDate);
    d.setMonth(d.getMonth() + 1);
    this.setState({ currentDate: d, selectedDate: null });
  }

  visitFriend(friendData) {
      this.setState({ viewingUser: friendData, selectedDate: null });
      this.loadTasks(); 
      this.loadGoals();
      alert(`Visiting ${friendData.nickname}'s calendar!`);
  }

  goHome() {
      this.setState({ viewingUser: null, selectedDate: null, currentDate: new Date() });
      this.loadTasks(); 
      this.loadGoals();
  }

  // --- Firestore Actions ---

  async loadTasks() {
      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : (this.state.user ? this.state.user.uid : null);
      if(!targetUid) return;

      const q = query(collection(db, "tasks"), where("userId", "==", targetUid));
      onSnapshot(q, (snapshot) => {
          const tasks = {};
          snapshot.forEach(doc => {
              const data = doc.data();
              if(!tasks[data.date]) tasks[data.date] = [];
              tasks[data.date].push({ id: doc.id, ...data });
          });
          // Sort tasks by 'order' field if exists, else by createdAt
          for(const date in tasks) {
              tasks[date].sort((a, b) => (a.order || 0) - (b.order || 0));
          }
          this.setState({ tasks });
      });
  }

  async loadNotifications() {
      if(!this.state.user) return;
      const q = query(collection(db, "notifications"), where("toUserId", "==", this.state.user.uid), where("read", "==", false));
      onSnapshot(q, (snapshot) => {
          const notifications = [];
          snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));
          notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          this.setState({ notifications });
      });
  }

  async markNotificationRead(id) {
      await updateDoc(doc(db, "notifications", id), { read: true });
  }

  async sendNotification(toUserId, type, message, senderEmail = null, date = null) {
      await addDoc(collection(db, "notifications"), {
          toUserId,
          fromUser: this.state.user.nickname,
          senderEmail: senderEmail || this.state.user.email, // Add email for bloom back
          type, // 'bloom', 'comment', 'tag'
          message,
          date, // Navigation target
          read: false,
          createdAt: new Date().toISOString()
      });
  }

  async loadGoals() {
      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : (this.state.user ? this.state.user.uid : null);
      if(!targetUid) return;

      const q = query(collection(db, "goals"), where("userId", "==", targetUid));
      onSnapshot(q, (snapshot) => {
          const goals = {};
          snapshot.forEach(doc => {
              const data = doc.data();
              if(!goals[data.month]) goals[data.month] = [];
              goals[data.month].push({ id: doc.id, ...data });
          });
          this.setState({ goals });
      });
  }

  async loadBlooms() {
      if(!this.state.user) return;
      const bloomsList = this.state.user.blooms || [];
      if(bloomsList.length === 0) {
          this.setState({ blooms: [] });
          return;
      }
      
      const bloomsData = [];
      for(const uid of bloomsList) {
          const docSnap = await getDoc(doc(db, "users", uid));
          if(docSnap.exists()) {
              bloomsData.push({ uid, ...docSnap.data() });
          }
      }
      this.setState({ blooms: bloomsData });
  }

  async updateNickname(newNickname) {
      if(!this.state.user) return;
      await updateDoc(doc(db, "users", this.state.user.uid), { nickname: newNickname });
      this.setState({ user: { ...this.state.user, nickname: newNickname } });
  }

  async updatePhoto(base64String) {
      if(!this.state.user) return;
      await updateDoc(doc(db, "users", this.state.user.uid), { photoURL: base64String });
      this.setState({ user: { ...this.state.user, photoURL: base64String } });
  }

  async addBloom(email) {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
          alert("User not found!");
          return;
      }

      const friendDoc = querySnapshot.docs[0];
      const friendUid = friendDoc.id;

      if(friendUid === this.state.user.uid) {
          alert("You cannot bloom yourself!");
          return;
      }

      if (this.state.user.blooms && this.state.user.blooms.includes(friendUid)) {
          alert("Already bloomed this user!");
          return;
      }

      await updateDoc(doc(db, "users", this.state.user.uid), {
          blooms: arrayUnion(friendUid)
      });
      
      await this.sendNotification(friendUid, 'bloom', `${this.state.user.nickname}님이 회원님을 블룸(Bloom)했습니다! 맞블룸하여 친구가 되어보세요. 🌸`);

      const userRef = doc(db, "users", this.state.user.uid);
      const userSnap = await getDoc(userRef);
      this.setState({ user: { ...this.state.user, ...userSnap.data() } });
      this.loadBlooms();
      alert(`Bloomed ${friendDoc.data().nickname}!`);
  }

  async removeBloom(friendUid) {
      if(!this.state.user) return;
      
      if(!confirm("Are you sure you want to cancel this Bloom?")) return;

      await updateDoc(doc(db, "users", this.state.user.uid), {
          blooms: arrayRemove(friendUid)
      });

      const userRef = doc(db, "users", this.state.user.uid);
      const userSnap = await getDoc(userRef);
      this.setState({ user: { ...this.state.user, ...userSnap.data() } });
      this.loadBlooms();
  }

  async addTask(dateStr, text) {
    if(this.state.viewingUser) {
        alert("You cannot add tasks to a friend's calendar directly. Tag them from your calendar instead!");
        return;
    }
    if(!this.state.user) return;

    // Parse #d{n} (Duration) and #w{n} (Weekly Repeat)
    const durationMatch = text.match(/#d(\d+)/);
    const weeklyMatch = text.match(/#w(\d+)/);
    let duration = durationMatch ? parseInt(durationMatch[1]) : 1;
    let weeks = weeklyMatch ? parseInt(weeklyMatch[1]) : 1;
    
    // Clean text from tags
    let cleanText = text.replace(/#d\d+/, '').replace(/#w\d+/, '').trim();

    const tagMatch = cleanText.match(/@(\S+)/);
    let taggedUid = null;
    let formattedText = cleanText;

    if (tagMatch) {
        const taggedName = tagMatch[1];
        cleanText = cleanText.replace(`@${taggedName}`, '').trim();
        formattedText = `${cleanText} (with ${taggedName})`;

        const friend = this.state.blooms.find(b => b.nickname === taggedName);
        if (friend) {
            if (friend.blooms && friend.blooms.includes(this.state.user.uid)) {
                taggedUid = friend.uid;
            } else {
                alert(`Cannot tag @${taggedName}: You are not mutual Blooms yet! They need to Bloom you back. 🌸`);
            }
        }
    }

    const groupId = 'group-' + Date.now();
    const baseDate = new Date(dateStr);
    const order = Date.now(); // Consistent order for the whole group

    const tasksToAdd = [];
    
    // Logic for #d (Consecutive days)
    if (duration > 1) {
        for (let i = 0; i < duration; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            const dStr = d.toISOString().split('T')[0];
            tasksToAdd.push({ date: dStr, text: formattedText, duration, dayIndex: i });
        }
    } 
    // Logic for #w (Weekly repeat)
    else if (weeks > 1) {
        for (let i = 0; i < weeks; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + (i * 7));
            const dStr = d.toISOString().split('T')[0];
            tasksToAdd.push({ date: dStr, text: formattedText, isWeekly: true });
        }
    }
    // Normal single day
    else {
        tasksToAdd.push({ date: dateStr, text: formattedText });
    }

    for (const taskData of tasksToAdd) {
        const newTask = {
            text: taskData.text,
            date: taskData.date,
            userId: this.state.user.uid,
            completed: false,
            createdAt: new Date().toISOString(),
            groupId,
            order, // Set consistent order for alignment
            duration: taskData.duration || 1,
            dayIndex: taskData.dayIndex ?? -1
        };

        try {
            await addDoc(collection(db, "tasks"), newTask);
            
            if (taggedUid) {
                await addDoc(collection(db, "tasks"), {
                    ...newTask,
                    userId: taggedUid,
                    text: `${cleanText} (with ${this.state.user.nickname})`
                });
                
                // Only send notification for the first day to avoid spam
                if (taskData.date === dateStr) {
                    await this.sendNotification(taggedUid, 'tag', `${this.state.user.nickname}님이 일정에 회원님을 태그했습니다: ${cleanText}`, null, dateStr);
                }
            }
        } catch (e) {
            console.error("Failed to add task:", e);
        }
    }

    if (taggedUid) alert(`Shared events with @${tagMatch[1]}!`);
  }

  async reorderTasks(dateStr, reorderedTasks) {
      // Optimistic update
      const updatedTasks = { ...this.state.tasks, [dateStr]: reorderedTasks };
      this.setState({ tasks: updatedTasks });

      // Update Firestore
      // In a real app, use a batch write. Here we loop for simplicity.
      // We assign new order values based on index
      const baseOrder = Date.now();
      reorderedTasks.forEach((task, index) => {
          updateDoc(doc(db, "tasks", task.id), { order: baseOrder + index });
      });
  }

  async toggleTask(dateStr, taskId) {
    if(this.state.viewingUser) return; // Prevent modifying friend's tasks
    const task = this.state.tasks[dateStr].find(t => t.id === taskId);
    if(task) {
        await updateDoc(doc(db, "tasks", taskId), { completed: !task.completed });
    }
  }

  async deleteTask(dateStr, taskId) {
      if(this.state.viewingUser) return;
      await updateDoc(doc(db, "tasks", taskId), { userId: "deleted" }); 
  }

  async addGoal(monthStr, text) {
      if(this.state.viewingUser) {
          alert("Read-only mode!");
          return;
      }
      if(!this.state.user) return;
      await addDoc(collection(db, "goals"), {
          text,
          month: monthStr,
          userId: this.state.user.uid,
          completed: false
      });
  }
  
  async toggleGoal(monthStr, goalId) {
    if(this.state.viewingUser) return;
    const goal = this.state.goals[monthStr].find(g => g.id === goalId);
    if(goal) {
        await updateDoc(doc(db, "goals", goalId), { completed: !goal.completed });
    }
  }

  searchTasks(queryText) {
    if (!queryText.trim()) return [];
    const results = [];
    const q = queryText.toLowerCase().trim();
    
    for (const date in this.state.tasks) {
      this.state.tasks[date].forEach(task => {
        const text = task.text.toLowerCase();
        let score = 0;
        
        if (text.includes(q)) {
            score = 1.0;
        } else {
            // Fuzzy match: check if characters appear in order
            let qIdx = 0;
            let matches = 0;
            for (let i = 0; i < text.length && qIdx < q.length; i++) {
                if (text[i] === q[qIdx]) {
                    qIdx++;
                    matches++;
                }
            }
            score = matches / q.length;
            // Penalize length difference slightly
            score = score * (1 - Math.min(0.5, Math.abs(text.length - q.length) / 100));
        }

        if (score > 0.6) { // Threshold for relevance
          results.push({ ...task, date, score });
        }
      });
    }
    
    // Sort by score then by date (newest first)
    return results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.date) - new Date(a.date);
    }).slice(0, 8);
  }
  
  async visitUserByUid(uid) {
      if (this.state.user && uid === this.state.user.uid) {
          this.goHome();
          return;
      }
      const docSnap = await getDoc(doc(db, "users", uid));
      if(docSnap.exists()) {
          this.visitFriend({ uid, ...docSnap.data() });
      } else {
          alert("User not found!");
      }
  }

  async loadComments(dateStr) {
      if(!this.state.user) return;
      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : this.state.user.uid;
      const key = `${targetUid}_${dateStr}`;

      // Prevent duplicate listeners
      if (!this.activeCommentListeners) this.activeCommentListeners = new Set();
      if (this.activeCommentListeners.has(key)) return;
      this.activeCommentListeners.add(key);
      
      const q = query(collection(db, "comments"), where("toUserId", "==", targetUid), where("date", "==", dateStr));
      onSnapshot(q, (snapshot) => {
          const dateComments = [];
          snapshot.forEach(doc => dateComments.push({id: doc.id, ...doc.data()}));
          // Sort by creation time
          dateComments.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          
          const allComments = { ...this.state.comments };
          allComments[key] = dateComments;
          this.setState({ comments: allComments });
      });
  }

  async addComment(dateStr, text) {
      if(!this.state.user) return;
      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : this.state.user.uid;
      
      await addDoc(collection(db, "comments"), {
          date: dateStr,
          toUserId: targetUid, 
          fromUserId: this.state.user.uid,
          author: this.state.user.nickname,
          authorPhoto: this.state.user.photoURL,
          text,
          createdAt: new Date().toISOString()
      });
      
      if(targetUid !== this.state.user.uid) {
          await this.sendNotification(targetUid, 'comment', `${this.state.user.nickname}님이 회원님의 달력(${dateStr})에 블룸을 남겼습니다!`, null, dateStr);
      }
  }

  async updateComment(commentId, newText) {
      if(!this.state.user) return;
      await updateDoc(doc(db, "comments", commentId), {
          text: newText,
          updatedAt: new Date().toISOString()
      });
  }

  async deleteComment(commentId) {
      if(!this.state.user) return;
      if(!confirm("이 블룸을 삭제할까요?")) return;
      await deleteDoc(doc(db, "comments", commentId));
  }

  async deleteGoal(goalId) {
      if(this.state.viewingUser) return;
      if(!confirm("이 목표를 삭제할까요?")) return;
      await deleteDoc(doc(db, "goals", goalId));
  }
}

const store = new Store();

// --- Components ---

class BaseComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    this.render();
    store.addEventListener('state-changed', () => this.render());
  }
}

class AppLogin extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); }
  connectedCallback() { this.render(); }
  
  render() {
      this.shadowRoot.innerHTML = `
        <style>
            @import url('/style.css'); 
            :host{display:block;}
            h1 { font-family: 'Dancing Script', cursive; font-size: 3.5rem; color: var(--primary-color); margin-bottom: 10px; }
            p { font-family: 'Gowun Dodum', sans-serif; color: var(--text-color); margin-bottom: 30px; font-size: 1.1rem; }
            .btn-primary { font-family: 'Gowun Dodum', sans-serif; font-size: 1.1rem; padding: 12px 32px; border-radius: 30px; }
        </style>
        <div class="login-container" style="text-align:center;">
             <img src="/assets/logo.svg" style="width:120px; margin-bottom:10px;">
             <h1>Daily Bloom</h1>
             <p>당신의 하루를 아름답게 피워보세요.</p>
             <button class="btn-primary" id="google-btn">
                ${TRANSLATIONS.ko.login}
             </button>
        </div>
      `;
      this.shadowRoot.getElementById('google-btn').addEventListener('click', () => {
          signInWithPopup(auth, provider).catch((error) => {
              console.error("Login Error:", error);
              alert("Login failed: " + error.message);
          });
      });
  }
}
customElements.define('app-login', AppLogin);

class MyPage extends BaseComponent {
    render() {
        if(!store.state.user) return;
        const { user, blooms } = store.state;
        const t = store.t;

        this.shadowRoot.innerHTML = `
            <style>@import url('/style.css');
            .friend-actions { display: flex; gap: 5px; justify-content: center; margin-top: 5px; }
            .btn-small { font-size: 0.7rem; padding: 4px 8px; border-radius: 12px; background: #eee; color: #333; }
            .btn-danger { background: #ffebee; color: #c62828; }
            .friend-card { cursor: pointer; transition: transform 0.2s; }
            .friend-card:hover { transform: translateY(-2px); border-color: var(--primary-color); }
            </style>
            <div class="my-page-container">
                <div class="profile-section">
                    <div style="position: relative; cursor: pointer; width: 80px; height: 80px;" id="avatar-container">
                        <img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit: cover; border: 2px solid var(--primary-color);">
                        <div style="position: absolute; bottom: 0; right: 0; background: var(--primary-color); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 5px; box-sizing: border-box;">
                            <img src="/assets/camera.svg" style="width:100%; height:100%;">
                        </div>
                        <input type="file" id="photo-upload" style="display: none;" accept="image/*">
                    </div>
                    <div style="flex-grow: 1; margin-left: 15px;">
                        <h3 style="margin-bottom: 5px;">${user.nickname}</h3>
                        <p style="color: var(--accent-color); font-size: 0.9rem;">${user.email}</p>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; margin-bottom: 20px;">
                    <input type="text" id="nick-input" placeholder="${t.setNickname}" value="${user.nickname}" style="flex-grow:1">
                    <button class="btn-primary" id="save-nick">Save</button>
                </div>

                <div style="border-top: 1px solid var(--border-color); margin: 20px 0;"></div>

                <h3>${t.addFriend}</h3>
                <div class="friend-search">
                    <input type="email" id="friend-email" placeholder="${t.searchFriend}" style="flex-grow:1;">
                    <button class="btn-primary" id="add-friend-btn">+</button>
                </div>

                <h3>${t.friendList} (${blooms.length})</h3>
                <div class="friend-list" style="margin-bottom: 20px;">
                    ${blooms.length === 0 ? '<p style="grid-column: 1/-1; text-align: center; opacity: 0.6;">No blooms yet. Add a friend!</p>' : ''}
                    ${blooms.map(f => {
                        const isMutual = f.blooms && f.blooms.includes(user.uid);
                        return `
                        <div class="friend-card ${isMutual ? 'mutual' : ''}" data-uid="${f.uid}">
                            <img src="${f.photoURL || '/assets/logo.svg'}" style="width:40px; height:40px; border-radius:50%; margin-bottom:5px;">
                            <br>
                            <strong>${f.nickname}</strong>
                            ${isMutual ? `<br><span class="badge" style="margin-top:4px;">${t.mutual} 🌸</span>` : ''}
                            <div class="friend-actions">
                                <button class="btn-small btn-danger remove-bloom-btn" data-id="${f.uid}">Cancel</button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <button class="btn-primary" id="logout-btn" style="width: 100%; background-color: #9e9e9e;">${t.logout}</button>
            </div>
        `;

        const avatarContainer = this.shadowRoot.getElementById('avatar-container');
        const fileInput = this.shadowRoot.getElementById('photo-upload');
        
        avatarContainer.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64String = event.target.result;
                    this.shadowRoot.querySelector('img').src = base64String;
                    store.updatePhoto(base64String);
                };
                reader.readAsDataURL(file);
            }
        });

        this.shadowRoot.getElementById('save-nick').addEventListener('click', () => {
            const nick = this.shadowRoot.getElementById('nick-input').value;
            if(nick) store.updateNickname(nick);
        });

        this.shadowRoot.getElementById('add-friend-btn').addEventListener('click', () => {
            const email = this.shadowRoot.getElementById('friend-email').value;
            if(email) store.addBloom(email);
        });

        this.shadowRoot.querySelectorAll('.friend-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Prevent navigation if Cancel button was clicked
                if(e.target.classList.contains('remove-bloom-btn')) return;
                
                const friendUid = card.dataset.uid;
                const friend = blooms.find(f => f.uid === friendUid);
                if(friend) {
                    store.visitFriend(friend);
                    // Close MyPage modal/view if it's overlay (it's currently inline, so we just toggle hidden)
                    document.querySelector('my-page').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.querySelector('goal-list').classList.remove('hidden');
                }
            });
        });

        this.shadowRoot.querySelectorAll('.remove-bloom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop bubbling to card click
                store.removeBloom(e.target.dataset.id);
            });
        });

        this.shadowRoot.getElementById('logout-btn').addEventListener('click', () => {
            signOut(auth);
            location.reload(); 
        });
    }
}
customElements.define('my-page', MyPage);

class AppHeader extends BaseComponent {
  render() {
    const { t, theme, user } = store.state; 
    const strings = store.t;

    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 0;
          margin-bottom: 15px;
          position: relative;
          gap: 10px;
        }
        .brand { display: flex; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0; }
        .logo-icon { height: 32px; width: 32px; }
        .logo-text { font-family: 'Dancing Script', cursive; font-size: 1.5rem; font-weight: 700; color: var(--primary-color); margin-top: 3px; }
        
        @media (max-width: 480px) {
            .logo-text { display: none; }
        }

        .search-container {
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 400px;
            display: none;
            z-index: 1001;
            padding: 10px 0;
        }
        .search-container.active {
            display: block;
        }
        .search-input {
            width: 100%;
            padding: 10px 20px;
            border-radius: 25px;
            border: 2px solid var(--primary-color);
            background: var(--surface-color);
            color: var(--text-color);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            outline: none;
        }
        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.15);
            z-index: 1002;
            max-height: 60vh;
            overflow-y: auto;
        }
        .search-results.active { display: block; }
        .search-item {
            padding: 12px 15px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
        }
        .search-item:hover { background: var(--bg-color); }
        .search-item-text { font-weight: 600; font-size: 0.9rem; }
        .search-item-date { font-size: 0.75rem; color: var(--primary-color); }

        .viewing-indicator {
            flex-grow: 1;
            text-align: center;
            color: var(--primary-color);
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 0.9rem;
        }

        .controls { 
            display: flex; 
            gap: 8px; 
            align-items: center; 
            height: 40px; 
            flex-shrink: 0;
        }
        .avatar-small { 
            width: 32px; 
            height: 32px; 
            border-radius: 50%; 
            cursor: pointer; 
            border: 2px solid var(--primary-color); 
            display: block; 
            object-fit: cover;
        }
        .btn-icon {
            width: 36px; 
            height: 36px; 
            padding: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .noti-dropdown { 
            position: absolute; 
            top: 50px; 
            right: 0; 
            width: 300px;
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            display: none;
            z-index: 1000;
            max-height: 400px;
            overflow-y: auto;
        }
        .noti-dropdown.active { display: block; }
        .noti-item { padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; font-size: 0.85rem; }
        .noti-item:hover { background: var(--bg-color); }
      </style>
      <header>
        <div class="brand" id="logo">
            <img src="/assets/logo.svg" alt="Logo" class="logo-icon">
            <span class="logo-text">Daily Bloom</span>
        </div>
        
        ${store.state.viewingUser ? `
            <div class="viewing-indicator">
                <img src="${store.state.viewingUser.photoURL || '/assets/logo.svg'}" style="width:28px; height:28px; border-radius:50%; border: 2px solid var(--primary-color); object-fit: cover;">
                <span>${store.state.viewingUser.nickname}'s Bloom</span>
                <button class="btn-primary" id="home-btn" style="margin-left:10px; font-size:0.7rem; padding:4px 10px;">Back Home</button>
            </div>
        ` : (store.state.user ? `
            <div class="search-container" id="search-container">
                <input type="text" class="search-input" id="search-input" placeholder="${strings.searchPlaceholder}" autocomplete="off">
                <div class="search-results" id="search-results"></div>
            </div>
        ` : '')}
        
        <div class="controls">
            ${store.state.user && !store.state.viewingUser ? `
                <button class="btn-icon" id="search-toggle-btn">
                    <img src="/assets/search.svg" style="width:100%; height:100%; filter: var(--icon-filter);">
                </button>
            ` : ''}
            
            <button class="btn-icon" id="theme-btn">
                <img src="/assets/moon.svg" style="width:100%; height:100%; filter: var(--icon-filter);">
            </button>

            ${store.state.user ? `
                <div class="notification-wrapper">
                    <button class="btn-icon" id="noti-btn">
                        <img src="/assets/bell.svg" style="width:100%; height:100%; filter: var(--icon-filter);">
                        ${store.state.notifications.length > 0 ? `<div class="noti-badge">${store.state.notifications.length}</div>` : ''}
                    </button>
                    <div class="noti-dropdown" id="noti-dropdown">
                        ${store.state.notifications.length === 0 ? '<div style="padding:20px; text-align:center; opacity:0.6;">No notifications</div>' : ''}
                        ${store.state.notifications.map(n => `
                            <div class="noti-item" data-id="${n.id}">
                                <strong>${n.type === 'bloom' ? '🌸 Bloom' : n.type === 'tag' ? '📌 Tag' : '💬 Bloom'}</strong><br>
                                ${n.message}
                                ${n.date ? `<div style="font-size:0.7rem; color:var(--primary-color); margin-top:4px;">Date: ${n.date}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="profile-trigger" id="mypage-btn">
                    <img src="${user.photoURL || '/assets/logo.svg'}" class="avatar-small">
                </div>
            ` : ''}
            
            <button class="btn-primary" id="lang-btn" style="font-size:0.8rem; padding: 6px 12px;">${strings.toggleLang}</button>
        </div>
      </header>
    `;

    // Search Logic
    const searchInput = this.shadowRoot.getElementById('search-input');
    const searchResults = this.shadowRoot.getElementById('search-results');
    const searchContainer = this.shadowRoot.getElementById('search-container');
    const searchToggleBtn = this.shadowRoot.getElementById('search-toggle-btn');

    if (searchToggleBtn) {
        searchToggleBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
            } else {
                searchResults.classList.remove('active');
                searchInput.value = '';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            const results = store.searchTasks(query);
            if (results.length > 0) {
                searchResults.innerHTML = results.map(r => `
                    <div class="search-item" data-date="${r.date}">
                        <div class="search-item-text">${r.text}</div>
                        <div class="search-item-date">${r.date}</div>
                    </div>
                `).join('');
                searchResults.classList.add('active');
                
                // Add click events for results
                searchResults.querySelectorAll('.search-item').forEach(item => {
                    item.addEventListener('click', () => {
                        store.selectDate(item.dataset.date);
                        searchResults.classList.remove('active');
                        searchContainer.classList.remove('active');
                        searchInput.value = '';
                    });
                });
            } else {
                searchResults.classList.remove('active');
            }
        });

        // Close search on click outside
        document.addEventListener('click', (e) => {
            if (!this.shadowRoot.contains(e.target)) {
                if (searchResults) searchResults.classList.remove('active');
            }
        });
    }

    const homeBtn = this.shadowRoot.getElementById('home-btn');
    if(homeBtn) {
        homeBtn.addEventListener('click', () => {
            store.goHome();
        });
    }

    const notiBtn = this.shadowRoot.getElementById('noti-btn');
    const notiDropdown = this.shadowRoot.getElementById('noti-dropdown');
    
    if(notiBtn) {
        notiBtn.addEventListener('click', () => {
            notiDropdown.classList.toggle('active');
        });
        
        this.shadowRoot.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const n = store.state.notifications.find(noti => noti.id === id);
                if(!n) return;

                store.markNotificationRead(id);
                
                if (n.type === 'bloom') {
                    // Open MyPage and fill email
                    document.querySelector('my-page').classList.remove('hidden');
                    document.getElementById('main-content').classList.add('hidden');
                    document.querySelector('goal-list').classList.add('hidden');
                    
                    setTimeout(() => {
                        const myPage = document.querySelector('my-page');
                        const emailInput = myPage.shadowRoot.getElementById('friend-email');
                        if(emailInput) {
                            emailInput.value = n.senderEmail || '';
                            emailInput.focus();
                            alert(`Paste this email to Bloom back: ${n.senderEmail}`);
                        }
                    }, 100);
                } else if (n.type === 'comment' || n.type === 'tag') {
                    if (store.state.viewingUser) store.goHome(); // Return to my calendar first
                    if (n.date) {
                        store.selectDate(n.date);
                    }
                    notiDropdown.classList.remove('active');
                }
            });
        });
    }

    this.shadowRoot.getElementById('logo').addEventListener('click', () => {
        store.goHome();
        document.querySelector('my-page').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.querySelector('goal-list').classList.remove('hidden');
    });

    this.shadowRoot.getElementById('theme-btn').addEventListener('click', () => store.toggleTheme());
    this.shadowRoot.getElementById('lang-btn').addEventListener('click', () => store.toggleLang());
    
    const myPageBtn = this.shadowRoot.getElementById('mypage-btn');
    if(myPageBtn) myPageBtn.addEventListener('click', () => {
        document.querySelector('my-page').classList.toggle('hidden');
        document.getElementById('main-content').classList.toggle('hidden');
        document.querySelector('goal-list').classList.toggle('hidden');
    });
  }
}
customElements.define('app-header', AppHeader);

class GoalList extends BaseComponent {
    render() {
        const { currentDate, goals, viewingUser, lang } = store.state;
        const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const currentGoals = goals[monthStr] || [];
        const t = store.t;

        let title = `${t.goalsTitle} (${monthStr})`;
        if (viewingUser) {
            if (lang === 'ko') {
                title = `${viewingUser.nickname}의 목표 (${monthStr})`;
            } else {
                title = `${viewingUser.nickname}'s Goals (${monthStr})`;
            }
        }

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .goal-container { margin-bottom: 20px; }
                .goal-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
                .completed { text-decoration: line-through; color: #888; opacity: 0.6; }
                .add-form { display: flex; gap: 5px; margin-top: 10px; }
                .delete-goal-btn { background: none; color: #ff5252; cursor: pointer; font-size: 1.1rem; padding: 0 5px; opacity: 0.6; transition: opacity 0.2s; }
                .delete-goal-btn:hover { opacity: 1; }
            </style>
            <div class="card goal-container">
                <h3>${title}</h3>
                <div class="list">
                    ${currentGoals.length === 0 ? `<p>${t.noGoals}</p>` : ''}
                    ${currentGoals.map(g => `
                        <div class="goal-item">
                            <input type="checkbox" ${g.completed ? 'checked' : ''} data-id="${g.id}" ${viewingUser ? 'disabled' : ''}>
                            <span style="flex-grow:1" class="${g.completed ? 'completed' : ''}">${g.text}</span>
                            ${!viewingUser ? `<button class="delete-goal-btn" data-id="${g.id}">×</button>` : ''}
                        </div>
                    `).join('')}
                </div>
                ${!viewingUser ? `
                    <div class="add-form">
                        <input type="text" id="goal-input" placeholder="${t.addGoal}">
                        <button class="btn-primary" id="add-btn">+</button>
                    </div>
                ` : ''}
            </div>
        `;

        if (!viewingUser) {
            this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', (e) => store.toggleGoal(monthStr, e.target.dataset.id));
            });

            this.shadowRoot.querySelectorAll('.delete-goal-btn').forEach(btn => {
                btn.addEventListener('click', () => store.deleteGoal(btn.dataset.id));
            });

            const addBtn = this.shadowRoot.getElementById('add-btn');
            const input = this.shadowRoot.getElementById('goal-input');
            const addGoal = () => { if(input.value.trim()) { store.addGoal(monthStr, input.value.trim()); input.value = ''; } };
            addBtn.addEventListener('click', addGoal);
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') addGoal() });
        }
    }
}
customElements.define('goal-list', GoalList);

class CalendarView extends BaseComponent {
    constructor() {
        super();
        this.isJumping = false;
    }

    render() {
        const { currentDate, selectedDate, tasks } = store.state;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); 
        const today = new Date();

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: relative; }
                .nav-btn { background: none; border: 1px solid var(--border-color); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: var(--text-color); display: flex; align-items: center; justify-content: center; z-index: 2; }
                .nav-btn:hover { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                .calendar-grid { 
                    display: grid; 
                    grid-template-columns: repeat(7, minmax(0, 1fr)); 
                    gap: 8px; 
                    width: 100%; 
                    table-layout: fixed; 
                }
                .day-header { text-align: center; font-weight: bold; color: var(--primary-color); padding: 10px 0; overflow: hidden; font-size: 0.8rem; }
                .day-cell { 
                    background: var(--surface-color); 
                    min-height: 80px; 
                    border-radius: 8px; 
                    padding: 4px; 
                    cursor: pointer; 
                    display: flex; 
                    flex-direction: column; 
                    border: 1px solid transparent; 
                    transition: all 0.2s; 
                    overflow: visible; 
                    min-width: 0; 
                    position: relative; 
                }
                
                @media (min-width: 600px) {
                    .day-cell { min-height: 110px; padding: 8px; }
                    .day-header { font-size: 1rem; }
                }

                .day-cell:hover { border-color: var(--primary-color); transform: translateY(-2px); z-index: 10; }
                .day-number { font-weight: bold; margin-bottom: 4px; font-size: 0.8rem; }
                .today { background-color: rgba(233, 30, 99, 0.05); border: 1px solid var(--primary-hover); }
                .selected { border: 2px solid var(--primary-color); background-color: rgba(255, 193, 204, 0.1); }
                
                .task-preview { 
                    font-size: 0.7rem; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                    margin-bottom: 2px; 
                    width: 100%; 
                    height: 18px;
                    line-height: 14px;
                    padding: 2px 4px; 
                    border-radius: 4px; 
                    position: relative; 
                    box-sizing: border-box;
                    z-index: 1;
                    --bar-bg: var(--primary-color);
                    --bar-color: var(--on-primary);
                    display: flex;
                    align-items: center;
                }
                
                @media (min-width: 600px) {
                    .task-preview { font-size: 0.75rem; height: 22px; line-height: 18px; padding: 2px 8px; margin-bottom: 4px; }
                }

                .task-preview.completed { 
                    color: var(--accent-color); 
                    opacity: 0.7;
                    --bar-bg: var(--completed-bar-bg);
                }
                .task-preview.completed span {
                    text-decoration: line-through;
                }
                
                /* Multi-day task styling - Precision Connection */
                .task-preview.multi-day { 
                    background: var(--bar-bg); 
                    color: var(--bar-color); 
                    border-radius: 0; 
                    width: calc(100% + 26px); 
                    margin-left: -8px; 
                    margin-right: -18px; 
                    padding-left: 8px;
                    font-weight: 600;
                    z-index: 2;
                    box-shadow: 4px 0 0 var(--bar-bg), -4px 0 0 var(--bar-bg);
                    opacity: 1 !important;
                }
                .task-preview.multi-day.completed { color: var(--accent-color); }
                .task-preview.multi-day.completed span { text-decoration: line-through; }
                
                .task-preview.multi-day.start { 
                    border-top-left-radius: 11px; 
                    border-bottom-left-radius: 11px; 
                    margin-left: 0; 
                    width: calc(100% + 18px);
                    box-shadow: 4px 0 0 var(--bar-bg);
                }
                .task-preview.multi-day.end { 
                    border-top-right-radius: 11px; 
                    border-bottom-right-radius: 11px; 
                    margin-left: -8px;
                    margin-right: 0; 
                    width: calc(100% + 8px);
                    padding-right: 8px;
                    box-shadow: -4px 0 0 var(--bar-bg);
                }
                .task-preview.multi-day.no-bleed {
                    width: calc(100% + 8px) !important;
                    margin-right: -8px !important;
                    box-shadow: -4px 0 0 var(--bar-bg);
                }

                .title-clickable { cursor: pointer; padding: 4px 12px; border-radius: 12px; transition: all 0.2s; font-size: 1.2rem; font-weight: bold; display: flex; align-items: center; gap: 6px; user-select: none; }
                @media (min-width: 600px) { .title-clickable { font-size: 1.5rem; } }
                .title-clickable:hover { background: rgba(255, 193, 204, 0.2); color: var(--primary-hover); }
                .title-clickable::after { content: '▾'; font-size: 0.8rem; opacity: 0.5; }

                .jump-overlay {
                    position: absolute;
                    top: calc(100% + 10px);
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90vw;
                    max-width: 320px;
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    padding: 15px;
                    z-index: 1000;
                    display: none;
                    flex-direction: column;
                    gap: 15px;
                }
                .picker-section { display: flex; flex-direction: column; gap: 8px; }
                .picker-label { font-size: 0.7rem; font-weight: bold; color: var(--primary-hover); text-transform: uppercase; }
                .picker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                .picker-item { padding: 8px 0; text-align: center; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.85rem; cursor: pointer; background: var(--bg-color); color: var(--text-color); }
                .picker-item.active { background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
                .year-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
                .year-item { flex-shrink: 0; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--border-color); font-size: 0.85rem; cursor: pointer; background: var(--bg-color); color: var(--text-color); }
                .year-item.active { background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
            </style>
            <div class="card" style="overflow: visible;">
                <div class="calendar-header">
                    <button id="prev-btn" class="nav-btn">‹</button>
                    <div id="title-container" style="position: relative; z-index: 100;">
                        <h2 id="title-display" class="title-clickable">${year}. ${String(month + 1).padStart(2, '0')}</h2>
                        ${this.isJumping ? `
                            <div class="jump-overlay" id="jump-overlay" style="display: flex;">
                                <div class="picker-section">
                                    <div class="picker-label">Year</div>
                                    <div class="year-scroll">
                                        ${Array.from({length: 16}, (_, i) => 2020 + i).map(y => `<div class="year-item ${y === year ? 'active' : ''}" data-year="${y}">${y}</div>`).join('')}
                                    </div>
                                </div>
                                <div class="picker-section">
                                    <div class="picker-label">Month</div>
                                    <div class="picker-grid">
                                        ${Array.from({length: 12}, (_, i) => i).map(m => `<div class="picker-item ${m === month ? 'active' : ''}" data-month="${m}">${String(m + 1).padStart(2, '0')}</div>`).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <button id="next-btn" class="nav-btn">›</button>
                </div>
                <div class="calendar-grid">
                    <div class="day-header">S</div><div class="day-header">M</div><div class="day-header">T</div><div class="day-header">W</div><div class="day-header">T</div><div class="day-header">F</div><div class="day-header">S</div>
                    ${Array(startDayOfWeek).fill('<div class="empty"></div>').join('')}
                    ${Array.from({length: daysInMonth}, (_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = today.toDateString() === new Date(year, month, d).toDateString();
                        const isSelected = selectedDate === dateStr;
                        const dayTasks = tasks[dateStr] || [];
                        const dayOfWeek = new Date(year, month, d).getDay();
                        return `
                            <div class="day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                                <div class="day-number">${d}</div>
                                ${dayTasks.slice(0, 3).map(t => {
                                    const isMulti = t.duration && t.duration > 1;
                                    let multiClass = '';
                                    let taskText = t.text;
                                    if (isMulti) {
                                        multiClass = 'multi-day';
                                        if (t.dayIndex === 0) multiClass += ' start';
                                        else if (t.dayIndex === t.duration - 1) multiClass += ' end';
                                        if (dayOfWeek === 6 && !multiClass.includes('end')) multiClass += ' no-bleed';
                                        if (t.dayIndex > 0) taskText = '';
                                    }
                                    const checkmark = t.completed ? '✔ ' : '';
                                    const content = taskText ? `<span>${checkmark}${taskText}</span>` : (isMulti ? '&nbsp;' : `<span>${checkmark}</span>`);
                                    return `<div class="task-preview ${t.completed ? 'completed' : ''} ${multiClass}">${content}</div>`;
                                }).join('')}
                                ${dayTasks.length > 3 ? `<div class="task-preview" style="color:var(--primary-color); background:none; padding:0; height:auto;">+${dayTasks.length - 3}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        this.shadowRoot.getElementById('title-display').addEventListener('click', (e) => {
            e.stopPropagation();
            this.isJumping = !this.isJumping;
            this.render();
        });

        if (this.isJumping) {
            this.shadowRoot.querySelectorAll('.year-item').forEach(item => {
                item.addEventListener('click', () => {
                    const newYear = parseInt(item.dataset.year);
                    const newDate = new Date(newYear, month, 1);
                    store.setState({ currentDate: newDate, selectedDate: null });
                });
            });
            this.shadowRoot.querySelectorAll('.picker-item').forEach(item => {
                item.addEventListener('click', () => {
                    const newMonth = parseInt(item.dataset.month);
                    const newDate = new Date(year, newMonth, 1);
                    store.setState({ currentDate: newDate, selectedDate: null });
                    this.isJumping = false;
                });
            });
            document.addEventListener('click', (e) => {
                if (this.isJumping && !this.shadowRoot.contains(e.target)) {
                    this.isJumping = false;
                    this.render();
                }
            }, { once: true });
        }

        this.shadowRoot.querySelectorAll('.day-cell').forEach(cell => cell.addEventListener('click', () => store.selectDate(cell.dataset.date)));
        this.shadowRoot.getElementById('prev-btn').addEventListener('click', () => store.prevMonth());
        this.shadowRoot.getElementById('next-btn').addEventListener('click', () => store.nextMonth());
    }
}
customElements.define('calendar-view', CalendarView);

class DailyView extends BaseComponent {
    render() {
        const { selectedDate, viewingUser, lang } = store.state;
        if (!selectedDate) {
            this.shadowRoot.innerHTML = `
                <style>@import url('/style.css'); .placeholder { text-align: center; padding: 40px; color: var(--text-color); opacity: 0.6; background: var(--surface-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; height: 100%; } :host { height: 100%; }</style>
                <div class="placeholder"><p>${store.t.selectDatePrompt}</p></div>
            `;
            return;
        }
        const dateStr = selectedDate;
        const targetUid = viewingUser ? viewingUser.uid : store.state.user.uid;
        const commentKey = `${targetUid}_${dateStr}`;
        
        if(!store.state.comments[commentKey]) store.loadComments(dateStr);

        const tasks = store.state.tasks[dateStr] || [];
        const comments = store.state.comments[commentKey] || [];

        let taskTitle = 'Tasks';
        if (viewingUser) {
            if (lang === 'ko') {
                taskTitle = `${viewingUser.nickname}의 일정`;
            } else {
                taskTitle = `${viewingUser.nickname}'s Tasks`;
            }
        }

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                :host { display: block; }
                .daily-panel { background: var(--surface-color); border-radius: 12px; padding: 20px; min-height: 200px; display: block; position: relative; }
                .task-item, .comment-item { border-bottom: 1px solid var(--border-color); padding: 10px 0; }
                .completed { text-decoration: line-through; opacity: 0.5; }
                .section-title { font-size: 1.1rem; font-weight: bold; margin: 20px 0 10px; color: var(--primary-color); }
                .input-group { display: flex; gap: 5px; margin-top: 10px; position: relative; }
                
                .mobile-close { display: none; position: absolute; top: 15px; right: 15px; font-size: 1.5rem; color: var(--text-color); cursor: pointer; z-index: 10; }

                @media (max-width: 1024px) {
                    :host {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        z-index: 2000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .daily-panel {
                        width: 100%;
                        max-width: 500px;
                        max-height: 80vh;
                        overflow-y: auto;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .mobile-close { display: block; }
                }

                .friend-suggestions {
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    width: 200px;
                    max-height: 150px;
                    overflow-y: auto;
                    display: none;
                    z-index: 10;
                }
                .friend-suggestions.active { display: block; }
                .suggestion-item { padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
                .suggestion-item:hover { background: var(--bg-color); }
                .suggestion-item img { width: 24px; height: 24px; border-radius: 50%; }
            </style>
            
            <div class="daily-panel">
                <span class="mobile-close" id="close-view">&times;</span>
                <h2 style="margin-bottom:10px;">${dateStr}</h2>
                <div class="section-title">${taskTitle}</div>
                <div id="task-list">
                    ${tasks.length === 0 ? `<p style="opacity:0.6; font-size:0.9rem;">${store.t.noTasks}</p>` : ''}
                    ${tasks.map((t, index) => {
                        const isMulti = t.duration && t.duration > 1;
                        return `
                        <div class="task-item" draggable="${!viewingUser}" data-index="${index}" style="display:flex; align-items:center; gap:12px; cursor:${viewingUser ? 'default' : 'grab'}; padding: 8px 0;">
                            <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}" ${viewingUser ? 'disabled' : ''}>
                            <span style="flex-grow:1" class="${t.completed ? 'completed' : ''}">${t.text}${isMulti ? ' (Multiple)' : ''}</span>
                            ${!viewingUser ? `<button class="delete-btn" data-id="${t.id}" style="color:red; background:none; font-size: 1.2rem; cursor: pointer;">×</button>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
                ${!viewingUser ? `
                    <div class="input-group">
                        <input type="text" id="task-input" placeholder="${store.t.addTask}" style="flex-grow:1" autocomplete="off">
                        <button class="btn-primary" id="add-task-btn">+</button>
                        <div class="friend-suggestions" id="suggestions"></div>
                    </div>
                ` : ''}

                <div class="section-title" style="margin-top: 20px;">${store.t.commentsTitle}</div>
                <div id="comment-list" style="overflow-y:auto; max-height: 200px;">
                    ${comments.length === 0 ? `<p style="opacity:0.5; font-size:0.85rem; text-align: center; margin: 15px 0;">${store.t.noComments}</p>` : ''}
                    ${comments.map(c => {
                        const isAuthor = store.state.user && c.fromUserId === store.state.user.uid;
                        return `
                        <div class="comment-item" style="display:flex; gap:10px; align-items:flex-start; margin-bottom: 10px;">
                            <img src="${c.authorPhoto || '/assets/logo.svg'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-top:3px; cursor:pointer;" class="commenter-avatar" data-uid="${c.fromUserId}">
                            <div style="flex-grow:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="font-weight:bold; font-size:0.8rem; color:var(--primary-hover); cursor:pointer;" class="commenter-name" data-uid="${c.fromUserId}">${c.author}</div>
                                    ${isAuthor ? `
                                        <div style="display:flex; gap:8px;">
                                            <button class="edit-comment-btn" data-id="${c.id}" data-text="${c.text}" style="background:none; border:none; color:var(--accent-color); font-size:0.7rem; cursor:pointer; padding:0;">Edit</button>
                                            <button class="delete-comment-btn" data-id="${c.id}" style="background:none; border:none; color:#ff5252; font-size:0.7rem; cursor:pointer; padding:0;">Delete</button>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="comment-text" style="font-size:0.9rem;">${c.text}</div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="input-group" style="margin-top: 5px;">
                    <input type="text" id="comment-input" placeholder="${store.t.addComment}" style="flex-grow:1">
                    <button class="btn-primary" id="add-comment-btn">${store.t.send}</button>
                </div>
            </div>
        `;
        
        const closeBtn = this.shadowRoot.getElementById('close-view');
        if(closeBtn) closeBtn.addEventListener('click', () => store.setState({ selectedDate: null }));

        this.shadowRoot.querySelectorAll('.commenter-name, .commenter-avatar').forEach(el => {
            el.addEventListener('click', () => {
                const uid = el.dataset.uid;
                if(uid) store.visitUserByUid(uid);
            });
        });

        this.shadowRoot.querySelectorAll('.edit-comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const commentItem = btn.closest('.comment-item');
                const textDiv = commentItem.querySelector('.comment-text');
                const oldText = textDiv.textContent;

                // Toggle inline edit mode
                textDiv.innerHTML = `
                    <div style="display:flex; gap:5px; margin-top:5px;">
                        <input type="text" class="edit-input" value="${oldText}" style="flex-grow:1; font-size:0.9rem; padding:4px 8px;">
                        <button class="save-edit-btn btn-primary" style="font-size:0.7rem; padding:4px 8px;">Save</button>
                        <button class="cancel-edit-btn" style="background:none; border:1px solid var(--border-color); border-radius:12px; font-size:0.7rem; padding:4px 8px; cursor:pointer; color:var(--text-color);">Cancel</button>
                    </div>
                `;

                const editInput = textDiv.querySelector('.edit-input');
                editInput.focus();

                textDiv.querySelector('.save-edit-btn').addEventListener('click', () => {
                    const newText = editInput.value.trim();
                    if (newText && newText !== oldText) {
                        store.updateComment(id, newText);
                    } else {
                        textDiv.textContent = oldText; // Restore if no change
                    }
                });

                textDiv.querySelector('.cancel-edit-btn').addEventListener('click', () => {
                    textDiv.textContent = oldText;
                });

                editInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const newText = editInput.value.trim();
                        if (newText && newText !== oldText) {
                            store.updateComment(id, newText);
                        } else {
                            textDiv.textContent = oldText;
                        }
                    }
                });
            });
        });

        this.shadowRoot.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                store.deleteComment(id);
            });
        });

        const addComment = () => { const input = this.shadowRoot.getElementById('comment-input'); if (input.value.trim()) { store.addComment(dateStr, input.value.trim()); input.value = ''; } };
        this.shadowRoot.getElementById('add-comment-btn').addEventListener('click', addComment);
        this.shadowRoot.getElementById('comment-input').addEventListener('keypress', (e) => { if(e.key==='Enter') addComment(); });

        this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', (e) => store.toggleTask(dateStr, e.target.dataset.id)));
        this.shadowRoot.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => store.deleteTask(dateStr, e.target.dataset.id)));
        
        // ... (rest of the suggestion logic etc) ...
        const taskInput = this.shadowRoot.getElementById('task-input');
        const suggestionsBox = this.shadowRoot.getElementById('suggestions');
        if(taskInput) {
            taskInput.addEventListener('keypress', (e) => { if(e.key==='Enter') { const input = this.shadowRoot.getElementById('task-input'); if (input.value.trim()) { store.addTask(dateStr, input.value.trim()); input.value = ''; } } });
            taskInput.addEventListener('input', (e) => {
                const val = e.target.value;
                const lastAt = val.lastIndexOf('@');
                if (lastAt !== -1) {
                    const query = val.substring(lastAt + 1).toLowerCase();
                    const mutuals = store.state.blooms.filter(f => f.blooms && f.blooms.includes(store.state.user.uid));
                    const matches = mutuals.filter(f => f.nickname.toLowerCase().startsWith(query));
                    if (matches.length > 0) {
                        suggestionsBox.innerHTML = matches.map(f => `<div class="suggestion-item" data-nick="${f.nickname}"><img src="${f.photoURL || '/assets/logo.svg'}">${f.nickname}</div>`).join('');
                        suggestionsBox.classList.add('active');
                        suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const nick = item.dataset.nick;
                                const before = val.substring(0, lastAt);
                                taskInput.value = `${before}@${nick} `;
                                taskInput.focus();
                                suggestionsBox.classList.remove('active');
                            });
                        });
                    } else { suggestionsBox.classList.remove('active'); }
                } else { suggestionsBox.classList.remove('active'); }
            });
        }
    }
}customElements.define('daily-view', DailyView);

function renderApp() {
    document.querySelector('calendar-view').render();
    document.querySelector('daily-view').render();
    document.querySelector('goal-list').render();
    document.querySelector('app-header').render(); 
}
store.addEventListener('state-changed', renderApp);
