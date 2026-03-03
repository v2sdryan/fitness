// Mifflin-St Jeor 公式計算 BMR
export function calculateBMR(weight_kg: number, height_cm: number, age: number, gender: 'male' | 'female'): number {
  if (gender === 'male') {
    return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5);
  }
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161);
}

// 根據活動量計算 TDEE
export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    heavy: 1.725,
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.375));
}

// 計算減肥每日預算（TDEE - 500）
export function calculateDailyBudget(weight_kg: number, height_cm: number, age: number, gender: 'male' | 'female', activityLevel: string): number {
  const bmr = calculateBMR(weight_kg, height_cm, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  return Math.max(1200, tdee - 500); // 最低不低於 1200 kcal
}

// 計算營養素目標（基於每日預算）
export function calculateMacroTargets(dailyBudget: number) {
  return {
    protein_g: Math.round(dailyBudget * 0.275 / 4),   // 27.5% 蛋白質
    fat_g: Math.round(dailyBudget * 0.25 / 9),        // 25% 脂肪
    carbs_g: Math.round(dailyBudget * 0.45 / 4),      // 45% 碳水
    fiber_g: 25,
    sodium_mg: 2300,
  };
}

// 格式化日期
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 取得今天日期字串
export function getToday(): string {
  return formatDate(new Date());
}
