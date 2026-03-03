import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMealEntries, saveMealEntry, deleteMealEntry } from '../../services/firestore';
import { analyzeFoodImage, analyzeFoodText } from '../../services/ai';
import { getToday, calculateDailyBudget, calculateMacroTargets } from '../../utils/calories';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { MealEntry, AISettings } from '../../types';

const mealTypes = [
  { key: 'breakfast', label: '早餐', icon: 'light_mode', color: 'text-amber-500' },
  { key: 'lunch', label: '午餐', icon: 'cloud', color: 'text-blue-400' },
  { key: 'dinner', label: '晚餐', icon: 'dark_mode', color: 'text-indigo-400' },
  { key: 'snack', label: '點心', icon: 'cookie', color: 'text-orange-400' },
] as const;

export default function MealTracker() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputMode, setInputMode] = useState<'photo' | 'text'>('photo');
  const [mealType, setMealType] = useState<string>('lunch');
  const [textInput, setTextInput] = useState('');
  const [aiResult, setAiResult] = useState<MealEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [aiSettings] = useLocalStorage<AISettings>('fittrack_ai', {
    geminiKey: '', openrouterKey: ''
  });
  const [profile] = useLocalStorage('fittrack_profile', {
    age: 39, height_cm: 183, gender: 'male' as const, activityLevel: 'light'
  });

  const budget = calculateDailyBudget(94, profile.height_cm, profile.age, profile.gender, profile.activityLevel);
  const macros = calculateMacroTargets(budget);

  useEffect(() => {
    if (!user) return;
    getMealEntries(user.uid, selectedDate).then(setMeals).catch(() => {});
  }, [user, selectedDate]);

  const totalCal = meals.reduce((s, m) => s + m.total_calories, 0);
  const remaining = budget - totalCal;
  const progress = Math.min((totalCal / budget) * 100, 100);

  const totalProtein = meals.reduce((s, m) => s + m.total_protein_g, 0);
  const totalFat = meals.reduce((s, m) => s + m.total_fat_g, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.total_carbs_g, 0);
  const totalFiber = meals.reduce((s, m) => s + (m.total_fiber_g || 0), 0);

  const getMealCalories = (type: string) =>
    meals.filter(m => m.meal_type === type).reduce((s, m) => s + m.total_calories, 0);

  // 產生日期選擇列
  const datePicker = () => {
    const dates = [];
    const base = new Date(selectedDate);
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const handlePhotoUpload = async (file: File) => {
    if (!aiSettings.geminiKey && !aiSettings.openrouterKey) { setError('請先在設定頁面填入至少一組 AI API Key'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await analyzeFoodImage(aiSettings, file, mealType);
      setAiResult(data);
    } catch (err: any) {
      setError(err.message || 'AI 分析失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleTextAnalyze = async () => {
    if (!aiSettings.geminiKey && !aiSettings.openrouterKey) { setError('請先在設定頁面填入至少一組 AI API Key'); return; }
    if (!textInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await analyzeFoodText(aiSettings, textInput, mealType);
      setAiResult(data);
    } catch (err: any) {
      setError(err.message || 'AI 分析失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !aiResult) return;
    setLoading(true);
    try {
      await saveMealEntry(user.uid, selectedDate, aiResult);
      const updated = await getMealEntries(user.uid, selectedDate);
      setMeals(updated);
      setShowAddModal(false);
      setAiResult(null);
      setTextInput('');
    } catch (err: any) {
      setError('儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!user) return;
    await deleteMealEntry(user.uid, selectedDate, entryId);
    setMeals(meals.filter(m => m.id !== entryId));
  };

  const dayNames = '日一二三四五六';

  return (
    <div>
      {/* 頂部導航 */}
      <header className="flex items-center justify-between border-b border-primary/10 px-6 py-4 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg text-white">
            <span className="material-symbols-outlined block">restaurant_menu</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">飲食記錄</h2>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-primary/10 text-primary">
            <span className="material-symbols-outlined">calendar_today</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full pb-32">
        {/* 日期選擇 */}
        <div className="flex gap-3 p-4 overflow-x-auto hide-scrollbar whitespace-nowrap">
          {datePicker().map(d => {
            const ds = d.toISOString().split('T')[0];
            const isToday = ds === getToday();
            const isSelected = ds === selectedDate;
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`flex flex-col items-center justify-center min-w-[64px] h-20 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-slate-200/50 hover:bg-slate-200'
                }`}
              >
                <p className={`text-xs ${isSelected ? 'opacity-80' : 'text-slate-500'}`}>
                  {d.getMonth() + 1}/{d.getDate()}
                </p>
                <p className="font-bold">{isToday ? '今日' : dayNames[d.getDay()]}</p>
              </button>
            );
          })}
        </div>

        {/* 卡路里摘要 */}
        <div className="mx-4 p-5 rounded-2xl bg-white border border-primary/5 shadow-sm mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">已攝取</p>
              <h3 className="text-3xl font-bold text-primary">
                {totalCal.toLocaleString()} <span className="text-sm font-normal text-slate-400">kcal</span>
              </h3>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">目標預算</p>
              <h3 className="text-xl font-semibold">
                {budget.toLocaleString()} <span className="text-sm font-normal text-slate-400">kcal</span>
              </h3>
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between items-center text-sm">
            <span className="text-slate-500">進度 {Math.round(progress)}%</span>
            <span className={`font-medium ${remaining >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {remaining >= 0 ? `剩餘 ${remaining.toLocaleString()} kcal` : `超出 ${Math.abs(remaining).toLocaleString()} kcal`}
            </span>
          </div>
        </div>

        {/* 餐食分類 */}
        <div className="flex flex-col gap-4 px-4">
          {mealTypes.map(mt => {
            const mealItems = meals.filter(m => m.meal_type === mt.key);
            const cal = getMealCalories(mt.key);
            return (
              <details key={mt.key} className="group bg-white rounded-xl border border-slate-100 overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${mt.color}`}>{mt.icon}</span>
                    <span className="font-bold text-lg">{mt.label}</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-normal">{cal} kcal</span>
                  </div>
                  <span className="material-symbols-outlined group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {mealItems.map(entry =>
                    entry.items.map((item, i) => (
                      <div key={`${entry.id}-${i}`} className="flex justify-between items-center py-2 border-b border-slate-50">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-slate-400">蛋白質 {item.protein_g}g · 脂肪 {item.fat_g}g · 碳水 {item.carbs_g}g</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-600">{item.calories} kcal</span>
                          <button onClick={() => entry.id && handleDelete(entry.id)} className="text-slate-300 hover:text-red-400">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => { setMealType(mt.key); setShowAddModal(true); }}
                    className="w-full py-2 mt-2 border-2 border-dashed border-primary/20 rounded-lg text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add</span> 新增食物
                  </button>
                </div>
              </details>
            );
          })}
        </div>

        {/* 新增飲食記錄面板 */}
        {showAddModal && (
          <div className="mt-10 mx-4 bg-white rounded-2xl border border-primary/20 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">新增飲食記錄</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded">AI 助手已就緒</span>
                <button onClick={() => { setShowAddModal(false); setAiResult(null); setError(''); }} className="text-slate-400 hover:text-slate-600">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* 輸入模式切換 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setInputMode('photo')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl ${inputMode === 'photo' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-700'}`}
              >
                <span className="material-symbols-outlined text-3xl">photo_camera</span>
                <span className="font-medium">拍照識別</span>
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl ${inputMode === 'text' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-700'}`}
              >
                <span className="material-symbols-outlined text-3xl">edit_note</span>
                <span className="font-medium">文字輸入</span>
              </button>
            </div>

            {/* 選擇餐點 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-500 mb-1">選擇餐點</label>
              <select
                value={mealType}
                onChange={e => setMealType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 px-4 focus:ring-2 focus:ring-primary"
              >
                {mealTypes.map(mt => <option key={mt.key} value={mt.key}>{mt.label}</option>)}
              </select>
            </div>

            {/* 輸入區域 */}
            {inputMode === 'photo' ? (
              <div className="mb-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="w-full py-4 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 text-primary font-medium hover:bg-primary/10 transition-colors"
                >
                  {loading ? '分析中...' : '點擊上傳食物照片'}
                </button>
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="描述你吃了什麼，例如：一碗叉燒飯、一杯凍檸茶"
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary resize-none text-sm"
                />
                <button
                  onClick={handleTextAnalyze}
                  disabled={loading || !textInput.trim()}
                  className="w-full py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {loading ? 'AI 分析中...' : 'AI 分析'}
                </button>
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {/* AI 分析結果（可編輯） */}
            {aiResult && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-4">
                <p className="text-xs font-bold text-primary mb-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">auto_awesome</span> AI 分析結果
                </p>
                <div className="space-y-3">
                  {aiResult.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 uppercase font-bold">食物名稱</label>
                        <input
                          className="w-full bg-transparent border-b border-primary/20 py-1 focus:outline-none focus:border-primary text-lg font-bold"
                          value={item.name}
                          onChange={e => {
                            const items = [...aiResult.items];
                            items[idx] = { ...items[idx], name: e.target.value };
                            setAiResult({ ...aiResult, items });
                          }}
                        />
                      </div>
                      <EditField label="卡路里 (kcal)" value={item.calories} onChange={v => {
                        const items = [...aiResult.items];
                        items[idx] = { ...items[idx], calories: v };
                        setAiResult({ ...aiResult, items, total_calories: items.reduce((s, i) => s + i.calories, 0) });
                      }} />
                      <EditField label="蛋白質 (g)" value={item.protein_g} onChange={v => {
                        const items = [...aiResult.items];
                        items[idx] = { ...items[idx], protein_g: v };
                        setAiResult({ ...aiResult, items, total_protein_g: items.reduce((s, i) => s + i.protein_g, 0) });
                      }} />
                      <EditField label="脂肪 (g)" value={item.fat_g} onChange={v => {
                        const items = [...aiResult.items];
                        items[idx] = { ...items[idx], fat_g: v };
                        setAiResult({ ...aiResult, items, total_fat_g: items.reduce((s, i) => s + i.fat_g, 0) });
                      }} />
                      <EditField label="碳水 (g)" value={item.carbs_g} onChange={v => {
                        const items = [...aiResult.items];
                        items[idx] = { ...items[idx], carbs_g: v };
                        setAiResult({ ...aiResult, items, total_carbs_g: items.reduce((s, i) => s + i.carbs_g, 0) });
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiResult && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? '儲存中...' : '儲存記錄'}
              </button>
            )}
          </div>
        )}

        {/* 按鈕：顯示新增面板 */}
        {!showAddModal && (
          <div className="px-4 mt-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add</span> 新增飲食記錄
            </button>
          </div>
        )}
      </main>

      {/* 底部營養素追蹤 */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-2 shadow-2xl z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-x-8 gap-y-3">
          <MacroBar label="蛋白質" current={totalProtein} target={macros.protein_g} />
          <MacroBar label="脂肪" current={totalFat} target={macros.fat_g} />
          <MacroBar label="碳水" current={totalCarbs} target={macros.carbs_g} />
          <MacroBar label="膳食纖維" current={totalFiber} target={macros.fiber_g} />
        </div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-slate-400 uppercase font-bold">{label}</label>
      <input
        type="number"
        className="w-full bg-transparent border-b border-primary/20 py-1 focus:outline-none focus:border-primary font-mono"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function MacroBar({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(Math.round((current / target) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span>{label}</span>
        <span className="text-primary">{current}g / {target}g</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
