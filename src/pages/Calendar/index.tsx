import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getMealEntries, getBodyMetricsRange } from '../../services/firestore';
import { calculateDailyBudget } from '../../utils/calories';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToday } from '../../hooks/useToday';
import type { MealEntry, BodyMetrics } from '../../types';

export default function CalendarPage() {
  const { user } = useAuth();
  const today = useToday();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // 午夜過後自動跳到新的月份
  useEffect(() => {
    const d = new Date(today);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }, [today]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<Record<string, { meals: MealEntry[]; weight?: number; totalCal: number }>>({});
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [profile] = useLocalStorage('fittrack_profile', {
    age: 39, height_cm: 183, gender: 'male' as const, activityLevel: 'light'
  });

  const budget = calculateDailyBudget(94, profile.height_cm, profile.age, profile.gender, profile.activityLevel);

  useEffect(() => {
    if (!user) return;
    loadMonthData();
  }, [user, year, month]);

  const loadMonthData = async () => {
    if (!user) return;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-31`;

    // 載入整月的身體數據
    const metrics = await getBodyMetricsRange(user.uid, startDate).catch(() => [] as BodyMetrics[]);
    const metricsMap: Record<string, number> = {};
    metrics.forEach(m => { if (m.date <= endDate) metricsMap[m.date] = m.weight_kg; });

    // 載入每日飲食（簡化：只載入有數據的日子）
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const data: typeof dailyData = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      try {
        const meals = await getMealEntries(user.uid, ds);
        if (meals.length > 0 || metricsMap[ds]) {
          data[ds] = {
            meals,
            weight: metricsMap[ds],
            totalCal: meals.reduce((s, m) => s + m.total_calories, 0),
          };
        }
      } catch { /* skip */ }
    }
    setDailyData(data);
  };

  const getStatus = (date: string): 'good' | 'warning' | 'over' | 'none' => {
    const d = dailyData[date];
    if (!d || d.meals.length === 0) return 'none';
    const ratio = d.totalCal / budget;
    if (ratio > 1) return 'over';
    if (ratio > 0.8) return 'warning';
    return 'good';
  };

  const statusColors = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    over: 'bg-red-500',
    none: 'bg-slate-300',
  };

  // 月曆格子
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptySlots = Array.from({ length: firstDay }, (_, i) => i);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const selectedData = selectedDate ? dailyData[selectedDate] : null;
  const mealTypeLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心' };
  const mealTypeIcons: Record<string, string> = { breakfast: 'egg_alt', lunch: 'lunch_dining', dinner: 'dinner_dining', snack: 'cookie' };
  const mealTypeColors: Record<string, string> = { breakfast: 'bg-orange-100 text-orange-600', lunch: 'bg-blue-100 text-blue-600', dinner: 'bg-purple-100 text-purple-600', snack: 'bg-amber-100 text-amber-600' };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">FitTrack</h2>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">健康歷史日誌</h1>
            <p className="text-slate-500 text-sm">追蹤你的每一份努力</p>
          </div>
          <div className="flex items-center bg-slate-200/50 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-sm">calendar_view_month</span> 日曆模式
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-sm">format_list_bulleted</span> 列表模式
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* 月曆 */}
          <div className="xl:col-span-2">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{year}年 {month + 1}月</h3>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>

              {viewMode === 'calendar' ? (
                <>
                  <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
                    {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                      <div key={d} className="bg-white py-3 text-center text-xs font-bold text-slate-400">{d}</div>
                    ))}
                    {emptySlots.map(i => (
                      <div key={`e${i}`} className="bg-white h-20 p-2 opacity-30" />
                    ))}
                    {days.map(day => {
                      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const status = getStatus(ds);
                      const isSelected = ds === selectedDate;
                      const isToday = ds === today;
                      const data = dailyData[ds];
                      return (
                        <div
                          key={day}
                          onClick={() => setSelectedDate(ds)}
                          className={`bg-white h-20 p-2 flex flex-col justify-between cursor-pointer hover:bg-primary/5 transition-colors ${
                            isSelected ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''
                          } ${isToday && !isSelected ? 'ring-2 ring-primary/30 ring-inset' : ''}`}
                        >
                          <span className={`text-sm font-semibold ${isSelected ? 'text-primary font-bold' : ''} ${isToday ? 'text-primary' : ''}`}>{day}{isToday ? ' 今' : ''}</span>
                          <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full ${statusColors[status]} mb-1`} />
                            {data?.weight && <span className="text-[10px] text-slate-500">{data.weight}kg</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> 健康達標</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /> 接近上限 (&gt;80%)</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> 超出預算</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300" /> 無記錄</div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {days.map(day => {
                    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const data = dailyData[ds];
                    if (!data) return null;
                    const status = getStatus(ds);
                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDate(ds)}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-primary/30 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                          <div>
                            <p className="font-bold text-sm">{month + 1}月{day}日</p>
                            <p className="text-xs text-slate-400">{data.meals.length} 筆記錄</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{data.totalCal} kcal</p>
                          {data.weight && <p className="text-xs text-slate-400">{data.weight}kg</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 詳細數據面板 */}
          <div className="space-y-6">
            {selectedDate ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-20">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg">{selectedDate.replace(/-/g, '/')} 詳細數據</h3>
                  </div>
                </div>
                {/* 卡路里摘要 */}
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-semibold">今日熱量摘要</span>
                    <span className={`text-sm font-bold ${(selectedData?.totalCal || 0) > budget ? 'text-red-500' : 'text-emerald-500'}`}>
                      {(selectedData?.totalCal || 0).toLocaleString()} / {budget.toLocaleString()} kcal
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${(selectedData?.totalCal || 0) > budget ? 'bg-red-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(((selectedData?.totalCal || 0) / budget) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 飲食記錄 */}
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">restaurant</span> 飲食記錄
                  </h4>
                  {selectedData?.meals.length ? (
                    <div className="space-y-3">
                      {selectedData.meals.map((meal, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mealTypeColors[meal.meal_type] || 'bg-slate-100 text-slate-600'}`}>
                              <span className="material-symbols-outlined text-xl">{mealTypeIcons[meal.meal_type] || 'restaurant'}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{mealTypeLabels[meal.meal_type]}: {meal.items.map(i => i.name).join('、')}</p>
                              <p className="text-[10px] text-slate-400">{meal.timestamp?.slice(11, 16) || ''}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium">{meal.total_calories} kcal</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">當日無飲食記錄</p>
                  )}
                </div>

                {/* 身體數值 */}
                {selectedData?.weight && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">straighten</span> 身體數值
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-500 mb-1">體重</p>
                        <p className="text-base font-bold">{selectedData.weight} kg</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 block">touch_app</span>
                <p>點擊日期查看詳細數據</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
