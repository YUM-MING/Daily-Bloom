
import { auth, provider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot } from './firebase-config.js';

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
    this.setState({ selectedDate: date });
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
      this.setState({ viewingUser: null, selectedDate: null });
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

  async sendNotification(toUserId, type, message, senderEmail = null) {
      await addDoc(collection(db, "notifications"), {
          toUserId,
          fromUser: this.state.user.nickname,
          senderEmail: senderEmail || this.state.user.email, // Add email for bloom back
          type, // 'bloom', 'comment', 'tag'
          message,
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

    const tagMatch = text.match(/@(\S+)/);
    let taggedUid = null;
    let cleanText = text;
    let formattedText = text;

    if (tagMatch) {
        const taggedName = tagMatch[1];
        cleanText = text.replace(`@${taggedName}`, '').trim(); // Remove @Name from text
        formattedText = `${cleanText} (with ${taggedName})`; // Format for myself

        const friend = this.state.blooms.find(b => b.nickname === taggedName);
        if (friend) {
            if (friend.blooms && friend.blooms.includes(this.state.user.uid)) {
                taggedUid = friend.uid;
            } else {
                alert(`Cannot tag @${taggedName}: You are not mutual Blooms yet! They need to Bloom you back. 🌸`);
            }
        }
    }

    const newTask = {
        text: formattedText, // Save formatted text for myself
        date: dateStr,
        userId: this.state.user.uid,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    // Optimistic Update
    const currentTasks = this.state.tasks[dateStr] || [];
    const tempId = 'temp-' + Date.now();
    const optimisticTask = { id: tempId, ...newTask };
    
    const updatedTasks = { ...this.state.tasks, [dateStr]: [...currentTasks, optimisticTask] };
    this.setState({ tasks: updatedTasks });

    try {
        await addDoc(collection(db, "tasks"), newTask);
    } catch (e) {
        console.error("Failed to add task:", e);
    }

    if (taggedUid) {
        await addDoc(collection(db, "tasks"), {
            ...newTask,
            userId: taggedUid,
            text: `${cleanText} (with ${this.state.user.nickname})` // Format for friend: "Task (with Me)"
        });
        
        await this.sendNotification(taggedUid, 'tag', `${this.state.user.nickname}님이 일정에 회원님을 태그했습니다: ${cleanText}`);
        
        alert(`Shared event with @${tagMatch[1]}!`);
    }
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
  
  async loadComments(dateStr) {
      if(!this.state.user) return;
      // Comments logic needs to handle viewing user. If viewing friend, we need comments ON FRIEND'S date.
      // Assuming comments have `toUserId` field.
      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : this.state.user.uid;
      
      const q = query(collection(db, "comments"), where("toUserId", "==", targetUid), where("date", "==", dateStr));
      onSnapshot(q, (snapshot) => {
          const comments = {};
          const dateComments = [];
          snapshot.forEach(doc => dateComments.push({id: doc.id, ...doc.data()}));
          
          const allComments = { ...this.state.comments };
          allComments[dateStr] = dateComments;
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
          text
      });
      
      if(targetUid !== this.state.user.uid) {
          await this.sendNotification(targetUid, 'comment', `${this.state.user.nickname}님이 회원님의 달력에 댓글을 남겼습니다!`);
      }
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
          padding: 20px 0;
          margin-bottom: 20px;
          position: relative;
        }
        .brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .logo-icon { height: 40px; width: 40px; }
        .logo-text { font-family: 'Dancing Script', cursive; font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-top: 5px; }
        .controls { 
            display: flex; 
            gap: 12px; 
            z-index: 1; 
            align-items: center; 
            height: 40px; 
        }
        .avatar-small { 
            width: 36px; 
            height: 36px; 
            border-radius: 50%; 
            cursor: pointer; 
            border: 2px solid var(--primary-color); 
            display: block; 
        }
        .profile-trigger {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 40px; 
        }
        #theme-btn {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .notification-wrapper { position: relative; }
        .noti-badge { position: absolute; top: -2px; right: -2px; background: red; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 10px; display: flex; align-items: center; justify-content: center; }
        .noti-dropdown { position: absolute; top: 50px; right: 0; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 8px; width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 100; max-height: 300px; overflow-y: auto; }
        .noti-dropdown.active { display: block; }
        .noti-item { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; cursor: pointer; }
        .noti-item:hover { background: var(--bg-color); }
        .noti-item.read { opacity: 0.5; }
      </style>
      <header>
        <div class="brand" id="logo">
            <img src="/assets/logo.svg" alt="Logo" class="logo-icon">
            <span class="logo-text">Daily Bloom</span>
        </div>
        
        ${store.state.viewingUser ? `
            <div style="flex-grow:1; text-align:center; color: var(--primary-color); font-weight:bold;">
                Visiting: ${store.state.viewingUser.nickname}
                <button class="btn-primary" id="home-btn" style="margin-left:10px; font-size:0.8rem; padding:4px 10px;">Return Home</button>
            </div>
        ` : ''}
        
        <div class="controls">
            <button class="btn-icon" id="theme-btn" style="width:40px; height:40px; padding:8px;">
                <img src="/assets/moon.svg" style="width:100%; height:100%; filter: var(--icon-filter);">
            </button>

            ${store.state.user ? `
                <div class="notification-wrapper">
                    <button class="btn-icon" id="noti-btn" style="width:40px; height:40px; padding:8px;">
                        <img src="/assets/bell.svg" style="width:100%; height:100%; filter: var(--icon-filter);">
                        ${store.state.notifications.length > 0 ? `<div class="noti-badge">${store.state.notifications.length}</div>` : ''}
                    </button>
                    <div class="noti-dropdown" id="noti-dropdown">
                        ${store.state.notifications.length === 0 ? '<div style="padding:20px; text-align:center; opacity:0.6;">No notifications</div>' : ''}
                        ${store.state.notifications.map(n => `
                            <div class="noti-item" data-id="${n.id}" data-type="${n.type}" data-email="${n.senderEmail || ''}">
                                <strong>${n.type === 'bloom' ? '🌸 Bloom' : n.type === 'tag' ? '📌 Tag' : '💬 Comment'}</strong><br>
                                ${n.message}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="profile-trigger" id="mypage-btn">
                    <img src="${store.state.user.photoURL || '/assets/logo.svg'}" class="avatar-small">
                </div>
            ` : ''}
            
            <button class="btn-primary" id="lang-btn" style="font-size:0.8rem; padding: 6px 12px;">${strings.toggleLang}</button>
        </div>
      </header>
    `;

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
                store.markNotificationRead(item.dataset.id);
                const type = item.dataset.type;
                const email = item.dataset.email;

                if (type === 'bloom') {
                    // Open MyPage and fill email
                    document.querySelector('my-page').classList.remove('hidden');
                    document.getElementById('main-content').classList.add('hidden');
                    document.querySelector('goal-list').classList.add('hidden');
                    
                    // Delay slightly to ensure render
                    setTimeout(() => {
                        const myPage = document.querySelector('my-page');
                        const emailInput = myPage.shadowRoot.getElementById('friend-email');
                        if(emailInput) {
                            emailInput.value = email;
                            emailInput.focus();
                            alert(`Paste this email to Bloom back: ${email}`); // Temporary hint as auto-fill might be tricky across shadow DOM boundaries if not rendered yet
                        }
                    }, 100);
                }
            });
        });
    }

    this.shadowRoot.getElementById('logo').addEventListener('click', () => {
        store.selectDate(null);
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
        const date = store.state.currentDate;
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const goals = store.state.goals[monthStr] || [];

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .goal-container { margin-bottom: 20px; }
                .goal-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
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
            cb.addEventListener('change', (e) => store.toggleGoal(monthStr, e.target.dataset.id));
        });

        const addBtn = this.shadowRoot.getElementById('add-btn');
        const input = this.shadowRoot.getElementById('goal-input');
        const addGoal = () => { if(input.value.trim()) { store.addGoal(monthStr, input.value.trim()); input.value = ''; } };
        addBtn.addEventListener('click', addGoal);
        input.addEventListener('keypress', (e) => { if(e.key === 'Enter') addGoal() });
    }
}
customElements.define('goal-list', GoalList);

class CalendarView extends BaseComponent {
    render() {
        if (store.state.selectedDate) return; 
        const date = store.state.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); 
        const today = new Date();

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .nav-btn { background: none; border: 1px solid var(--border-color); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: var(--text-color); display: flex; align-items: center; justify-content: center; }
                .nav-btn:hover { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
                .day-header { text-align: center; font-weight: bold; color: var(--primary-color); padding: 10px 0; }
                .day-cell { background: var(--surface-color); min-height: 100px; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; flex-direction: column; border: 1px solid transparent; transition: all 0.2s; overflow: hidden; }
                .day-cell:hover { border-color: var(--primary-color); transform: translateY(-2px); }
                .day-number { font-weight: bold; margin-bottom: 5px; }
                .today { background-color: rgba(233, 30, 99, 0.1); border: 1px solid var(--primary-color); }
                .task-preview { font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; max-width: 100%; }
                .task-preview.completed { text-decoration: line-through; opacity: 0.5; color: var(--accent-color); }
            </style>
            <div class="card">
                <div class="calendar-header">
                    <button id="prev-btn" class="nav-btn">‹</button>
                    <h2>${year}. ${String(month + 1).padStart(2, '0')}</h2>
                    <button id="next-btn" class="nav-btn">›</button>
                </div>
                <div class="calendar-grid">
                    <div class="day-header">Sun</div><div class="day-header">Mon</div><div class="day-header">Tue</div><div class="day-header">Wed</div><div class="day-header">Thu</div><div class="day-header">Fri</div><div class="day-header">Sat</div>
                    ${Array(startDayOfWeek).fill('<div class="empty"></div>').join('')}
                    ${Array.from({length: daysInMonth}, (_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = today.toDateString() === new Date(year, month, d).toDateString();
                        const tasks = store.state.tasks[dateStr] || [];
                        return `
                            <div class="day-cell ${isToday ? 'today' : ''}" data-date="${dateStr}">
                                <div class="day-number">${d}</div>
                                ${tasks.slice(0, 3).map(t => `<div class="task-preview ${t.completed ? 'completed' : ''}">${t.completed ? '✔' : '•'} ${t.text}</div>`).join('')}
                                ${tasks.length > 3 ? `<div class="task-preview" style="color:var(--primary-color)">+${tasks.length - 3} more</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        this.shadowRoot.querySelectorAll('.day-cell').forEach(cell => cell.addEventListener('click', () => store.selectDate(cell.dataset.date)));
        this.shadowRoot.getElementById('prev-btn').addEventListener('click', () => store.prevMonth());
        this.shadowRoot.getElementById('next-btn').addEventListener('click', () => store.nextMonth());
    }
}
customElements.define('calendar-view', CalendarView);

class DailyView extends BaseComponent {
    render() {
        if (!store.state.selectedDate) {
            this.shadowRoot.innerHTML = `
                <style>@import url('/style.css'); .placeholder { text-align: center; padding: 40px; color: var(--text-color); opacity: 0.6; background: var(--surface-color); border-radius: 12px; display: flex; align-items: center; justify-content: center; height: 100%; } :host { height: 100%; }</style>
                <div class="placeholder"><p>${store.t.selectDatePrompt}</p></div>
            `;
            return;
        }
        const dateStr = store.state.selectedDate;
        if(!store.state.comments[dateStr]) store.loadComments(dateStr);

        const tasks = store.state.tasks[dateStr] || [];
        const comments = store.state.comments[dateStr] || [];

        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                :host { display: block; }
                .daily-panel { background: var(--surface-color); border-radius: 12px; padding: 20px; min-height: 400px; display: flex; flex-direction: column; }
                .task-item, .comment-item { border-bottom: 1px solid var(--border-color); padding: 10px 0; }
                .completed { text-decoration: line-through; opacity: 0.5; }
                .section-title { font-size: 1.1rem; font-weight: bold; margin: 20px 0 10px; color: var(--primary-color); }
                .input-group { display: flex; gap: 5px; margin-top: 10px; position: relative; }
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
                <h2 style="margin-bottom:10px;">${dateStr}</h2>
                <div class="section-title">Tasks</div>
                <div id="task-list">
                    ${tasks.length === 0 ? `<p style="opacity:0.6; font-size:0.9rem;">${store.t.noTasks}</p>` : ''}
                    ${tasks.map((t, index) => `
                        <div class="task-item" draggable="true" data-index="${index}" style="display:flex; align-items:center; gap:12px; cursor:grab; padding: 8px 0;">
                            <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}">
                            <span style="flex-grow:1" class="${t.completed ? 'completed' : ''}">${t.text}</span>
                            <button class="delete-btn" data-id="${t.id}" style="color:red; background:none; font-size: 1.2rem; cursor: pointer;">×</button>
                        </div>
                    `).join('')}
                </div>
                <div class="input-group">
                    <input type="text" id="task-input" placeholder="${store.t.addTask}" style="flex-grow:1" autocomplete="off">
                    <button class="btn-primary" id="add-task-btn">+</button>
                    <div class="friend-suggestions" id="suggestions"></div>
                </div>

                <div class="section-title">${store.t.commentsTitle}</div>
                <div id="comment-list" style="flex-grow:1; overflow-y:auto; max-height: 200px;">
                    ${comments.length === 0 ? `<p style="opacity:0.6; font-size:0.9rem;">${store.t.noComments}</p>` : ''}
                    ${comments.map(c => `
                        <div class="comment-item">
                            <div style="font-weight:bold; font-size:0.8rem; color:var(--primary-hover)">${c.author}</div>
                            <div>${c.text}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="input-group">
                    <input type="text" id="comment-input" placeholder="${store.t.addComment}" style="flex-grow:1">
                    <button class="btn-primary" id="add-comment-btn">Send</button>
                </div>
            </div>
        `;
        
        this.shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', (e) => store.toggleTask(dateStr, e.target.dataset.id)));
                this.shadowRoot.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => store.deleteTask(dateStr, e.target.dataset.id)));
                
                // Drag and Drop Logic
                const taskList = this.shadowRoot.getElementById('task-list');
                let draggedItem = null;
        
                if (taskList) {
                    taskList.addEventListener('dragstart', (e) => {
                        draggedItem = e.target.closest('.task-item');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/html', draggedItem.innerHTML); // Required for Firefox
                        draggedItem.style.opacity = '0.5';
                    });
        
                    taskList.addEventListener('dragover', (e) => {
                        e.preventDefault(); // Necessary to allow dropping
                        e.dataTransfer.dropEffect = 'move';
                        
                        const targetItem = e.target.closest('.task-item');
                        if (targetItem && targetItem !== draggedItem) {
                            const bounding = targetItem.getBoundingClientRect();
                            const offset = bounding.y + (bounding.height / 2);
                            if (e.clientY - offset > 0) {
                                targetItem.after(draggedItem);
                            } else {
                                targetItem.before(draggedItem);
                            }
                        }
                    });
        
                    taskList.addEventListener('dragend', (e) => {
                        draggedItem.style.opacity = '1';
                        draggedItem = null;
                        
                        // Calculate new order based on DOM order
                        const newOrderIndices = Array.from(taskList.querySelectorAll('.task-item')).map(item => parseInt(item.dataset.index));
                        // We need to map these indices back to the original task objects to create a reordered array
                        // But dataset.index is the OLD index.
                        // Better approach: Get IDs from checkboxes or buttons inside the reordered DOM elements
                        const newOrderIds = Array.from(taskList.querySelectorAll('input[type="checkbox"]')).map(cb => cb.dataset.id);
                        
                        const reorderedTasks = newOrderIds.map(id => tasks.find(t => t.id === id));
                        store.reorderTasks(dateStr, reorderedTasks);
                    });
                }
        
                const addTask = () => { const input = this.shadowRoot.getElementById('task-input'); if (input.value.trim()) { store.addTask(dateStr, input.value.trim()); input.value = ''; } };
        this.shadowRoot.getElementById('add-task-btn').addEventListener('click', addTask);
        
        const taskInput = this.shadowRoot.getElementById('task-input');
        const suggestionsBox = this.shadowRoot.getElementById('suggestions');

        taskInput.addEventListener('keypress', (e) => { if(e.key==='Enter') addTask(); });
        
        // Suggestion Logic
        taskInput.addEventListener('input', (e) => {
            const val = e.target.value;
            const lastAt = val.lastIndexOf('@');
            if (lastAt !== -1) {
                const query = val.substring(lastAt + 1).toLowerCase();
                // Filter MUTUAL blooms
                const mutuals = store.state.blooms.filter(f => f.blooms && f.blooms.includes(store.state.user.uid));
                const matches = mutuals.filter(f => f.nickname.toLowerCase().startsWith(query));
                
                if (matches.length > 0) {
                    suggestionsBox.innerHTML = matches.map(f => `
                        <div class="suggestion-item" data-nick="${f.nickname}">
                            <img src="${f.photoURL || '/assets/logo.svg'}">
                            ${f.nickname}
                        </div>
                    `).join('');
                    suggestionsBox.classList.add('active');
                    
                    suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const nick = item.dataset.nick;
                            const before = val.substring(0, lastAt);
                            // Replace @part with @Nickname + space
                            taskInput.value = `${before}@${nick} `;
                            taskInput.focus();
                            suggestionsBox.classList.remove('active');
                        });
                    });
                } else {
                    suggestionsBox.classList.remove('active');
                }
            } else {
                suggestionsBox.classList.remove('active');
            }
        });

        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!this.shadowRoot.contains(e.target)) suggestionsBox.classList.remove('active');
        });
    }
}
customElements.define('daily-view', DailyView);

function renderApp() {
    document.querySelector('calendar-view').render();
    document.querySelector('daily-view').render();
    document.querySelector('goal-list').render();
    document.querySelector('app-header').render(); 
}
store.addEventListener('state-changed', renderApp);
