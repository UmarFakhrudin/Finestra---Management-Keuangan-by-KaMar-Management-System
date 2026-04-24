import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword
} from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use default database if not specified or is "(default)"
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

let dbInstance;
try {
  const settings = {
    experimentalForceLongPolling: true,
    cacheSizeBytes: 1048576, // 1MB cache to keep it light
  };
  
  if (dbId) {
    dbInstance = initializeFirestore(app, settings, dbId);
  } else {
    dbInstance = initializeFirestore(app, settings);
  }
} catch (e: any) {
  // If already initialized, get the existing instance
  dbInstance = getFirestore(app, dbId || '(default)');
}

export const db = dbInstance;

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const signOut = () => auth.signOut();
