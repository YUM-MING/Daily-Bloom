import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  projectId: "dailybloomyourday",
  appId: "1:88048485399:web:b05b9d076e32cf0ffc8852",
  storageBucket: "dailybloomyourday.firebasestorage.app",
  apiKey: "AIzaSyBUWYtvTKiqpKWY9VtuvgdHILew9qydLfU",
  authDomain: "dailybloomyourday.firebaseapp.com",
  messagingSenderId: "88048485399"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export { auth, provider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, addDoc, onSnapshot, deleteDoc };