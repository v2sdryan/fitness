import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getExercises, saveExercise, deleteExercise, toggleExerciseComplete } from '../../services/firestore';
import { getToday } from '../../utils/calories';
import type { ExerciseItem } from '../../types';

const exerciseTemplates = [
  { name: '跑步', icon: 'directions_run', color: 'bg-orange-100 text-orange-600' },
  { name: '游泳', icon: 'pool', color: 'bg-blue-100 text-blue-600' },
  { name: '重訓', icon: 'fitness_center', color: 'bg-red-100 text-red-600' },
  { name: '瑜珈', icon: 'self_improvement', color: 'bg-green-100 text-green-600' },
  { name: '登山', icon: 'hiking', color: 'bg-emerald-100 text-emerald-600' },
  { name: '單車', icon: 'directions_bike', color: 'bg-sky-100 text-sky-600' },
];

// 預設運動清單（復健/核心訓練）
const PRESET_EXERCISES: Omit<ExerciseItem, 'id'>[] = [
  {
    name: 'Deadbugs (手腳鬥力推)',
    icon: 'self_improvement',
    frequency: 4,
    duration_min: 10,
    calories_burned: 50,
    sets: 2,
    reps: 10,
    notes: '如無痛 交替伸直腳\n每邊做10下，休息1-2mins\n做2組，狀態好可以3組',
    completed: [],
  },
  {
    name: 'Good Morning (早安式)',
    icon: 'fitness_center',
    frequency: 4,
    duration_min: 10,
    calories_burned: 50,
    sets: 2,
    reps: 10,
    notes: '手放褲袋位 Hip向後推夾手\n每邊做10下，休息1-2mins\n做2組，狀態好可以3組',
    completed: [],
  },
  {
    name: 'Reverse Lunges (後跨步蹲)',
    icon: 'directions_walk',
    frequency: 4,
    duration_min: 10,
    calories_burned: 60,
    sets: 2,
    reps: 10,
    notes: '可先扶牆 後腳盡放後\n每邊做10下，休息1-2mins\n做2組，狀態好可以3組',
    completed: [],
  },
];

const frequencyOptions = [2, 3, 4, 7];
const durationOptions = [15, 30, 45, 60];
const setsOptions = [1, 2, 3, 4];
const repsOptions = [8, 10, 12, 15];

export default function ExercisePage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ExerciseItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 表單狀態
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('directions_run');
  const [formFreq, setFormFreq] = useState(3);
  const [formDuration, setFormDuration] = useState(30);
  const [formCalories, setFormCalories] = useState(300);
  const [formSets, setFormSets] = useState(2);
  const [formReps, setFormReps] = useState(10);
  const [formNotes, setFormNotes] = useState('');
  const [customDuration, setCustomDuration] = useState('');

  const today = getToday();
  const thisWeekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();

  useEffect(() => {
    if (!user) return;
    loadExercises();
  }, [user]);

  // Scroll to form when shown
  useEffect(() => {
    if (showModal && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [showModal, editItem]);

  const loadExercises = async () => {
    if (!user) return;
    let items = await getExercises(user.uid);
    if (items.length === 0) {
      for (const preset of PRESET_EXERCISES) {
        await saveExercise(user.uid, preset as ExerciseItem);
      }
      items = await getExercises(user.uid);
    } else {
      // Dedup: keep first occurrence of each name, delete extras
      const seen = new Map<string, string>();
      const dupeIds: string[] = [];
      for (const item of items) {
        if (seen.has(item.name)) {
          if (item.id) dupeIds.push(item.id);
        } else {
          seen.set(item.name, item.id || '');
        }
      }
      if (dupeIds.length > 0) {
        for (const id of dupeIds) {
          await deleteExercise(user.uid, id);
        }
        items = items.filter(i => !dupeIds.includes(i.id || ''));
      }
    }
    setExercises(items);
  };

  const totalPlanned = exercises.reduce((s, e) => s + e.frequency, 0);
  const completedThisWeek = exercises.reduce((s, e) => {
    return s + (e.completed || []).filter(d => d >= thisWeekStart).length;
  }, 0);

  const handleComplete = async (exercise: ExerciseItem) => {
    if (!user || !exercise.id) return;
    await toggleExerciseComplete(user.uid, exercise.id, today);
    const updated = await getExercises(user.uid);
    setExercises(updated);
  };

  const handleSave = async () => {
    if (!user || !formName.trim()) return;
    const dur = customDuration ? parseInt(customDuration) : formDuration;
    const item: ExerciseItem = {
      ...(editItem?.id ? { id: editItem.id } : {}),
      name: formName,
      icon: formIcon,
      frequency: formFreq,
      duration_min: dur,
      calories_burned: formCalories,
      sets: formSets,
      reps: formReps,
      notes: formNotes,
      completed: editItem?.completed || [],
    };
    await saveExercise(user.uid, item);
    const updated = await getExercises(user.uid);
    setExercises(updated);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteExercise(user.uid, id);
    setExercises(exercises.filter(e => e.id !== id));
    setConfirmDelete(null);
  };

  const openEdit = (item: ExerciseItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormIcon(item.icon);
    setFormFreq(item.frequency);
    setFormDuration(item.duration_min);
    setFormCalories(item.calories_burned);
    setFormSets(item.sets || 2);
    setFormReps(item.reps || 10);
    setFormNotes(item.notes || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setShowModal(false);
    setEditItem(null);
    setFormName('');
    setFormIcon('directions_run');
    setFormFreq(3);
    setFormDuration(30);
    setFormCalories(300);
    setFormSets(2);
    setFormReps(10);
    setFormNotes('');
    setCustomDuration('');
  };

  const getExerciseColor = (icon: string) => {
    const t = exerciseTemplates.find(et => et.icon === icon);
    return t?.color || 'bg-purple-100 text-purple-600';
  };

  // 本週日曆
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  });
  const dayNames = '日一二三四五六';

  // Inline form component
  const renderForm = (
    <div ref={formRef} className="bg-white p-5 rounded-2xl shadow-xl border-2 border-primary/20">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold">{editItem ? '編輯運動計畫' : '新增運動計畫'}</h3>
        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">運動名稱</label>
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            placeholder="輸入運動名稱"
            value={formName}
            onChange={e => setFormName(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            {exerciseTemplates.map(t => (
              <button
                key={t.name}
                onClick={() => { setFormName(t.name); setFormIcon(t.icon); }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${
                  formIcon === t.icon && formName === t.name
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-100 bg-white hover:border-primary'
                }`}
              >
                <span className={`material-symbols-outlined mb-1 ${t.color.split(' ')[1]}`}>{t.icon}</span>
                <span className="text-xs">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">頻率設定</label>
          <div className="flex flex-wrap gap-2">
            {frequencyOptions.map(f => (
              <button
                key={f}
                onClick={() => setFormFreq(f)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  formFreq === f
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
                    : 'border border-slate-200 hover:bg-primary/5'
                }`}
              >
                {f === 7 ? '每天' : `每週 ${f} 次`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">組數</label>
            <div className="flex flex-wrap gap-2">
              {setsOptions.map(s => (
                <button
                  key={s}
                  onClick={() => setFormSets(s)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    formSets === s
                      ? 'bg-primary/10 text-primary border-2 border-primary font-bold'
                      : 'border border-slate-200 hover:bg-primary/5'
                  }`}
                >
                  {s}組
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">每組次數</label>
            <div className="flex flex-wrap gap-2">
              {repsOptions.map(r => (
                <button
                  key={r}
                  onClick={() => setFormReps(r)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    formReps === r
                      ? 'bg-primary/10 text-primary border-2 border-primary font-bold'
                      : 'border border-slate-200 hover:bg-primary/5'
                  }`}
                >
                  {r}下
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">持續時間</label>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map(d => (
              <button
                key={d}
                onClick={() => { setFormDuration(d); setCustomDuration(''); }}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  formDuration === d && !customDuration
                    ? 'bg-primary/10 text-primary border-2 border-primary font-bold'
                    : 'border border-slate-200 hover:bg-primary/5'
                }`}
              >
                {d}分
              </button>
            ))}
            <input
              type="number"
              placeholder="自訂"
              value={customDuration}
              onChange={e => setCustomDuration(e.target.value)}
              className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">預估消耗 (kcal)</label>
          <input
            type="number"
            value={formCalories}
            onChange={e => setFormCalories(Number(e.target.value) || 0)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">動作備註/提示</label>
          <textarea
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            placeholder="記錄動作要點、注意事項..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 transition-all"
        >
          {editItem ? '更新計畫' : '儲存計畫'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <header className="flex items-center justify-between border-b border-primary/10 bg-white px-6 py-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">fitness_center</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">運動管理</h2>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-4 py-4 space-y-4 pb-24">
        {/* 本週運動曆 (top) */}
        <section className="bg-white p-4 rounded-2xl border border-primary/5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">本週運動</h3>
            <span className="text-xs text-slate-400">{completedThisWeek}/{totalPlanned} 已完成</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0];
              const isToday = ds === today;
              const completedExercises = exercises.filter(e => (e.completed || []).includes(ds));
              const hasExercise = completedExercises.length > 0;
              const isPast = d < new Date() && !isToday;
              return (
                <div key={i} className={`flex flex-col items-center gap-1.5 ${!isPast && !isToday ? 'opacity-40' : ''}`}>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-primary font-bold' : 'text-slate-400'}`}>
                    {dayNames[d.getDay()]}
                  </span>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    isToday
                      ? 'bg-primary/20 text-primary ring-2 ring-primary ring-offset-1'
                      : hasExercise
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-300'
                  }`}>
                    <span className="material-symbols-outlined text-lg">
                      {hasExercise ? 'check' : (isToday ? 'fitness_center' : 'remove')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 運動清單 */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold">今日運動清單</h2>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1 text-primary text-sm font-bold hover:underline">
              <span className="material-symbols-outlined text-sm">add</span> 新增計畫
            </button>
          </div>
          <div className="space-y-3">
            {/* Add form at top of list */}
            {showModal && !editItem && renderForm}

            {exercises.map(ex => {
              const completedCount = (ex.completed || []).filter(d => d >= thisWeekStart).length;
              const isCompletedToday = (ex.completed || []).includes(today);
              return (
                <div key={ex.id}>
                  <div className="rounded-2xl bg-white shadow-sm border border-primary/5 overflow-hidden">
                    {/* 主要資訊列 */}
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getExerciseColor(ex.icon)}`}>
                          <span className="material-symbols-outlined text-2xl">{ex.icon}</span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold truncate">{ex.name}</p>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold whitespace-nowrap">
                              {ex.frequency === 7 ? '每天' : `週${ex.frequency}次`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-500">{completedCount}/{ex.frequency}</span>
                            {(ex.sets || ex.reps) && (
                              <span className="text-xs text-slate-400">· {ex.sets || 2}組x{ex.reps || 10}下</span>
                            )}
                            <span className="text-xs text-slate-400">· {ex.calories_burned}kcal</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => openEdit(ex)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(confirmDelete === ex.id ? null : ex.id!)}
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:text-red-600 flex items-center justify-center transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                        <button
                          onClick={() => handleComplete(ex)}
                          className={`flex items-center justify-center px-3 h-8 rounded-lg text-xs font-bold transition-all shadow-sm ${
                            isCompletedToday
                              ? 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600'
                              : 'bg-primary text-white shadow-primary/20 hover:opacity-90'
                          }`}
                        >
                          {isCompletedToday ? '已完成 ✓' : '完成'}
                        </button>
                      </div>
                    </div>

                    {/* 刪除確認 */}
                    {confirmDelete === ex.id && (
                      <div className="px-4 pb-3 flex items-center gap-3 bg-red-50 border-t border-red-100">
                        <span className="text-sm text-red-600">確定刪除？</span>
                        <button
                          onClick={() => ex.id && handleDelete(ex.id)}
                          className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg"
                        >
                          確定
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1 bg-white text-slate-500 text-xs font-bold rounded-lg border border-slate-200"
                        >
                          取消
                        </button>
                      </div>
                    )}

                    {/* 備註區 */}
                    {ex.notes && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-500 whitespace-pre-line leading-relaxed">
                          <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-slate-400">sticky_note_2</span>
                          {ex.notes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Edit form inline below this exercise */}
                  {showModal && editItem?.id === ex.id && (
                    <div className="mt-3">{renderForm}</div>
                  )}
                </div>
              );
            })}
            {exercises.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 block">fitness_center</span>
                <p>載入中...</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
