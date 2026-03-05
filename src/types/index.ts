// 用戶個人資料
export interface UserProfile {
  name: string;
  age: number;
  height_cm: number;
  gender: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy';
  targetWeight_kg: number;
}

// 身體測量數據（來自 PICOOC 體脂磅 AI 解析）
export interface BodyMetrics {
  date: string;
  time: string;
  weight_kg: number;
  body_fat_pct: number;
  muscle_pct: number;
  visceral_fat_index: number;
  bmr_kcal: number;
  body_water_pct: number;
  skeletal_muscle_pct: number;
  protein_pct: number;
  bone_mass_kg: number;
  bmi: number;
  metabolic_age: number;
  body_type: string;
  score: number;
}

// 食物項目
export interface FoodItem {
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  sodium_mg?: number;
}

// 餐食記錄
export interface MealEntry {
  id?: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  total_fiber_g?: number;
  thumbnail?: string; // base64 縮圖
  timestamp: string;
}

// 運動項目
export interface ExerciseItem {
  id?: string;
  name: string;
  icon: string;
  frequency: number; // 每週次數
  duration_min: number;
  calories_burned: number;
  sets: number;        // 組數
  reps: number;        // 每組次數
  notes: string;       // 動作備註/提示
  completed: string[]; // 完成日期陣列
}

// 每日卡路里摘要
export interface DailySummary {
  date: string;
  totalCaloriesIn: number;
  totalCaloriesOut: number;
  budget: number;
  meals: MealEntry[];
  weight_kg?: number;
  status: 'good' | 'warning' | 'over' | 'none';
}

// 營養素目標
export interface MacroTargets {
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  sodium_mg: number;
}

// 每日飲食 AI 分析
export interface DailyDietAnalysis {
  overall_score: number;
  summary: string;
  macro_balance: string;
  micronutrients: { name: string; status: '充足' | '不足' | '過量'; note: string }[];
  recommendations: string[];
}

// AI 提供者設定
export type AIProvider = 'gemini' | 'openrouter';

// Gemini 模型選項
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-3.1-flash-lite-preview';

// AI 設定（兩組獨立 key，優先用 Gemini，失敗自動 fallback OpenRouter）
export interface AISettings {
  geminiKey: string;
  openrouterKey: string;
  geminiModel?: GeminiModel;
}
