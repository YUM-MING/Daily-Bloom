
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
    copyInvite: "🔗 Copy Invite Link (Auto Mutual Bloom)",
    inviteDesc: "Send this link to a friend for instant mutual blooming!",
    installApp: "⬇️ Install App",
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
    copyInvite: "🔗 내 초대 링크 복사하기 (자동 맞블룸)",
    inviteDesc: "링크를 친구에게 보내면 수락 한 번으로 서로 친구가 됩니다.",
    installApp: "⬇️ 앱 설치하고 편하게 쓰기",
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
      deferredPrompt: null, // For PWA install
    };

    this.initTheme();
    this.initAuth();
    
    // Capture PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.state.deferredPrompt = e;
        // Dispatch event to let components know install is available
        this.dispatchEvent(new CustomEvent('install-available'));
    });
  }

  async installApp() {
      const promptEvent = this.state.deferredPrompt;
      if (!promptEvent) return;
      
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      console.log('User choice:', result.outcome);
      
      this.state.deferredPrompt = null;
      this.dispatchEvent(new CustomEvent('state-changed', { detail: this.state }));
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
                  
                  // Run migration for legacy tasks
                  this.migrateLegacyTasks();

                  // Check for invite link
                  const urlParams = new URLSearchParams(window.location.search);
                  const inviteUid = urlParams.get('invite');
                  if (inviteUid) {
                      // Remove param from URL to prevent loop/re-trigger
                      window.history.replaceState({}, document.title, "/");
                      await this.handleInvite(inviteUid);
                  }
                  
                  // Request Notification Permission (if supported)
                  if ('Notification' in window) {
                      this.requestNotificationPermission();
                  }

                  // Auto-show Help Modal once
                  if (!localStorage.getItem('helpShown')) {
                      const helpModal = document.createElement('help-modal');
                      document.body.appendChild(helpModal);
                      localStorage.setItem('helpShown', 'true');
                  }

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
      const today = new Date().toISOString().split('T')[0];
      this.setState({ viewingUser: friendData, selectedDate: today });
      this.loadTasks(); 
      this.loadGoals();
      alert(`Visiting ${friendData.nickname}'s calendar!`);
  }

  goHome() {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      this.setState({ viewingUser: null, selectedDate: todayStr, currentDate: today });
      this.loadTasks(); 
      this.loadGoals();
  }

  // --- Firestore Actions ---

  async requestNotificationPermission() {
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              console.log('Notification permission granted.');
          } else {
              console.log('Unable to get permission to notify.');
          }
      } catch (e) {
          console.error('Error requesting notification permission:', e);
      }
  }

  async migrateLegacyTasks() {
      // Find tasks without 'visibility' field
      // Note: Firestore doesn't support querying for missing fields easily in all modes.
      // But we can query all my tasks and check client-side, since I am the owner (allowed by rules).
      
      const q = query(collection(db, "tasks"), where("userId", "==", this.state.user.uid));
      const snapshot = await getDocs(q);
      
      let batchCount = 0;
      const updates = [];

      snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.visibility) {
              updates.push(updateDoc(doc.ref, { 
                  visibility: 'public', 
                  isPrivate: false 
              }));
              batchCount++;
          }
      });

      if (batchCount > 0) {
          await Promise.all(updates);
          console.log(`Migrated ${batchCount} legacy tasks to public.`);
      }
  }

  async handleInvite(targetUid) {
      if (targetUid === this.state.user.uid) {
          alert("자기 자신과는 블룸을 맺을 수 없습니다.");
          return;
      }
      
      // Check if already bloomed
      if (this.state.user.blooms && this.state.user.blooms.includes(targetUid)) {
          alert("이미 블룸된 친구입니다!");
          return;
      }

      const targetDoc = await getDoc(doc(db, "users", targetUid));
      if (!targetDoc.exists()) {
          alert("유효하지 않은 초대 링크입니다.");
          return;
      }
      
      const targetUser = targetDoc.data();
      
      if (confirm(`${targetUser.nickname}님과 서로 블룸(친구)을 맺으시겠습니까?`)) {
          await this.acceptMutualBloom(targetUid, targetUser.nickname);
      }
  }

  async acceptMutualBloom(targetUid, targetName) {
      try {
          // 1. Add target to my list
          await updateDoc(doc(db, "users", this.state.user.uid), {
              blooms: arrayUnion(targetUid)
          });

          // 2. Add me to target's list (Mutual)
          await updateDoc(doc(db, "users", targetUid), {
              blooms: arrayUnion(this.state.user.uid)
          });

          // 3. Send Notifications
          await this.sendNotification(targetUid, 'bloom', `${this.state.user.nickname}님이 초대 링크를 통해 서로 블룸을 맺었습니다! 🌸`);
          
          // Refresh my data
          const userRef = doc(db, "users", this.state.user.uid);
          const userSnap = await getDoc(userRef);
          this.setState({ user: { ...this.state.user, ...userSnap.data() } });
          this.loadBlooms();
          
          alert(`${targetName}님과 서로 블룸이 되었습니다!`);
      } catch (e) {
          console.error(e);
          alert("오류가 발생했습니다: " + e.message);
      }
  }

  async loadTasks() {
      if (this.unsubTasks) {
          this.unsubTasks();
          this.unsubTasks = null;
      }
      if (this.unsubTasks2) {
          this.unsubTasks2();
          this.unsubTasks2 = null;
      }

      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : (this.state.user ? this.state.user.uid : null);
      if(!targetUid) return;

      const processSnapshot = (tasksMap, snapshot) => {
          snapshot.forEach(doc => {
              const data = doc.data();
              if(!tasksMap[data.date]) tasksMap[data.date] = [];
              // Prevent duplicates if queries overlap
              if (!tasksMap[data.date].find(t => t.id === doc.id)) {
                  tasksMap[data.date].push({ id: doc.id, ...data });
              }
          });
      };

      const updateState = (allTasks) => {
          // Sort tasks
          for(const date in allTasks) {
              allTasks[date].sort((a, b) => (a.order || 0) - (b.order || 0));
          }
          this.setState({ tasks: allTasks });
      };

      if (!this.state.viewingUser) {
          // I am owner: Load MY tasks + Tasks I am TAGGED in
          
          let myTasks = {};
          let taggedTasks = {};

          const mergeAndUpdate = () => {
              const merged = JSON.parse(JSON.stringify(myTasks)); 
              for (const date in taggedTasks) {
                  if (!merged[date]) merged[date] = [];
                  
                  // Set of sharedIds already in the merged list (my tasks)
                  const existingSharedIds = new Set(
                      merged[date]
                          .filter(t => t.sharedId)
                          .map(t => t.sharedId)
                  );

                  taggedTasks[date].forEach(t => {
                      // 1. Skip exact duplicates (by ID) - already handled but safety check
                      if (merged[date].find(mt => mt.id === t.id)) return;

                      // 2. Skip duplicate shared tasks (if I already have a copy with same sharedId)
                      if (t.sharedId && existingSharedIds.has(t.sharedId)) return;

                      // Add task if unique
                      merged[date].push(t);
                      if (t.sharedId) existingSharedIds.add(t.sharedId);
                  });
              }
              updateState(merged);
          };

          // 1. My Own Tasks
          const qMy = query(collection(db, "tasks"), where("userId", "==", targetUid));
          this.unsubTasks = onSnapshot(qMy, (snapshot) => {
              myTasks = {};
              processSnapshot(myTasks, snapshot);
              mergeAndUpdate();
          });

          // 2. Tasks where I am TAGGED (created by others)
          const qTagged = query(collection(db, "tasks"), where("taggedUsers", "array-contains", targetUid));
          this.unsubTasks2 = onSnapshot(qTagged, (snapshot) => {
              taggedTasks = {};
              processSnapshot(taggedTasks, snapshot);
              mergeAndUpdate();
          });

      } else {
          // Visitor: Load all tasks for target user (Client filters privacy)
          const q = query(collection(db, "tasks"), where("userId", "==", targetUid));
          this.unsubTasks = onSnapshot(q, (snapshot) => {
              const tasks = {};
              processSnapshot(tasks, snapshot);
              updateState(tasks);
          }, (error) => {
              console.error("Error loading tasks:", error);
          });
      }
  }

  async loadNotifications() {
      if(!this.state.user) return;
      // Fetch ALL notifications for the user (read or unread)
      const q = query(collection(db, "notifications"), where("toUserId", "==", this.state.user.uid));
      
      let isFirstLoad = true;

      onSnapshot(q, (snapshot) => {
          const now = new Date();
          const limitDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days retention
          
          let notifications = [];
          snapshot.forEach(doc => {
              const data = doc.data();
              const createdAt = data.createdAt ? new Date(data.createdAt) : new Date(); 
              
              if (createdAt > limitDate) {
                  notifications.push({ id: doc.id, ...data });
              }
          });
          
          notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          // Trigger system notification ONLY for new UNREAD items (skip initial load)
          if (!isFirstLoad) {
              // Simple check: if top item is unread and newer than what we had? 
              // Actually, just checking if we have more unread items than before is complex with read status updates.
              // Let's just notify if the newest item is UNREAD and likely new (created just now).
              const newest = notifications[0];
              if (newest && !newest.read) {
                  // Check if this specific ID was already known? simplified for now.
                  if (Notification.permission === 'granted') { 
                      const noti = new Notification('Daily Bloom', {
                          body: newest.message,
                          icon: '/assets/logo.svg'
                      });
                      noti.onclick = () => {
                          window.focus();
                          if (newest.date) this.selectDate(newest.date);
                          noti.close();
                      };
                  }
              }
          }
          isFirstLoad = false;
          
          this.setState({ notifications });
      });
  }

  async deleteNotification(id) {
      await deleteDoc(doc(db, "notifications", id));
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
      
      // Since we don't have Cloud Functions for real push yet, 
      // we can try to trigger a local notification if we are testing on the same device (e.g. self-test)
      // or rely on the receiver's app to pick up the change via onSnapshot (which we already do for in-app badge).
  }

  async loadGoals() {
      if (this.unsubGoals) {
          this.unsubGoals();
          this.unsubGoals = null;
      }

      const targetUid = this.state.viewingUser ? this.state.viewingUser.uid : (this.state.user ? this.state.user.uid : null);
      if(!targetUid) return;

      const q = query(collection(db, "goals"), where("userId", "==", targetUid));
      this.unsubGoals = onSnapshot(q, (snapshot) => {
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

  async addTask(dateStr, text, isPrivate = false) {
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

    // Parse multiple tags: @name1 @name2
    const tagRegex = /@(\S+)/g;
    const matches = [...cleanText.matchAll(tagRegex)];
    
    // 1. Identify Friends to Tag
    const friendsToTag = []; // List of Friend Objects
    const friendsNames = []; // List of Names for display
    const taggedUserUids = []; // List of UIDs for 'taggedUsers' field (includes friends)

    if (matches.length > 0) {
        const uniqueNames = new Set(matches.map(m => m[1])); // Deduplicate tag names
        for (const tagName of uniqueNames) {
            const friend = this.state.blooms.find(b => b.nickname === tagName);
            if (friend) {
                if (friend.blooms && friend.blooms.includes(this.state.user.uid)) {
                    friendsToTag.push(friend);
                    friendsNames.push(tagName);
                    taggedUserUids.push(friend.uid);
                } else {
                    alert(`@${tagName}님과 태그 불가: 서로 블룸(친구) 상태여야 태그할 수 있습니다!`);
                }
            }
        }
        // Remove tags from text for clean display
        cleanText = cleanText.replace(tagRegex, '').trim();
    }
    
    // 2. Prepare 'taggedUsers' field (Access Control List)
    // Must include ME + ALL Friends
    const allParticipants = [this.state.user.uid, ...taggedUserUids];
    
    // 3. Prepare Common Data
    const groupId = 'group-' + Date.now();
    const sharedId = friendsToTag.length > 0 ? 'share-' + Date.now() : null;
    const baseDate = new Date(dateStr);
    const order = Date.now(); 

    const tasksToAdd = [];
    
    // Logic for #d (Consecutive days) AND #w (Weekly repeat)
    // Default to 1 if not specified
    // Nested loop: Weeks -> Duration
    
    for (let w = 0; w < weeks; w++) {
        // Calculate start date of this week's occurrence
        const weekStartDate = new Date(baseDate);
        weekStartDate.setDate(weekStartDate.getDate() + (w * 7));

        for (let d = 0; d < duration; d++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(currentDate.getDate() + d);
            const dStr = currentDate.toISOString().split('T')[0];
            
            // Should each week be a new group? Or one big group?
            // Usually #w creates separate recurring instances. 
            // #d creates a visually connected bar.
            // If I say #d3 #w2, I expect:
            // Week 1: 3-day bar
            // Week 2: 3-day bar
            // These should probably be DIFFERENT groupIds for the 'bar' effect to be distinct per week?
            // Or same groupId? If same, clicking one completes ALL weeks? Maybe that's desired?
            // Usually recurring events are independent instances.
            // BUT current groupId logic ties them for completion. 
            // If I complete Week 1's trip, Week 2's trip shouldn't auto-complete?
            // Let's create a UNIQUE groupId per WEEK iteration to separate the bars logic.
            // BUT wait, 'addTask' loop uses 'groupId' const.
            // I should generate groupId inside the loop if weeks > 1.
            
            // Let's modify the structure of tasksToAdd to include specific groupId per set.
            tasksToAdd.push({ 
                date: dStr, 
                text: cleanText, 
                duration, 
                dayIndex: d,
                weekIndex: w // For grouping
            });
        }
    }

    // Normal single day (covered by loop w=0, d=0) if defaults are 1.
    // ...

    // 4. Create Tasks in Database
    for (const taskData of tasksToAdd) {
        // Generate unique groupId for each weekly occurrence if weeks > 1
        // If weeks=1, duration=1, it's just one group.
        // We can append weekIndex to groupId to make it unique per week.
        const specificGroupId = `${groupId}-w${taskData.weekIndex}`;

        // Base task object for everyone
        const baseTask = {
            date: taskData.date,
            completed: false,
            createdAt: new Date().toISOString(),
            groupId: specificGroupId, // Use per-week unique group
            sharedId,
            order,
            duration: taskData.duration || 1,
            dayIndex: taskData.dayIndex ?? -1,
            isPrivate: false, 
            visibility: 'public', 
            taggedUsers: allParticipants.length > 1 ? allParticipants : null
        };

        try {
            // A. Create MY task (Once per date)
            let myVisibility = isPrivate ? 'private' : (allParticipants.length > 1 ? 'protected' : 'public');
            let myText = taskData.text;
            if (friendsNames.length > 0) {
                myText += ` (with ${friendsNames.join(', ')})`;
            }
            
            await addDoc(collection(db, "tasks"), { 
                ...baseTask, 
                userId: this.state.user.uid,
                text: myText,
                isPrivate: isPrivate,
                visibility: myVisibility
            });
            
            // B. Create FRIEND tasks (Loop through friends)
            for (const friend of friendsToTag) {
                // Text for friend: "Task (with Me, OtherFriend)"
                // Exclude current friend's name from list
                const othersNames = [this.state.user.nickname, ...friendsNames.filter(n => n !== friend.nickname)];
                const friendText = `${taskData.text} (with ${othersNames.join(', ')})`;

                await addDoc(collection(db, "tasks"), {
                    ...baseTask,
                    userId: friend.uid,
                    text: friendText,
                    isPrivate: false, 
                    visibility: 'protected' // Shared copies are always protected/visible to participants
                });
                
                // Notification (only on first day of the sequence to avoid spam)
                if (taskData.date === dateStr) {
                    await this.sendNotification(friend.uid, 'tag', `${this.state.user.nickname}님이 일정에 태그했습니다: ${taskData.text}`, null, dateStr);
                }
            }
        } catch (e) {
            console.error("Failed to add task:", e);
        }
    }

    if (friendsNames.length > 0) alert(`${friendsNames.join(', ')}님과 일정을 공유했습니다!`);
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
    if(this.state.viewingUser && !this.state.user) return; 
    
    // We must find the task to check permissions
    // Note: this.state.tasks might be the Friend's tasks if viewingUser is set.
    const task = this.state.tasks[dateStr]?.find(t => t.id === taskId);
    
    if(task) {
        const isOwner = task.userId === this.state.user.uid;
        const isTagged = task.taggedUsers && task.taggedUsers.includes(this.state.user.uid);

        if (!isOwner && !isTagged) {
            alert("수정 권한이 없습니다.");
            return;
        }
        
        const newStatus = !task.completed;

        // Toggle ONLY the specific task (day), removing group sync logic
        await updateDoc(doc(db, "tasks", taskId), { completed: newStatus });
    }
  }

  async updateTask(taskId, newText, isPrivate) {
      // Check permissions: Owner OR Tagged
      // Note: We need to fetch the task to check 'taggedUsers' if viewingUser is true.
      // But here we fetch it anyway.
      
      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      if(!taskSnap.exists()) return;
      
      const taskData = taskSnap.data();
      
      // Permission Check
      const isOwner = taskData.userId === this.state.user.uid;
      const isTagged = taskData.taggedUsers && taskData.taggedUsers.includes(this.state.user.uid);
      
      if (!isOwner && !isTagged) {
          alert("수정 권한이 없습니다.");
          return;
      }
      
      // Prepare updates
      const updates = {};
      if (newText && newText !== taskData.text) {
          // If shared, we only update the base text part? 
          // Complex issue: Friends have "Task (with Me)". I have "Task (with Friend)".
          // For simplicity, we update the FULL text for now, or we'd need to store baseText separately.
          // Let's just update the text. If they want to keep "(with ...)" they should edit carefully,
          // OR we accept that editing overwrites the "with..." part for everyone to the new text.
          // Decision: Update text directly. It syncs the content.
          updates.text = newText;
      }
      if (typeof isPrivate !== 'undefined') {
          updates.isPrivate = isPrivate;
          // Sync visibility
          if (isPrivate) updates.visibility = 'private';
          else if (taskData.taggedUsers && taskData.taggedUsers.length > 0) updates.visibility = 'protected';
          else updates.visibility = 'public';
      }
      
      if (Object.keys(updates).length === 0) return;

      // 1. Shared Tasks Sync (Highest Priority)
      if (taskData.sharedId) {
          const q = query(collection(db, "tasks"), where("sharedId", "==", taskData.sharedId));
          const querySnapshot = await getDocs(q);
          
          // Get all participants' nicknames mapping (uid -> nickname)
          // We might need to fetch user profiles if not locally available, but usually they are in 'blooms'.
          // However, for safety, let's use the 'taggedUsers' list if available to reconstruct names.
          // Or simpler: Extract 'with ...' from the current task being edited? No, that might be partial.
          // Best approach: Use the 'taggedUsers' array from the task data to find names from 'this.state.blooms' + 'myself'.
          
          const participantUids = taskData.taggedUsers || [];
          const participantMap = {};
          
          // Fill map with known names
          if (this.state.user) participantMap[this.state.user.uid] = this.state.user.nickname;
          this.state.blooms.forEach(b => participantMap[b.uid] = b.nickname);
          
          // Extract core text from the input (remove existing ' (with ...)')
          const coreText = newText.replace(/\s*\(with\s+.*\)$/, '').trim();

          querySnapshot.forEach(async (d) => {
              const docData = d.data();
              const ownerUid = docData.userId;
              
              const localUpdates = { ...updates };
              
              // Reconstruct text with correct suffix for THIS owner
              if (updates.text) {
                  const othersNames = participantUids
                      .filter(uid => uid !== ownerUid)
                      .map(uid => participantMap[uid] || 'Unknown') // Fallback if name not found locally
                      .filter(name => name !== 'Unknown'); // Clean up
                  
                  if (othersNames.length > 0) {
                      localUpdates.text = `${coreText} (with ${othersNames.join(', ')})`;
                  } else {
                      localUpdates.text = coreText;
                  }
              }

              await updateDoc(doc(db, "tasks", d.id), localUpdates);
          });
          return; // Done
      }

      // 2. Multi-day Sync (only if not shared, or sharedId would have covered it if we used same ID)
      // Note: My logic uses sharedId separate from groupId. 
      // If a task is BOTH multi-day AND shared, we need to handle both dimensions.
      // Current structure: Each day has unique ID. They share groupId. They share sharedId?
      // Yes, if I add #d3 @friend, all 6 tasks (3 for me, 3 for friend) should ideally share a linkage.
      // My addTask logic assigns same groupId and same sharedId to ALL of them.
      // So querying by sharedId is enough to catch ALL days for ALL users.
      
      if (taskData.groupId) {
          const q = query(collection(db, "tasks"), where("groupId", "==", taskData.groupId));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(async (d) => {
              await updateDoc(doc(db, "tasks", d.id), updates);
          });
      } else {
          await updateDoc(taskRef, updates);
      }
  }

  async deleteTask(dateStr, taskId) {
      // Check ownership or tagged permission
      let task = this.state.tasks[dateStr]?.find(t => t.id === taskId);
      if (!task) {
           // Fallback fetch if not in state
           const snap = await getDoc(doc(db, "tasks", taskId));
           if(snap.exists()) task = { id: snap.id, ...snap.data() };
      }

      if (!task) return;

      const isOwner = task.userId === this.state.user.uid;
      const isTagged = task.taggedUsers && task.taggedUsers.includes(this.state.user.uid);

      if (!isOwner && !isTagged) {
          alert("삭제 권한이 없습니다.");
          return;
      }

      if(!confirm("이 일정을 삭제할까요? (연결된 일정이 있다면 모두 삭제됩니다)")) return;

      // 1. Shared Tasks Deletion
      if (task.sharedId) {
          const q = query(collection(db, "tasks"), where("sharedId", "==", task.sharedId));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(async (d) => {
              await deleteDoc(doc(db, "tasks", d.id));
          });
          return;
      }

      // 2. Multi-day Deletion
      if (task.groupId) {
          const q = query(collection(db, "tasks"), where("groupId", "==", task.groupId));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach(async (d) => {
              await deleteDoc(doc(db, "tasks", d.id));
          });
      } else {
          await deleteDoc(doc(db, "tasks", taskId));
      }
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
        if (goal.userId !== this.state.user.uid) {
            alert("You can only modify your own goals!");
            return;
        }
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
    });
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
      
      // Find the goal to check ownership
      let goal = null;
      for (const m in this.state.goals) {
          const found = this.state.goals[m].find(g => g.id === goalId);
          if (found) { goal = found; break; }
      }
      
      if (goal && goal.userId !== this.state.user.uid) {
          alert("You can only delete your own goals!");
          return;
      }

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

class HelpModal extends BaseComponent {
    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                @import url('/style.css');
                .modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.5); z-index: 2000;
                    display: flex; justify-content: center; align-items: center;
                }
                .modal-content {
                    background: var(--surface-color); padding: 25px; border-radius: 16px;
                    width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2); position: relative;
                }
                .close-btn {
                    position: absolute; top: 15px; right: 15px; font-size: 1.5rem;
                    background: none; border: none; cursor: pointer; color: var(--text-color);
                }
                h2 { color: var(--primary-color); text-align: center; margin-bottom: 20px; font-family: 'Dancing Script', cursive; }
                .guide-item { margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px; }
                .guide-item:last-child { border-bottom: none; }
                .guide-title { font-weight: bold; font-size: 1.1rem; margin-bottom: 5px; color: var(--primary-hover); }
                .guide-desc { font-size: 0.95rem; line-height: 1.5; color: var(--text-color); }
                code { background: var(--bg-color); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; }
            </style>
            <div class="modal-overlay" id="overlay">
                <div class="modal-content">
                    <button class="close-btn" id="close">&times;</button>
                    <h2>Daily Bloom Guide</h2>
                    
                    <div class="guide-item">
                        <div class="guide-title"><img src="/assets/logo.svg" style="width:18px; vertical-align:middle; margin-right:5px;"> 친구야, 내가 써줄게! (@태그)</div>
                        <div class="guide-desc">
                            일정 입력 시 <code>@친구닉네임</code>을 입력하면 일정이 자동으로 공유됩니다.<br>
                            <em>(단, 서로 블룸(친구) 맺은 사이여야만 태그가 가능합니다!)</em><br>
                            <em>예: "점심 약속 @지민 @철수" → 지민, 철수의 캘린더에도 자동 등록!</em>
                        </div>
                    </div>

                    <div class="guide-item">
                        <div class="guide-title"><img src="/assets/logo.svg" style="width:18px; vertical-align:middle; margin-right:5px;"> 2박 3일 여행도 한 번에! (#d기간)</div>
                        <div class="guide-desc">
                            일정 뒤에 <code>#d3</code>을 붙이면 3일짜리 연결된 일정이 생성됩니다.<br>
                            <em>예: "제주도 여행 #d3" → 오늘부터 3일간 바(Bar) 생성</em>
                        </div>
                    </div>

                    <div class="guide-item">
                        <div class="guide-title"><img src="/assets/logo.svg" style="width:18px; vertical-align:middle; margin-right:5px;"> 매주 돌아오는 업무! (#w반복)</div>
                        <div class="guide-desc">
                            일정 뒤에 <code>#w4</code>를 붙이면 4주 동안 매주 같은 요일에 반복됩니다.<br>
                            <em>예: "주간 회의 #w10" → 10주 동안 반복 등록</em>
                        </div>
                    </div>

                    <div class="guide-item">
                        <div class="guide-title"><img src="/assets/logo.svg" style="width:18px; vertical-align:middle; margin-right:5px;"> 1초 만에 친구 맺기</div>
                        <div class="guide-desc">
                            [마이페이지]에서 <strong>초대 링크</strong>를 복사해 친구에게 보내세요.<br>
                            친구가 링크를 누르면 복잡한 과정 없이 바로 <strong>맞블룸(친구)</strong>이 됩니다.
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px; font-size: 0.9rem; color: #888; display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <span>다시 보고 싶으면 우측 상단의</span>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFC1CC" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                                <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"/>
                            </svg>
                            <strong>하트 버튼</strong>을 눌러주세요!
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.shadowRoot.getElementById('close').addEventListener('click', () => this.remove());
        this.shadowRoot.getElementById('overlay').addEventListener('click', (e) => {
            if (e.target === this.shadowRoot.getElementById('overlay')) this.remove();
        });
    }
}
customElements.define('help-modal', HelpModal);

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
             <img src="/assets/logo.svg" alt="Daily Bloom Logo" style="width:120px; margin-bottom:10px;">
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
            
            /* Responsive Input Groups */
            .input-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
            .input-row input { flex: 1; min-width: 0; } /* min-width 0 allows flex item to shrink below content size */
            .input-row button { flex-shrink: 0; }
            
            @media (max-width: 400px) {
                .input-row { flex-direction: column; gap: 8px; }
                .input-row button { width: 100%; }
            }
            </style>
            <div class="my-page-container">
                <div class="profile-section">
                    <div style="position: relative; cursor: pointer; width: 80px; height: 80px;" id="avatar-container">
                        <img src="${user.photoURL}" alt="${user.nickname}'s profile" style="width:100%; height:100%; border-radius:50%; object-fit: cover; border: 2px solid var(--primary-color);">
                        <div style="position: absolute; bottom: 0; right: 0; background: var(--primary-color); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 5px; box-sizing: border-box;">
                            <img src="/assets/camera.svg" alt="Upload photo" style="width:100%; height:100%;">
                        </div>
                        <input type="file" id="photo-upload" style="display: none;" accept="image/*">
                    </div>
                    <div style="flex-grow: 1; margin-left: 15px;">
                        <h3 style="margin-bottom: 5px;">${user.nickname}</h3>
                        <p style="color: var(--accent-color); font-size: 0.9rem;">${user.email}</p>
                    </div>
                </div>
                
                <div class="input-row">
                    <input type="text" id="nick-input" placeholder="${t.setNickname}" value="${user.nickname}">
                    <button class="btn-primary" id="save-nick">Save</button>
                </div>

                <div style="border-top: 1px solid var(--border-color); margin: 20px 0;"></div>

                <h3>${t.addFriend}</h3>
                
                ${store.state.deferredPrompt ? `
                    <div style="margin-bottom: 15px;">
                        <button class="btn-primary" id="install-app-btn" style="width:100%; background: #333; color: white;">${t.installApp}</button>
                    </div>
                ` : ''}

                <div style="margin-bottom: 15px; text-align: center;">
                    <button class="btn-primary" id="enable-noti-btn" style="width:100%; background: #fff; color: #333; border: 1px solid var(--border-color); padding: 12px; margin-bottom: 10px;">
                        ${Notification.permission === 'granted' ? '🔕 알림 끄는 방법' : '🔔 푸시 알림 받기'}
                    </button>
                    <button class="btn-primary" id="copy-invite-btn" style="width:100%; background: linear-gradient(45deg, #ffc1cc, #ffb7c5); border:none; padding: 12px;">${t.copyInvite}</button>
                    <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 5px;">${t.inviteDesc}</div>
                </div>
                <div class="friend-search input-row" style="margin-bottom: 15px;">
                    <input type="email" id="friend-email" placeholder="${t.searchFriend}">
                    <button class="btn-primary" id="add-friend-btn">+</button>
                </div>

                <h3>${t.friendList} (${blooms.length})</h3>
                <div class="friend-list" style="margin-bottom: 20px;">
                    ${blooms.length === 0 ? '<p style="grid-column: 1/-1; text-align: center; opacity: 0.6;">No blooms yet. Add a friend!</p>' : ''}
                    ${blooms.map(f => {
                        const isMutual = f.blooms && f.blooms.includes(user.uid);
                        return `
                        <div class="friend-card ${isMutual ? 'mutual' : ''}" data-uid="${f.uid}">
                            <img src="${f.photoURL || '/assets/logo.svg'}" alt="${f.nickname}'s profile" style="width:40px; height:40px; border-radius:50%; margin-bottom:5px;">
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
        
        const installBtn = this.shadowRoot.getElementById('install-app-btn');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                store.installApp();
            });
        }

        this.shadowRoot.getElementById('enable-noti-btn').addEventListener('click', async () => {
            if (!('Notification' in window)) {
                alert("이 브라우저는 알림을 지원하지 않습니다.");
                return;
            }
            
            if (Notification.permission === 'granted') {
                alert(
                    "🔕 알림을 끄는 방법:\n\n" +
                    "1. PC: 주소창 옆 자물쇠(🔒) 클릭 -> 알림 끄기\n" +
                    "2. 갤럭시: 앱 아이콘 꾹 누르기 -> ⓘ 정보 -> 알림 -> 허용 안함\n" +
                    "3. 아이폰: 설정 -> Daily Bloom -> 알림 -> 알림 허용 끄기"
                );
            } else {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    alert("알림이 설정되었습니다! 이제 친구들의 소식을 바로 받아보세요.");
                    new Notification('Daily Bloom', { body: '알림 설정이 완료되었습니다! 🌸', icon: '/assets/logo.svg' });
                    // Refresh UI to update button text
                    this.render();
                } else if (permission === 'denied') {
                    alert("알림이 차단되어 있습니다. 브라우저 설정(주소창 옆 자물쇠)에서 알림 권한을 허용해주세요.");
                }
            }
        });

        this.shadowRoot.getElementById('copy-invite-btn').addEventListener('click', () => {
            const link = `${window.location.origin}?invite=${user.uid}`;
            navigator.clipboard.writeText(link).then(() => {
                alert("초대 링크가 복사되었습니다! 친구에게 붙여넣기(Ctrl+V)해서 보내주세요.");
            }).catch(err => {
                console.error('Could not copy text: ', err);
                prompt("이 링크를 복사해서 친구에게 보내주세요:", link);
            });
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
        
        .sub-item { padding-left: 30px; border-bottom: 1px solid var(--border-color); background: var(--bg-color); }
        .sub-item:hover { background: var(--surface-color); border-left: 3px solid var(--primary-color); }
        .group-header { background: var(--surface-color); display: flex; justify-content: space-between; align-items: center; }

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
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        @media (max-width: 600px) {
            header { flex-wrap: wrap; gap: 5px; }
            .logo-text { display: none; } /* Ensure logo text is hidden on small screens */
            .viewing-indicator { 
                order: 3; 
                width: 100%; 
                margin-top: 5px; 
                background: rgba(255, 193, 204, 0.1); 
                padding: 4px; 
                border-radius: 8px;
            }
            .search-container { width: 100%; top: 50px; }
        }

        .controls { 
            display: flex; 
            gap: 8px; 
            align-items: center; 
            height: 40px; 
            flex-shrink: 0;
            margin-left: auto; /* Push to right */
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
        .noti-item { padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; font-size: 0.85rem; display: flex; align-items: flex-start; justify-content: space-between; }
        .noti-item:hover { background: var(--bg-color); }
        .noti-item.read { opacity: 0.5; background: #fafafa; }
        [data-theme="dark"] .noti-item.read { background: #2a2a2a; }
        
        .noti-delete-btn {
            background: none; border: none; font-size: 1.2rem; color: #999; cursor: pointer; padding: 0 5px; margin-left: 10px;
        }
        .noti-delete-btn:hover { color: #ff5252; }
      </style>
      <header>
        <div class="brand" id="logo">
            <img src="/assets/logo.svg" alt="Logo" class="logo-icon">
            <span class="logo-text">Daily Bloom</span>
        </div>
        
        ${store.state.viewingUser ? `
            <div class="viewing-indicator">
                <img src="${store.state.viewingUser.photoURL || '/assets/logo.svg'}" alt="${store.state.viewingUser.nickname}'s profile" style="width:28px; height:28px; border-radius:50%; border: 2px solid var(--primary-color); object-fit: cover;">
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
                    <img src="/assets/search.svg" alt="Search" style="width:100%; height:100%; filter: var(--icon-filter);">
                </button>
            ` : ''}
            
            <button class="btn-icon" id="theme-btn">
                <img src="/assets/moon.svg" alt="Toggle Theme" style="width:100%; height:100%; filter: var(--icon-filter);">
            </button>

            ${store.state.user ? `
                <div class="notification-wrapper">
                    <button class="btn-icon" id="noti-btn">
                        <img src="/assets/bell.svg" alt="Notifications" style="width:100%; height:100%; filter: var(--icon-filter);">
                        ${store.state.notifications.filter(n => !n.read).length > 0 ? `<div class="noti-badge">${store.state.notifications.filter(n => !n.read).length}</div>` : ''}
                    </button>
                    <div class="noti-dropdown" id="noti-dropdown">
                        ${store.state.notifications.length === 0 ? '<div style="padding:20px; text-align:center; opacity:0.6;">No notifications</div>' : ''}
                        ${store.state.notifications.map(n => `
                            <div class="noti-item ${n.read ? 'read' : ''}" data-id="${n.id}">
                                <div style="flex-grow:1;">
                                    <strong>${n.type === 'bloom' ? '🌸 Bloom' : n.type === 'tag' ? '📌 Tag' : '💬 Bloom'}</strong><br>
                                    ${n.message}
                                    ${n.date ? `<div style="font-size:0.7rem; color:var(--primary-color); margin-top:4px;">Date: ${n.date}</div>` : ''}
                                </div>
                                <button class="noti-delete-btn" data-id="${n.id}">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="profile-trigger" id="mypage-btn">
                    <img src="${user.photoURL || '/assets/logo.svg'}" alt="My Page" class="avatar-small">
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

    const closeSearch = (e) => {
        // Close if clicking outside search container and not on the toggle button
        if (searchContainer.classList.contains('active') && 
            !searchContainer.contains(e.target) && 
            (!searchToggleBtn || !searchToggleBtn.contains(e.target))) {
            searchContainer.classList.remove('active');
            searchResults.classList.remove('active');
            searchInput.value = '';
        }
    };

    if (searchToggleBtn) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = searchContainer.classList.contains('active');
            if (isActive) {
                searchContainer.classList.remove('active');
                searchResults.classList.remove('active');
                searchInput.value = '';
            } else {
                searchContainer.classList.add('active');
                searchInput.focus();
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            const rawResults = store.searchTasks(query);
            
            if (rawResults.length > 0) {
                // Grouping Logic
                const grouped = {};
                rawResults.forEach(task => {
                    // Use text as key for grouping identical tasks. 
                    // For multi-day tasks, they usually have same text.
                    const key = task.text; 
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(task);
                });

                // Convert to array and take top 8 groups or so to avoid overload
                const groups = Object.keys(grouped).map(key => ({
                    text: key,
                    items: grouped[key]
                })).slice(0, 8);

                searchResults.innerHTML = groups.map((g, idx) => {
                    const count = g.items.length;
                    const isSingle = count === 1;
                    
                    if (isSingle) {
                        const item = g.items[0];
                        return `
                            <div class="search-item" data-date="${item.date}">
                                <div class="search-item-text">${item.text}</div>
                                <div class="search-item-date">${item.date}</div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="search-group" data-idx="${idx}">
                                <div class="search-item group-header">
                                    <div class="search-item-text">${g.text} <span style="color:var(--primary-color); font-size:0.8rem;">(${count})</span></div>
                                    <div class="search-item-date">▾</div>
                                </div>
                                <div class="group-items hidden" id="group-${idx}">
                                    ${g.items.map(item => `
                                        <div class="search-item sub-item" data-date="${item.date}">
                                            <div class="search-item-date" style="width:100%">${item.date}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                }).join('');
                searchResults.classList.add('active');
                
                // Add click events
                // 1. Single items and Sub items -> Navigate
                searchResults.querySelectorAll('.search-item:not(.group-header)').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        store.selectDate(item.dataset.date);
                        searchResults.classList.remove('active');
                        searchContainer.classList.remove('active');
                        searchInput.value = '';
                    });
                });

                // 2. Group Headers -> Toggle Expand
                searchResults.querySelectorAll('.group-header').forEach(header => {
                    header.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const groupIdx = header.parentElement.dataset.idx;
                        const itemsDiv = searchResults.querySelector(`#group-${groupIdx}`);
                        itemsDiv.classList.toggle('hidden');
                        const arrow = header.querySelector('.search-item-date');
                        arrow.textContent = itemsDiv.classList.contains('hidden') ? '▾' : '▴';
                    });
                });

            } else {
                searchResults.classList.remove('active');
            }
        });
    }

    // Add global listener for search closing
    document.addEventListener('click', closeSearch);

    const homeBtn = this.shadowRoot.getElementById('home-btn');
    if(homeBtn) {
        homeBtn.addEventListener('click', () => {
            store.goHome();
        });
    }

    const notiBtn = this.shadowRoot.getElementById('noti-btn');
    const notiDropdown = this.shadowRoot.getElementById('noti-dropdown');
    
    const closeNoti = (e) => {
        if (notiDropdown && notiDropdown.classList.contains('active') && 
            !notiDropdown.contains(e.target) && 
            !notiBtn.contains(e.target)) {
            notiDropdown.classList.remove('active');
        }
    };

    // Add global listener for notification closing
    document.addEventListener('click', closeNoti);

    if(notiBtn) {
        notiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notiDropdown.classList.toggle('active');
        });
        
        this.shadowRoot.querySelectorAll('.noti-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Prevent click if delete button was clicked
                if (e.target.classList.contains('noti-delete-btn')) return;

                const id = item.dataset.id;
                const n = store.state.notifications.find(noti => noti.id === id);
                if(!n) return;

                store.markNotificationRead(id);
                // ... rest of navigation logic
                
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
                    // Close MyPage if open
                    document.querySelector('my-page').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.querySelector('goal-list').classList.remove('hidden');

                    if (store.state.viewingUser) store.goHome(); // Return to my calendar first
                    if (n.date) {
                        store.selectDate(n.date);
                    }
                    notiDropdown.classList.remove('active');
                }
            });
        });
    }

        this.shadowRoot.querySelectorAll('.noti-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if(confirm("알림을 삭제하시겠습니까?")) {
                    store.deleteNotification(id);
                }
            });
        });

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
        if (store.state.viewingUser) {
            store.goHome();
        }
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
                            ${viewingUser ? 
                                (g.completed ? '<span style="width: 13px; text-align: center; color: var(--primary-color); font-weight: bold;">✔</span>' : '<span style="width: 13px; text-align: center; color: var(--text-color); font-weight: bold;">•</span>') : 
                                `<input type="checkbox" ${g.completed ? 'checked' : ''} data-id="${g.id}">`
                            }
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
                
                .task-preview.multi-day { 
                    background: var(--bar-bg); 
                    color: var(--bar-color); 
                    border-radius: 0; 
                    /* Bridge own padding(8) + gap(8) + next padding(8) + 1px overlap = 25px */
                    width: calc(100% + 25px); 
                    margin-left: -8px; 
                    margin-right: -17px; 
                    padding-left: 8px;
                    font-weight: 600;
                    z-index: 2;
                    box-shadow: 4px 0 0 var(--bar-bg), -4px 0 0 var(--bar-bg);
                    opacity: 1 !important;
                }
                .task-preview.multi-day.completed { 
                    color: var(--accent-color); 
                    --bar-bg: var(--completed-bar-bg);
                } 
                .task-preview.multi-day.completed span { text-decoration: line-through; } 
                
                .task-preview.multi-day.start { 
                    border-top-left-radius: 11px; 
                    border-bottom-left-radius: 11px; 
                    margin-left: 0; 
                    width: calc(100% + 17px);
                    box-shadow: 4px 0 0 var(--bar-bg);
                    overflow: visible; /* Let text flow! */
                    text-overflow: clip;
                    z-index: 3;
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
                        
                        // Filter tasks for calendar view privacy
                        const rawTasks = tasks[dateStr] || [];
                        const dayTasks = rawTasks.filter(t => {
                            if (!store.state.viewingUser) return true; // My calendar: show all
                            // Friend calendar: Hide private & non-tagged
                            if (t.isPrivate) return false;
                            if (t.taggedUsers && !t.taggedUsers.includes(store.state.user.uid)) return false;
                            return true;
                        });

                        const dayOfWeek = new Date(year, month, d).getDay();
                        return `
                            <div class="day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}" style="z-index: ${50 - d};">
                                <div class="day-number">${d}</div>
                                ${dayTasks.slice(0, 3).map(t => {
                                    const isMulti = t.duration && t.duration > 1;
                                    let multiClass = '';
                                    let taskText = t.text;
                                    
                                    if (isMulti) {
                                        multiClass = 'multi-day';
                                        if (t.dayIndex === 0) multiClass += ' start';
                                        else if (t.dayIndex === t.duration - 1) multiClass += ' end';
                                        
                                        if (dayOfWeek === 6 && !multiClass.includes('end')) {
                                            multiClass += ' no-bleed';
                                        }

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
            
            // Persistent close listener
            const closeOverlay = (e) => {
                const overlay = this.shadowRoot.getElementById('jump-overlay');
                const titleDisplay = this.shadowRoot.getElementById('title-display');
                if (this.isJumping && overlay && !overlay.contains(e.target) && !titleDisplay.contains(e.target)) {
                    this.isJumping = false;
                    this.render();
                    document.removeEventListener('click', closeOverlay);
                }
            };
            // Delay adding listener to avoid immediate close from the opening click
            setTimeout(() => document.addEventListener('click', closeOverlay), 0);
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



                // Filter tasks for privacy



                const rawTasks = store.state.tasks[dateStr] || [];



                const tasks = rawTasks.filter(t => {



                    // If viewing my own, show everything



                    if (!viewingUser) return true;



                    



                    // If viewing friend:



                    // 1. Hide private tasks



                    if (t.isPrivate) return false;



                    



                    // 2. Hide tagged tasks if I am not in the list



                    if (t.taggedUsers && !t.taggedUsers.includes(store.state.user.uid)) {



                        return false;



                    }



                    



                    return true;



                });



        



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

                            

                            #help-trigger {

                                position: absolute;

                                top: 18px;

                                right: 20px;

                                background: none;

                                border: none;

                                font-size: 1.2rem;

                                cursor: pointer;

                                opacity: 0.7;

                                transition: transform 0.2s;

                                z-index: 11;

                            }

                            #help-trigger:hover { transform: scale(1.2); opacity: 1; }

            

                            .task-item, .comment-item { border-bottom: 1px solid var(--border-color); padding: 10px 0; }

                            .task-item.dragging { opacity: 0.5; background: var(--bg-color); border: 1px dashed var(--primary-color); }

                            

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

                                .mobile-close { display: block; top: 15px; right: 15px; line-height: 1; }

                                /* Offset help button when close button is visible */

                                #help-trigger { right: 55px; top: 15px; } /* Aligned top with close button */

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

                                .input-group { display: flex; gap: 8px; margin-top: 10px; position: relative; width: 100%; align-items: center; }
                                .input-group input { flex: 1; min-width: 0; }
                                .input-group button { flex-shrink: 0; white-space: nowrap; }

                        </style>

                        

                                                <div class="daily-panel">

                        

                                                    <span class="mobile-close" id="close-view">&times;</span>

                        

                                                    <button id="help-trigger" title="사용법 보기" style="background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center;">

                        

                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFC1CC" xmlns="http://www.w3.org/2000/svg">

                        

                                                            <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"/>

                        

                                                        </svg>

                        

                                                    </button>

                        

                                                    <h2 style="margin-bottom:10px;">${dateStr}</h2>

                        

                                                    <div class="section-title">${taskTitle}</div>

                                <div id="task-list">

                                    ${tasks.length === 0 ? `<p style="opacity:0.6; font-size:0.9rem; text-align: center; padding: 20px 0;">${store.t.noTasks}</p>` : ''}

                                    ${tasks.map((t, index) => {

                        const isMulti = t.duration && t.duration > 1;
                        
                        // Check permission: Owner OR Tagged
                        const canEdit = !viewingUser || (t.taggedUsers && t.taggedUsers.includes(store.state.user.uid));

                        return `

                                                <div class="task-item" draggable="${!viewingUser}" data-index="${index}" style="display:flex; flex-direction: column; gap: 5px; cursor:${viewingUser ? 'default' : 'grab'}; padding: 8px 0;">

                                                    <div style="display:flex; align-items:center; gap:12px; width: 100%;">

                                                                                                                                                                        <input type="checkbox" ${t.completed ? 'checked' : ''} data-id="${t.id}" ${viewingUser ? 'disabled' : ''}>

                                                                                                                                                                        <span style="flex-grow:1" class="task-text ${t.completed ? 'completed' : ''}">

                                                                                                                                                                            ${t.text}

                                                                                                                                                                            ${t.isPrivate ? '<img src="/assets/lock.svg" style="width:14px; height:14px; vertical-align:middle; margin-left:5px; opacity:0.6;">' : ''}

                                                                                                                                                                        </span>

                                                                                                                                                                    </div>

                            ${canEdit ? `

                                <div style="display:flex; gap:8px; margin-left: 28px;">

                                    <button class="edit-task-btn" data-id="${t.id}" data-text="${t.text}" style="background:none; border:none; color:var(--accent-color); font-size:0.7rem; cursor:pointer; padding:0;">Edit</button>

                                    <button class="delete-task-btn" data-id="${t.id}" style="background:none; border:none; color:#ff5252; font-size:0.7rem; cursor:pointer; padding:0;">Delete</button>

                                </div>

                            ` : ''}

                        </div>

                        `;

                    }).join('')}

                </div>

                                                ${!viewingUser ? `

                                                    <div class="input-group">

                                                        <input type="text" id="task-input" placeholder="${store.t.addTask}" style="flex-grow:1" autocomplete="off">

                                                        <button id="lock-btn" class="btn-icon" style="border:1px solid var(--border-color); border-radius:8px; width:36px; height:36px; margin-right:5px; opacity:0.5; padding: 6px;">

                                                            <img src="/assets/lock.svg" style="width:100%; height:100%;">

                                                        </button>

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

                            <img src="${c.authorPhoto || '/assets/logo.svg'}" alt="${c.author}'s profile" style="width:30px; height:30px; border-radius:50%; object-fit:cover; margin-top:3px; cursor:pointer;" class="commenter-avatar" data-uid="${c.fromUserId}">

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

        

        

        

                const helpBtn = this.shadowRoot.getElementById('help-trigger');

        

                if(helpBtn) {

        

                    helpBtn.addEventListener('click', () => {

        

                        const helpModal = document.createElement('help-modal');

        

                        document.body.appendChild(helpModal);

        

                    });

        

                }

        

        

        

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

        

        this.shadowRoot.querySelectorAll('.delete-task-btn').forEach(btn => btn.addEventListener('click', (e) => {

            if(confirm("이 일정을 삭제할까요?")) {

                store.deleteTask(dateStr, e.target.dataset.id);

            }

        }));



                this.shadowRoot.querySelectorAll('.edit-task-btn').forEach(btn => {



                    btn.addEventListener('click', () => {



                        const id = btn.dataset.id;



                        const taskItem = btn.closest('.task-item');



                        const textSpan = taskItem.querySelector('.task-text');



                        const originalText = btn.dataset.text; 



                        



                        // Find current privacy state. We can infer it from the icon existence or data attribute.



                        // Better to look up the task object from store state to be sure.



                        const currentTask = store.state.tasks[dateStr].find(t => t.id === id);



                        let isLocked = currentTask ? currentTask.isPrivate : false;



        



                        // Toggle inline edit mode



                        textSpan.innerHTML = `



                            <div style="display:flex; gap:5px; margin-top:5px; align-items:center;">



                                <input type="text" class="edit-task-input" value="${originalText}" style="flex-grow:1; font-size:0.9rem; padding:4px 8px;">



                                <button class="edit-lock-btn" style="border:1px solid ${isLocked ? 'var(--primary-color)' : 'var(--border-color)'}; border-radius:8px; width:30px; height:30px; opacity:${isLocked ? '1' : '0.5'}; padding:4px; background:${isLocked ? 'var(--surface-color)' : 'transparent'}; cursor:pointer;">



                                    <img src="/assets/lock.svg" style="width:100%; height:100%;">



                                </button>



                                <button class="save-task-btn btn-primary" style="font-size:0.7rem; padding:4px 8px;">Save</button>



                                <button class="cancel-task-btn" style="background:none; border:1px solid var(--border-color); border-radius:12px; font-size:0.7rem; padding:4px 8px; cursor:pointer; color:var(--text-color);">Cancel</button>



                            </div>



                        `;



        



                        const editInput = textSpan.querySelector('.edit-task-input');



                        const lockBtn = textSpan.querySelector('.edit-lock-btn');



                        editInput.focus();



                        



                        // Prevent drag when interacting with input



                        editInput.addEventListener('click', (e) => e.stopPropagation());



                        editInput.addEventListener('mousedown', (e) => e.stopPropagation());



                        



                        // Lock toggle logic



                        lockBtn.addEventListener('click', (e) => {



                            e.stopPropagation();



                            isLocked = !isLocked;



                            lockBtn.style.opacity = isLocked ? '1' : '0.5';



                            lockBtn.style.borderColor = isLocked ? 'var(--primary-color)' : 'var(--border-color)';



                            lockBtn.style.backgroundColor = isLocked ? 'var(--surface-color)' : 'transparent';



                        });



        



                        const save = () => {



                            const newText = editInput.value.trim();



                            // Save if text changed OR lock status changed



                            if ((newText && newText !== originalText) || isLocked !== currentTask.isPrivate) {



                                store.updateTask(id, newText, isLocked);



                            } else {



                                store.loadTasks(); // Just revert



                            }



                        };



                textSpan.querySelector('.save-task-btn').addEventListener('click', (e) => {

                    e.stopPropagation();

                    save();

                });



                                textSpan.querySelector('.cancel-task-btn').addEventListener('click', (e) => {



                                    e.stopPropagation();



                                    textSpan.textContent = originalText; 



                                    store.loadTasks(); // Refresh to be safe



                                });



                editInput.addEventListener('keypress', (e) => {

                    if (e.key === 'Enter') {

                        save();

                    }

                });

            });

        });



        // ... (rest of the suggestion logic etc) ...

        const taskInput = this.shadowRoot.getElementById('task-input');

        const suggestionsBox = this.shadowRoot.getElementById('suggestions');

        const addTaskBtn = this.shadowRoot.getElementById('add-task-btn');



                const handleAddTask = () => {



                    if (taskInput && taskInput.value.trim()) {



                        // Determine if locked (captured from closure scope or UI check)



                        const lockBtn = this.shadowRoot.getElementById('lock-btn');



                        const isLocked = lockBtn && lockBtn.style.opacity === '1';



                        



                        store.addTask(dateStr, taskInput.value.trim(), isLocked);



                        taskInput.value = '';



                        



                        // Reset lock



                        if (lockBtn) {



                            lockBtn.style.opacity = '0.5';



                            lockBtn.style.borderColor = 'var(--border-color)';



                        }



                        



                        if(suggestionsBox) suggestionsBox.classList.remove('active');



                    }



                };



                if(taskInput) {



                    const lockBtn = this.shadowRoot.getElementById('lock-btn');



                    let isLocked = false;



        



                    if (lockBtn) {



                        lockBtn.addEventListener('click', () => {



                            isLocked = !isLocked;



                            lockBtn.style.opacity = isLocked ? '1' : '0.5';



                            lockBtn.style.borderColor = isLocked ? 'var(--primary-color)' : 'var(--border-color)';



                            lockBtn.style.backgroundColor = isLocked ? 'var(--surface-color)' : 'transparent';



                        });



                    }



        



                    taskInput.addEventListener('keypress', (e) => { if(e.key==='Enter') handleAddTask(); });



                    taskInput.addEventListener('input', (e) => {

                const val = e.target.value;

                const lastAt = val.lastIndexOf('@');

                if (lastAt !== -1) {

                    const query = val.substring(lastAt + 1).toLowerCase();

                    const mutuals = store.state.blooms.filter(f => f.blooms && f.blooms.includes(store.state.user.uid));

                    const matches = mutuals.filter(f => f.nickname.toLowerCase().startsWith(query));

                    if (matches.length > 0) {

                        suggestionsBox.innerHTML = matches.map(f => `<div class="suggestion-item" data-nick="${f.nickname}"><img src="${f.photoURL || '/assets/logo.svg'}" alt="${f.nickname}'s profile">${f.nickname}</div>`).join('');

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



        if(addTaskBtn) {

            addTaskBtn.addEventListener('click', handleAddTask);

        }



        // Drag and Drop Logic

        const taskList = this.shadowRoot.getElementById('task-list');

        if (taskList && !store.state.viewingUser) {

            taskList.addEventListener('dragstart', (e) => {

                e.target.classList.add('dragging');

                e.dataTransfer.effectAllowed = 'move';

            });



            taskList.addEventListener('dragend', (e) => {

                e.target.classList.remove('dragging');

            });



            taskList.addEventListener('dragover', (e) => {

                e.preventDefault();

                const afterElement = this.getDragAfterElement(taskList, e.clientY);

                const draggable = taskList.querySelector('.dragging');

                if (draggable) {

                    if (afterElement == null) {

                        taskList.appendChild(draggable);

                    } else {

                        taskList.insertBefore(draggable, afterElement);

                    }

                }

            });

            

             taskList.addEventListener('drop', (e) => {

                e.preventDefault();

                const draggable = taskList.querySelector('.dragging');

                if(!draggable) return;



                const currentTasks = store.state.tasks[dateStr];

                const reorderedTasks = [];

                

                taskList.querySelectorAll('.task-item').forEach(item => {

                    const originalIndex = parseInt(item.dataset.index);

                    if(currentTasks[originalIndex]) {

                         reorderedTasks.push(currentTasks[originalIndex]);

                    }

                });

                

                store.reorderTasks(dateStr, reorderedTasks);

             });

        }

    }



    getDragAfterElement(container, y) {

        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];



        return draggableElements.reduce((closest, child) => {

            const box = child.getBoundingClientRect();

            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {

                return { offset: offset, element: child };

            } else {

                return closest;

            }

        }, { offset: Number.NEGATIVE_INFINITY }).element;

    }

}customElements.define('daily-view', DailyView);

function renderApp() {
    document.querySelector('calendar-view').render();
    document.querySelector('daily-view').render();
    document.querySelector('goal-list').render();
    document.querySelector('app-header').render(); 
}
store.addEventListener('state-changed', renderApp);
