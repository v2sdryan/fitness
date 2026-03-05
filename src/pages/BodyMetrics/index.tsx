import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getBodyMetricsRange, saveBodyMetrics, getLatestBodyMetrics, getBodyMetricsByDate, deleteBodyMetrics } from '../../services/firestore';
import { analyzeBodyMetrics } from '../../services/ai';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { BodyMetrics, AISettings } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  CartesianGrid, Legend, ReferenceLine
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d' | 'all';

// 用於預覽的資料欄位定義
const METRIC_FIELDS: { key: keyof BodyMetrics; label: string; unit: string }[] = [
  { key: 'date', label: '日期', unit: '' },
  { key: 'time', label: '時間', unit: '' },
  { key: 'weight_kg', label: '體重', unit: 'kg' },
  { key: 'body_fat_pct', label: '體脂率', unit: '%' },
  { key: 'muscle_pct', label: '肌肉率', unit: '%' },
  { key: 'visceral_fat_index', label: '內臟脂肪指數', unit: '' },
  { key: 'bmr_kcal', label: '基礎代謝', unit: 'kcal' },
  { key: 'body_water_pct', label: '體水分', unit: '%' },
  { key: 'skeletal_muscle_pct', label: '骨骼肌率', unit: '%' },
  { key: 'protein_pct', label: '蛋白質', unit: '%' },
  { key: 'bone_mass_kg', label: '骨量', unit: 'kg' },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'metabolic_age', label: '代謝年齡', unit: '歲' },
  { key: 'body_type', label: '體型', unit: '' },
  { key: 'score', label: '評分', unit: '' },
];

export default function BodyMetricsPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<BodyMetrics[]>([]);
  const [latest, setLatest] = useState<BodyMetrics | null>(null);
  const [range, setRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiSettings] = useLocalStorage<AISettings>('fittrack_ai', {
    geminiKey: '', openrouterKey: ''
  });

  // 預覽狀態
  const [preview, setPreview] = useState<BodyMetrics | null>(null);
  const [excludedFields, setExcludedFields] = useState<Set<keyof BodyMetrics>>(new Set());
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState('');

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

  // 檢查是否為重複數據
  const checkDuplicate = async (data: BodyMetrics): Promise<{ isDup: boolean; info: string }> => {
    if (!user) return { isDup: false, info: '' };
    try {
      const existing = await getBodyMetricsByDate(user.uid, data.date);
      if (existing) {
        // 同日同時間 → 完全重複
        if (existing.time === data.time && existing.weight_kg === data.weight_kg) {
          return { isDup: true, info: `已存在 ${data.date} ${data.time} 的完全相同記錄（體重 ${existing.weight_kg}kg），將不會重複輸入` };
        }
        // 同日但不同時間/數據 → 提示已有數據，讓用戶決定
        return { isDup: false, info: `${data.date} 已有記錄（${existing.time}, ${existing.weight_kg}kg），儲存將覆蓋舊數據` };
      }
    } catch { /* no existing data */ }
    return { isDup: false, info: '' };
  };

  const handleUpload = async (file: File) => {
    if (!aiSettings.geminiKey && !aiSettings.openrouterKey) { setError('請先在設定頁面填入至少一組 AI API Key'); return; }
    if (!user) return;
    setLoading(true);
    setError('');
    setPreview(null);
    setExcludedFields(new Set());
    setIsDuplicate(false);
    setDuplicateInfo('');
    try {
      const { data: result } = await analyzeBodyMetrics(aiSettings, file);

      // 檢查重複
      const { isDup, info } = await checkDuplicate(result);
      setIsDuplicate(isDup);
      setDuplicateInfo(info);

      // 無論是否重複都先顯示預覽
      setPreview(result);
    } catch (err: any) {
      setError(err.message || '分析失敗');
    } finally {
      setLoading(false);
    }
  };

  // 確認儲存
  const handleConfirmSave = async () => {
    if (!user || !preview) return;
    setLoading(true);
    try {
      // 將排除的欄位設為 0 或空字串
      const dataToSave = { ...preview };
      excludedFields.forEach(key => {
        if (key === 'date' || key === 'time' || key === 'body_type') {
          // 日期和時間不能排除
        } else {
          (dataToSave as any)[key] = 0;
        }
      });
      await saveBodyMetrics(user.uid, dataToSave);
      setLatest(dataToSave);
      const startDate = getStartDate(range);
      const updated = await getBodyMetricsRange(user.uid, startDate);
      setMetrics(updated);
      setPreview(null);
      setExcludedFields(new Set());
      setDuplicateInfo('');
      setIsDuplicate(false);
    } catch (err: any) {
      setError('儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  // 取消預覽
  const handleCancelPreview = () => {
    setPreview(null);
    setExcludedFields(new Set());
    setDuplicateInfo('');
    setIsDuplicate(false);
    // 重設 file input
    if (fileRef.current) fileRef.current.value = '';
  };

  // 切換排除欄位
  const toggleExclude = (key: keyof BodyMetrics) => {
    // 日期和時間是必須的，不能排除
    if (key === 'date' || key === 'time') return;
    setExcludedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 刪除已儲存的歷史記錄
  const handleDeleteMetrics = async (date: string) => {
    if (!user) return;
    try {
      await deleteBodyMetrics(user.uid, date);
      setMetrics(prev => prev.filter(m => m.date !== date));
      if (latest?.date === date) {
        const remaining = metrics.filter(m => m.date !== date);
        setLatest(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      }
    } catch {
      setError('刪除失敗');
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
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { e.target.files?.[0] && handleUpload(e.target.files[0]); }} />
          <div
            onClick={() => !loading && !preview && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center text-center transition-colors ${
              preview ? 'border-slate-200 bg-slate-50 cursor-default' : 'border-primary/30 bg-primary/5 cursor-pointer hover:border-primary'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <span className="material-symbols-outlined text-3xl">photo_camera</span>
            </div>
            <h3 className="text-lg font-bold mb-1">{loading ? '分析中...' : preview ? '已分析完成' : '上傳體重秤截圖'}</h3>
            <p className="text-sm text-slate-500">{preview ? '請確認以下數據後儲存' : 'AI 將自動識別並紀錄數據'}</p>
            {!preview && (
              <button className="mt-4 px-6 py-2 bg-primary text-white rounded-full font-semibold text-sm">
                {loading ? '處理中...' : '點擊上傳'}
              </button>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* 預覽面板：AI 分析結果 + 刪除按鈕 */}
        {preview && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-primary/10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                AI 分析結果
              </h3>
              <button onClick={handleCancelPreview} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* 重複提示 */}
            {duplicateInfo && (
              <div className={`p-3 rounded-xl mb-4 text-sm flex items-start gap-2 ${
                isDuplicate ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                  {isDuplicate ? 'error' : 'warning'}
                </span>
                {duplicateInfo}
              </div>
            )}

            {/* 數據列表 */}
            <div className="space-y-2 mb-6">
              {METRIC_FIELDS.map(({ key, label, unit }) => {
                const value = preview[key];
                const isExcluded = excludedFields.has(key);
                const isRequired = key === 'date' || key === 'time';
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      isExcluded ? 'bg-slate-100 opacity-50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-600 min-w-[100px]">{label}</span>
                      <span className={`font-bold ${isExcluded ? 'line-through text-slate-400' : ''}`}>
                        {value}{unit && ` ${unit}`}
                      </span>
                    </div>
                    {!isRequired && (
                      <button
                        onClick={() => toggleExclude(key)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          isExcluded
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isExcluded ? 'undo' : 'delete'}
                        </span>
                        {isExcluded ? '恢復' : '排除'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelPreview}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              {!isDuplicate && (
                <button
                  onClick={handleConfirmSave}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? '儲存中...' : '確認儲存'}
                </button>
              )}
            </div>
          </div>
        )}

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

        {/* 歷史記錄列表（帶刪除） */}
        {metrics.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-primary/5 mb-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              歷史記錄
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {[...metrics].reverse().map(m => (
                <div key={m.date} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-sm">{m.date}</p>
                      <p className="text-xs text-slate-400">{m.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{m.weight_kg} kg</p>
                      <p className="text-xs text-slate-400">BMI {m.bmi} / 體脂 {m.body_fat_pct}%</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMetrics(m.date)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="刪除此記錄"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
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
