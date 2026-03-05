import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getLatestBodyMetrics, getMealEntries, getExercises } from '../../services/firestore';
import { calculateDailyBudget, calculateMacroTargets } from '../../utils/calories';
import { useToday } from '../../hooks/useToday';
import type { BodyMetrics, MealEntry, ExerciseItem } from '../../types';
import { useLocalStorage } from '../../hooks/useLocalStorage';

export default function Dashboard() {
  const { user } = useAuth();
  const [latestMetrics, setLatestMetrics] = useState<BodyMetrics | null>(null);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [profile] = useLocalStorage(`fittrack_profile_${user!.uid}`, {
    age: 39, height_cm: 183, gender: 'male' as const, activityLevel: 'light'
  });

  const today = useToday();
  const weight = latestMetrics?.weight_kg || 94;
  const budget = calculateDailyBudget(weight, profile.height_cm, profile.age, profile.gender, profile.activityLevel);
  const macros = calculateMacroTargets(budget);

  const totalCaloriesIn = meals.reduce((s, m) => s + m.total_calories, 0);
  const completedToday = exercises.filter(e => e.completed?.includes(today)).length;
  const totalCaloriesOut = exercises
    .filter(e => e.completed?.includes(today))
    .reduce((s, e) => s + e.calories_burned, 0);
  const remaining = budget - totalCaloriesIn + totalCaloriesOut;

  const totalProtein = meals.reduce((s, m) => s + m.total_protein_g, 0);
  const totalFat = meals.reduce((s, m) => s + m.total_fat_g, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.total_carbs_g, 0);
  const totalFiber = meals.reduce((s, m) => s + (m.total_fiber_g || 0), 0);

  // 進度環計算
  const circumference = 2 * Math.PI * 80;
  const progress = Math.min(totalCaloriesIn / budget, 1);
  const dashOffset = circumference * (1 - progress);

  // 連續記錄天數（簡化版：從 localStorage）
  const [streak] = useLocalStorage(`fittrack_streak_${user!.uid}`, 0);

  useEffect(() => {
    if (!user) return;
    getLatestBodyMetrics(user.uid).then(setLatestMetrics).catch(() => {});
    getMealEntries(user.uid, today).then(setMeals).catch(() => {});
    getExercises(user.uid).then(setExercises).catch(() => {});
  }, [user, today]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安';
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${'日一二三四五六'[now.getDay()]}`;

  return (
    <div>
      {/* 頂部導航 */}
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white sticky top-0 z-40" style={{ transform: 'translateZ(0)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-primary p-1.5 rounded-lg text-white shrink-0">
            <span className="material-symbols-outlined block text-xl">monitor_weight</span>
          </div>
          <h2 className="text-base font-bold tracking-tight truncate">健康減重助手</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
        {/* 歡迎訊息 */}
        <section>
          <h1 className="text-2xl font-bold">{greeting}，{user?.email?.split('@')[0] || '用戶'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{dateStr}</p>
        </section>

        {/* 卡路里圓形進度 */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 192 192">
                <circle cx="96" cy="96" r="80" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="96" cy="96" r="80" fill="transparent"
                  strokeWidth="12" strokeLinecap="round"
                  stroke="url(#gradient)"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="progress-ring-circle"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-sm">剩餘</span>
                <span className="text-3xl font-bold">{remaining.toLocaleString()}</span>
                <span className="text-slate-500 text-xs">kcal</span>
              </div>
            </div>
            <div className="grid grid-cols-3 w-full mt-5 pt-4 border-t border-slate-100 text-center">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">已攝取</p>
                <p className="text-lg font-bold">{totalCaloriesIn.toLocaleString()}</p>
              </div>
              <div className="border-x border-slate-100">
                <p className="text-xs text-slate-500 uppercase tracking-wider">預算</p>
                <p className="text-lg font-bold text-primary">{budget.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">已消耗</p>
                <p className="text-lg font-bold text-success">{totalCaloriesOut}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2x2 資訊格 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 今日體重 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg mb-3 inline-block">scale</span>
            <p className="text-slate-500 text-sm">今日體重</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{latestMetrics?.weight_kg || '--'}</span>
              <span className="text-sm text-slate-500">kg</span>
            </div>
          </div>

          {/* 營養概覽 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg mb-3 inline-block">nutrition</span>
            <p className="text-slate-500 text-sm mb-3">營養概覽</p>
            <div className="space-y-2.5">
              <NutrientBar label="蛋白質" current={totalProtein} target={macros.protein_g} color="bg-primary" />
              <NutrientBar label="脂肪" current={totalFat} target={macros.fat_g} color="bg-warning" />
              <NutrientBar label="碳水" current={totalCarbs} target={macros.carbs_g} color="bg-danger" />
              <NutrientBar label="纖維" current={totalFiber} target={macros.fiber_g} color="bg-emerald-500" />
            </div>
          </div>

          {/* 運動達成 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="relative w-16 h-16 mb-2">
              <svg className="w-full h-full" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="transparent"
                  stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={175.9}
                  strokeDashoffset={exercises.length ? 175.9 * (1 - completedToday / Math.max(exercises.reduce((s, e) => s + e.frequency, 0) / 7, 1)) : 175.9}
                  className="progress-ring-circle"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-success">exercise</span>
              </div>
            </div>
            <p className="text-slate-500 text-sm">運動達成</p>
            <p className="text-xl font-bold mt-1">{completedToday} / {exercises.length} <span className="text-xs font-normal">項目</span></p>
          </div>

          {/* 連續達標 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="bg-orange-100 p-3 rounded-full mb-2">
              <span className="material-symbols-outlined text-orange-500 text-3xl">local_fire_department</span>
            </div>
            <p className="text-slate-500 text-sm">連續達標</p>
            <p className="text-2xl font-bold mt-1">{streak} <span className="text-xs font-normal">天</span></p>
          </div>
        </div>

        {/* 每日小撇步 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-4 items-start">
          <span className="material-symbols-outlined text-primary">lightbulb</span>
          <div>
            <h4 className="font-bold text-sm text-primary">每日小撇步</h4>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              攝取足夠的水分有助於提高代謝，建議每餐前飲用 300ml 溫開水。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function NutrientBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min(Math.round((current / target) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] uppercase font-bold">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
