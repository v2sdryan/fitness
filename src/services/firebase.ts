import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyCHQMFESgloq0kxsFt7lHAsQ4MK9Yu06rc",
  authDomain: "fitness-4a13e.firebaseapp.com",
  projectId: "fitness-4a13e",
  storageBucket: "fitness-4a13e.firebasestorage.app",
  messagingSenderId: "890989600976",
  appId: "1:890989600976:web:3d0fd8fc4c1f2546bf3ed5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
