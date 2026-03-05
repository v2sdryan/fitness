import { useState, useEffect } from 'react';

/** 取得今日日期字串 (YYYY-MM-DD)，每日 00:00 自動更新 */
export function useToday(): string {
  const [today, setToday] = useState(() => formatDate(new Date()));

  useEffect(() => {
    // 計算距離下一個午夜的毫秒數
    const scheduleNextUpdate = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      return setTimeout(() => {
        setToday(formatDate(new Date()));
        // 遞迴設定下一天的 timer
        timerRef = scheduleNextUpdate();
      }, msUntilMidnight);
    };

    let timerRef = scheduleNextUpdate();

    // 頁面從背景恢復時也檢查日期是否已變
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const current = formatDate(new Date());
        setToday(prev => prev !== current ? current : prev);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(timerRef);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return today;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
