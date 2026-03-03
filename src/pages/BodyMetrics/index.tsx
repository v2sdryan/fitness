import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getBodyMetricsRange, saveBodyMetrics, getLatestBodyMetrics } from '../../services/firestore';
import { analyzeBodyMetrics } from '../../services/ai';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { BodyMetrics, AIProvider } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  CartesianGrid, Legend, ReferenceLine
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function BodyMetricsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BodyMetrics[]>([]);
  const [latest, setLatest] = useState<BodyMetrics | null>(null);
  const [range, setRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiSettings] = useLocalStorage<{ provider: AIProvider; apiKey: string }>('fittrack_ai', {
    provider: 'gemini', apiKey: ''
  });

  useEffect(() => {
    if (!user) return;
    const startDate = getStartDate(range);
    getBodyMetricsRange(user.uid, startDate).then(setMetrics).catch(() => {});
    getLatestBodyMetrics(user.uid).then(setLatest).catch(() => {});
  }, [user, range]);

  function getStartDate(r: TimeRange): string | undefined {
    if (r === 'all') return undefined;
    const d = new Date();
    d.setDate(d.getDate() - (r === '7d' ? 7 : r === '30d' ? 30 : 90));
    return d.toISOString().split('T')[0];
  }

  const handleUpload = async (file: File) => {
    if (!aiSettings.apiKey) { setError('請先在設定頁面填入 AI API Key'); return; }
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const result = await analyzeBodyMetrics(aiSettings.provider, aiSettings.apiKey, file);
      await saveBodyMetrics(user.uid, result);
      setLatest(result);
      const startDate = getStartDate(range);
      const updated = await getBodyMetricsRange(user.uid, startDate);
      setMetrics(updated);
    } catch (err: any) {
      setError(err.message || '分析失敗');
    } finally {
      setLoading(false);
    }
  };

  const weightChange = metrics.length >= 2
    ? (metrics[metrics.length - 1].weight_kg - metrics[metrics.length - 2].weight_kg).toFixed(1)
    : null;

  // 雷達圖數據
  const radarData = latest ? [
    { subject: '脂肪', value: Math.max(0, 100 - latest.body_fat_pct * 2.5) },
    { subject: '肌肉', value: latest.muscle_pct },
    { subject: '水分', value: latest.body_water_pct },
    { subject: '蛋白質', value: latest.protein_pct * 5 },
    { subject: '骨量', value: latest.bone_mass_kg * 20 },
  ] : [];

  const statusBadge = (value: number, low: number, high: number) => {
    if (value < low) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">偏低</span>;
    if (value > high) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">偏高</span>;
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">標準</span>;
  };

  return (
    <div>
      <header className="sticky top-0 z-40 bg-background-light/80 backdrop-blur-md border-b border-primary/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl">monitoring</span>
          <h1 className="text-xl font-bold tracking-tight">身體數據趨勢</h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* 時間篩選 */}
        <div className="py-4">
          <div className="flex bg-primary/5 p-1 rounded-xl">
            {([['7d', '7天'], ['30d', '30天'], ['90d', '90天'], ['all', '全部']] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${range === k ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 上傳區域 */}
        <div className="mb-6">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <div
            onClick={() => !loading && fileRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 p-8 flex flex-col items-center text-center cursor-pointer hover:border-primary transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">photo_camera</span>
            </div>
            <h3 className="text-lg font-bold mb-1">{loading ? '分析中...' : '上傳體重秤截圖'}</h3>
            <p className="text-sm text-slate-500">AI 將自動識別並紀錄數據</p>
            <button className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-semibold text-sm">
              {loading ? '處理中...' : '點擊上傳'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* 最新測量數據 */}
        {latest && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5 mb-6">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">上次測量：{latest.date} {latest.time}</p>
                <h2 className="text-3xl font-bold">{latest.weight_kg} <span className="text-lg font-normal">kg</span></h2>
              </div>
              {weightChange && (
                <span className={`inline-flex items-center gap-1 font-bold text-sm ${Number(weightChange) <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-sm">{Number(weightChange) <= 0 ? 'trending_down' : 'trending_up'}</span>
                  {weightChange}kg
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard icon="opacity" color="text-blue-500" label="BMI" value={latest.bmi.toString()} badge={statusBadge(latest.bmi, 18.5, 24)} />
              <MetricCard icon="percent" color="text-orange-500" label="體脂率" value={`${latest.body_fat_pct}%`} badge={statusBadge(latest.body_fat_pct, 10, 25)} />
              <MetricCard icon="fitness_center" color="text-red-500" label="肌肉量" value={`${latest.muscle_pct}%`} badge={statusBadge(latest.muscle_pct, 60, 100)} />
              <MetricCard icon="water_drop" color="text-indigo-500" label="水分率" value={`${latest.body_water_pct}%`} badge={statusBadge(latest.body_water_pct, 50, 65)} />
              <MetricCard icon="local_fire_department" color="text-amber-500" label="內臟脂肪" value={latest.visceral_fat_index.toString()} badge={statusBadge(latest.visceral_fat_index, 0, 9)} />
              <MetricCard icon="bolt" color="text-purple-500" label="基礎代謝" value={latest.bmr_kcal.toString()} badge={statusBadge(latest.bmr_kcal, 1200, 2500)} />
            </div>
          </div>
        )}

        {/* 圖表區域 */}
        {metrics.length > 0 && (
          <div className="space-y-6">
            {/* 體重趨勢 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">體重趨勢</h3>
                <span className="text-xs text-slate-400">目標: 65.0kg</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine y={65} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '目標', fontSize: 10 }} />
                  <Line type="monotone" dataKey="weight_kg" stroke="#5343e5" strokeWidth={2} dot={{ r: 3 }} name="體重(kg)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 體脂 vs 肌肉 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
              <h3 className="font-bold mb-4">體脂 vs 肌肉</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="muscle_pct" stroke="#5343e5" strokeWidth={2} name="肌肉%" dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="body_fat_pct" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" name="體脂%" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* BMI 指數變化 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
              <h3 className="font-bold mb-4">BMI 指數變化</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis domain={[15, 35]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine y={24} stroke="#f59e0b" strokeDasharray="3 3" />
                  <ReferenceLine y={18.5} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={27} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="bmi" stroke="#5343e5" strokeWidth={2} dot={{ r: 4 }} name="BMI" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 雷達圖 */}
            {latest && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
                <h3 className="font-bold mb-4">體適能五維雷達圖</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                    <Radar dataKey="value" stroke="#5343e5" fill="#5343e5" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 內臟脂肪歷史 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5">
              <h3 className="font-bold mb-4">內臟脂肪歷史</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={metrics.slice(-6)}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="visceral_fat_index" fill="#5343e5" radius={[4, 4, 0, 0]} name="內臟脂肪" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {metrics.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-4 block">monitoring</span>
            <p>尚無數據，請上傳體重秤截圖開始追蹤</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, color, label, value, badge }: {
  icon: string; color: string; label: string; value: string; badge: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-slate-50">
      <span className={`material-symbols-outlined ${color} mb-1`}>{icon}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="font-bold">{value}</span>
      <div className="mt-1">{badge}</div>
    </div>
  );
}
