import { db } from './firebase';
import {
  doc, setDoc, getDoc, getDocs, addDoc, deleteDoc, updateDoc,
  collection, query, orderBy, where
} from 'firebase/firestore';
import type { UserProfile, BodyMetrics, MealEntry, ExerciseItem } from '../types';

// ===== 用戶資料 =====
export async function saveProfile(userId: string, profile: UserProfile) {
  await setDoc(doc(db, 'users', userId, 'profile', 'data'), profile);
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'profile', 'data'));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ===== 身體數據 =====
export async function saveBodyMetrics(userId: string, data: BodyMetrics) {
  await setDoc(doc(db, 'users', userId, 'bodyMetrics', data.date), data);
}

export async function getBodyMetricsRange(userId: string, startDate?: string): Promise<BodyMetrics[]> {
  const ref = collection(db, 'users', userId, 'bodyMetrics');
  const q = startDate
    ? query(ref, where('date', '>=', startDate), orderBy('date', 'asc'))
    : query(ref, orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BodyMetrics);
}

export async function deleteBodyMetrics(userId: string, date: string) {
  await deleteDoc(doc(db, 'users', userId, 'bodyMetrics', date));
}

export async function getBodyMetricsByDate(userId: string, date: string): Promise<BodyMetrics | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'bodyMetrics', date));
  return snap.exists() ? (snap.data() as BodyMetrics) : null;
}

export async function getLatestBodyMetrics(userId: string): Promise<BodyMetrics | null> {
  const ref = collection(db, 'users', userId, 'bodyMetrics');
  const q = query(ref, orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.length > 0 ? (snap.docs[0].data() as BodyMetrics) : null;
}

// ===== 飲食記錄 =====
export async function saveMealEntry(userId: string, date: string, entry: MealEntry) {
  const ref = collection(db, 'users', userId, 'meals', date, 'entries');
  const docRef = await addDoc(ref, { ...entry, timestamp: new Date().toISOString() });
  return docRef.id;
}

export async function getMealEntries(userId: string, date: string): Promise<MealEntry[]> {
  const ref = collection(db, 'users', userId, 'meals', date, 'entries');
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MealEntry));
}

export async function deleteMealEntry(userId: string, date: string, entryId: string) {
  await deleteDoc(doc(db, 'users', userId, 'meals', date, 'entries', entryId));
}

// ===== 運動項目 =====
export async function saveExercise(userId: string, item: ExerciseItem) {
  const { id, ...data } = item;
  if (id) {
    await updateDoc(doc(db, 'users', userId, 'exercises', id), data);
    return id;
  }
  const ref = collection(db, 'users', userId, 'exercises');
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export async function getExercises(userId: string): Promise<ExerciseItem[]> {
  const ref = collection(db, 'users', userId, 'exercises');
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseItem));
}

export async function deleteExercise(userId: string, exerciseId: string) {
  await deleteDoc(doc(db, 'users', userId, 'exercises', exerciseId));
}

export async function toggleExerciseComplete(userId: string, exerciseId: string, date: string) {
  const ref = doc(db, 'users', userId, 'exercises', exerciseId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as ExerciseItem;
    let completed = data.completed || [];
    if (completed.includes(date)) {
      completed = completed.filter(d => d !== date);
    } else {
      completed.push(date);
    }
    await updateDoc(ref, { completed });
  }
}
