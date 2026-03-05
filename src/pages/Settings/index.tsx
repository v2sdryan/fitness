import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { getLatestBodyMetrics } from '../../services/firestore';
import { calculateDailyBudget, calculateMacroTargets } from '../../utils/calories';
import type { AISettings, BodyMetrics } from '../../types';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useLocalStorage(`fittrack_profile_${user!.uid}`, {
    age: 39,
    height_cm: 183,
    gender: 'male' as 'male' | 'female',
    activityLevel: 'light',
  });

  const [aiSettings, setAiSettings] = useLocalStorage<AISettings>(`fittrack_ai_${user!.uid}`, {
    geminiKey: '',
    openrouterKey: '',
  });

  const [saved, setSaved] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<BodyMetrics | null>(null);

  useEffect(() => {
    if (user) getLatestBodyMetrics(user.uid).then(setLatestMetrics).catch(() => {});
  }, [user]);

  const currentWeight = latestMetrics?.weight_kg || 94;
  const budget = calculateDailyBudget(currentWeight, profile.height_cm, profile.age, profile.gender, profile.activityLevel);
  const macros = calculateMacroTargets(budget);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">settings</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">設定</h2>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        {/* 帳號資訊 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span> 帳號資訊
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-bold">{user?.email}</p>
              <p className="text-sm text-slate-500">已登入</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full py-3 border border-red-200 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"
          >
            登出
          </button>
        </section>

        {/* 個人資料 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">badge</span> 個人資料
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">年齡</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={e => setProfile({ ...profile, age: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">身高 (cm)</label>
                <input
                  type="number"
                  value={profile.height_cm}
                  onChange={e => setProfile({ ...profile, height_cm: Number(e.target.value) || 0 })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">性別</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setProfile({ ...profile, gender: 'male' })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    profile.gender === 'male' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  男
                </button>
                <button
                  onClick={() => setProfile({ ...profile, gender: 'female' })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    profile.gender === 'female' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  女
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">活動量等級</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'sedentary', label: '久坐' },
                  { key: 'light', label: '輕度活動' },
                  { key: 'moderate', label: '中度活動' },
                  { key: 'heavy', label: '重度活動' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setProfile({ ...profile, activityLevel: opt.key })}
                    className={`py-3 rounded-xl text-sm font-medium transition-all ${
                      profile.activityLevel === opt.key
                        ? 'bg-primary/10 text-primary border-2 border-primary'
                        : 'bg-slate-50 border border-slate-200 hover:bg-primary/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 計算結果 */}
        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
          <h3 className="font-bold mb-4 text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">calculate</span> 自動計算結果
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            根據最新體重 <span className="font-bold text-primary">{currentWeight} kg</span> 計算
            {latestMetrics && <span className="text-slate-400 ml-1">（{latestMetrics.date}）</span>}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">每日卡路里預算</p>
              <p className="text-2xl font-bold text-primary">{budget} <span className="text-sm font-normal">kcal</span></p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">蛋白質目標</p>
              <p className="text-2xl font-bold">{macros.protein_g} <span className="text-sm font-normal">g</span></p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">脂肪目標</p>
              <p className="text-2xl font-bold">{macros.fat_g} <span className="text-sm font-normal">g</span></p>
            </div>
            <div className="bg-white p-4 rounded-xl">
              <p className="text-xs text-slate-500">碳水目標</p>
              <p className="text-2xl font-bold">{macros.carbs_g} <span className="text-sm font-normal">g</span></p>
            </div>
          </div>
        </section>

        {/* AI 設定 */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span> AI 分析設定
          </h3>
          <p className="text-xs text-slate-400 mb-5">優先使用 Google Gemini，若失敗自動切換到 OpenRouter</p>

          <div className="space-y-5">
            {/* Gemini Key */}
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">優先</span>
                <label className="text-sm font-bold text-slate-700">Google Gemini</label>
              </div>

              {/* 模型選擇 */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">選擇模型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: '穩定快速' },
                    { key: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite', desc: '最新預覽' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setAiSettings({ ...aiSettings, geminiModel: opt.key as any })}
                      className={`p-2.5 rounded-lg text-left transition-all ${
                        (aiSettings.geminiModel || 'gemini-2.5-flash') === opt.key
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white border border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className={`text-[10px] ${(aiSettings.geminiModel || 'gemini-2.5-flash') === opt.key ? 'text-blue-100' : 'text-slate-400'}`}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="password"
                value={aiSettings.geminiKey}
                onChange={e => setAiSettings({ ...aiSettings, geminiKey: e.target.value })}
                placeholder="輸入 Google AI API Key"
                className="w-full px-4 py-3 rounded-xl bg-white border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-2">前往 aistudio.google.com 取得免費 API Key</p>
              {aiSettings.geminiKey && (
                <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span> 已設定
                </p>
              )}
            </div>

            {/* OpenRouter Key */}
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">備用</span>
                <label className="text-sm font-bold text-slate-700">OpenRouter (Kimi K2.5)</label>
              </div>
              <input
                type="password"
                value={aiSettings.openrouterKey}
                onChange={e => setAiSettings({ ...aiSettings, openrouterKey: e.target.value })}
                placeholder="輸入 OpenRouter API Key"
                className="w-full px-4 py-3 rounded-xl bg-white border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
              <p className="text-xs text-slate-400 mt-2">前往 openrouter.ai 取得 API Key</p>
              {aiSettings.openrouterKey && (
                <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">check_circle</span> 已設定
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 儲存按鈕 */}
        <button
          onClick={handleSave}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 transition-all"
        >
          {saved ? '已儲存 ✓' : '儲存設定'}
        </button>
      </main>
    </div>
  );
}
