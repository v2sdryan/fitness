import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User
} from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

// Firebase 錯誤碼中文對照
function getErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': '電子郵件格式不正確',
    'auth/user-disabled': '此帳號已被停用',
    'auth/user-not-found': '帳號不存在，請先註冊',
    'auth/wrong-password': '密碼錯誤，請重新輸入',
    'auth/invalid-credential': '帳號或密碼錯誤',
    'auth/email-already-in-use': '此電子郵件已被註冊',
    'auth/weak-password': '密碼強度不足，至少需要 6 個字元',
    'auth/too-many-requests': '登入嘗試過多，請稍後再試',
    'auth/network-request-failed': '網路連線異常，請檢查網路',
  };
  return map[code] || '發生未知錯誤，請稍後再試';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      throw new Error(getErrorMessage(err.code));
    }
  };

  const register = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      throw new Error(getErrorMessage(err.code));
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
