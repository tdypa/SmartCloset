import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDocs } from "firebase/firestore";
import { ClothingItem, Outfit, CategoryStructure } from "../types";

// --- 🛠️ STEP 1: PASTE YOUR FIREBASE CONFIG HERE ---
// Follow the instructions in the chat to get these values.
// Once filled, your friends can use the app without setting anything up!
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBMH2v_QmUxR92a9EWRFKWpL4w4aBY9tdI",
  authDomain: "closet-6471e.firebaseapp.com",
  projectId: "closet-6471e",
  storageBucket: "closet-6471e.firebasestorage.app",
  messagingSenderId: "304726614624",
  appId: "1:304726614624:web:6c601b4a85e0f71ed89905",
  measurementId: "G-W9E5BG8WTX"
};

// --- CONFIGURATION MANAGEMENT ---

const STORAGE_KEY_CONFIG = 'smartCloset_firebase_config';

export const getStoredFirebaseConfig = () => {
  // 1. Priority: Check if the developer (you) pasted the config in the code above
  if (YOUR_FIREBASE_CONFIG.apiKey && YOUR_FIREBASE_CONFIG.apiKey.length > 5) {
      return YOUR_FIREBASE_CONFIG;
  }
  // 2. Fallback: Check local storage (for the manual setup UI)
  const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
  return stored ? JSON.parse(stored) : null;
};

export const saveFirebaseConfig = (config: any) => {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  window.location.reload(); 
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  window.location.reload();
};

export const isHardcodedConfig = () => {
    return YOUR_FIREBASE_CONFIG.apiKey && YOUR_FIREBASE_CONFIG.apiKey.length > 5;
};

// --- INITIALIZATION ---

let app: FirebaseApp | undefined;
let auth: any;
let db: any;

const config = getStoredFirebaseConfig();

if (config) {
  try {
    app = !getApps().length ? initializeApp(config) : getApp();
    // Initialize services
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
    // CRITICAL: Reset app to undefined if auth/db fail, so the UI knows we are NOT ready.
    app = undefined; 
    auth = undefined;
    db = undefined;
    
    // Only clear local storage if it's not the hardcoded config causing issues
    if (!isHardcodedConfig()) {
        localStorage.removeItem(STORAGE_KEY_CONFIG);
    }
  }
}

// CRITICAL: We only consider firebase ready if BOTH app AND auth are initialized.
// Previously this only checked 'app', which caused the "Firebase not configured" error during login.
export const isFirebaseReady = () => !!app && !!auth;

// --- AUTHENTICATION ---

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase auth failed to load. Please refresh the page.");
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const loginWithEmail = async (email: string, pass: string, isSignUp: boolean) => {
    if (!auth) throw new Error("Firebase auth failed to load. Please refresh the page.");
    if (isSignUp) {
        return createUserWithEmailAndPassword(auth, email, pass);
    } else {
        return signInWithEmailAndPassword(auth, email, pass);
    }
}

export const logout = async () => {
  if (!auth) return;
  return signOut(auth);
};

// --- DATABASE OPERATIONS ---

// Helpers
const getUserRef = (uid: string) => `users/${uid}`;

export const subscribeToItems = (uid: string, callback: (items: ClothingItem[]) => void) => {
  if (!db) return () => {};
  
  const q = query(collection(db, `${getUserRef(uid)}/items`), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const items: ClothingItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ ...doc.data(), id: doc.id } as ClothingItem);
    });
    callback(items);
  });
};

export const addItemToCloud = async (uid: string, item: ClothingItem) => {
  if (!db) return;
  const { id, ...data } = item; 
  if (id && id.length > 10) { 
      await setDoc(doc(db, `${getUserRef(uid)}/items`, id), data);
  } else {
      await addDoc(collection(db, `${getUserRef(uid)}/items`), data);
  }
};

export const updateItemInCloud = async (uid: string, itemId: string, updates: Partial<ClothingItem>) => {
  if (!db) return;
  const itemRef = doc(db, `${getUserRef(uid)}/items`, itemId);
  await updateDoc(itemRef, updates);
};

// Sync Local Data to Cloud (One way)
export const syncLocalToCloud = async (uid: string, localItems: ClothingItem[]) => {
    if (!db) return;
    const batchPromises = localItems.map(item => addItemToCloud(uid, item));
    await Promise.all(batchPromises);
};
