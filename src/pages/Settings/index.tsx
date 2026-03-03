import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { calculateDailyBudget, calculateMacroTargets } from '../../utils/calories';
import type { AIProvider } from '../../types';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useLocalStorage('fittrack_profile', {
    age: 39,
    height_cm: 183,
    gender: 'male' as 'male' | 'female',
    activityLevel: 'light',
  });

  const [aiSettings, setAiSettings] = useLocalStorage<{ provider: AIProvider; apiKey: string }>('fittrack_ai', {
    provider: 'gemini',
    apiKey: '',
  });

  const [saved, setSaved] = useState(false);

  const budget = calculateDailyBudget(94, profile.height_cm, profile.age, profile.gender, profile.activityLevel);
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
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">auto_awesome</span> AI 分析設定
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">AI 提供者</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setAiSettings({ ...aiSettings, provider: 'gemini' })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    aiSettings.provider === 'gemini' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  Google Gemini 2.5 Flash
                </button>
                <button
                  onClick={() => setAiSettings({ ...aiSettings, provider: 'openrouter' })}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    aiSettings.provider === 'openrouter' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  OpenRouter (Kimi K2.5)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {aiSettings.provider === 'gemini' ? 'Google AI API Key' : 'OpenRouter API Key'}
              </label>
              <input
                type="password"
                value={aiSettings.apiKey}
                onChange={e => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                placeholder={aiSettings.provider === 'gemini' ? '輸入 Google AI API Key' : '輸入 OpenRouter API Key'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <p className="text-xs text-slate-400 mt-2">
                {aiSettings.provider === 'gemini'
                  ? '前往 aistudio.google.com 取得 API Key'
                  : '前往 openrouter.ai 取得 API Key'}
              </p>
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
