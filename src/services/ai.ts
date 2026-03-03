import type { AISettings, BodyMetrics, MealEntry } from '../types';

// AI 服務：優先用 Gemini，失敗自動 fallback 到 OpenRouter

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// 將圖片檔案轉為 base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 呼叫 Gemini API
async function callGemini(apiKey: string, prompt: string, imageBase64?: string, mimeType?: string) {
  const parts: any[] = [{ text: prompt }];
  if (imageBase64 && mimeType) {
    parts.unshift({ inline_data: { mime_type: mimeType, data: imageBase64 } });
  }
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API 錯誤');
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

// 呼叫 OpenRouter API
async function callOpenRouter(apiKey: string, prompt: string, imageBase64?: string, mimeType?: string) {
  const content: any[] = [];
  if (imageBase64 && mimeType) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } });
  }
  content.push({ type: 'text', text: prompt });

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.5',
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenRouter API 錯誤');
  return data.choices?.[0]?.message?.content || '';
}

// 帶自動 fallback 的 AI 呼叫：先 Gemini → 失敗則 OpenRouter
async function callWithFallback(
  settings: AISettings,
  prompt: string,
  imageBase64?: string,
  mimeType?: string
): Promise<{ text: string; usedProvider: 'gemini' | 'openrouter' }> {
  // 先嘗試 Gemini
  if (settings.geminiKey) {
    try {
      const text = await callGemini(settings.geminiKey, prompt, imageBase64, mimeType);
      return { text, usedProvider: 'gemini' };
    } catch (geminiErr: any) {
      console.warn('Gemini 失敗，嘗試 fallback 到 OpenRouter:', geminiErr.message);
      // 如果有 OpenRouter key，繼續 fallback
      if (settings.openrouterKey) {
        const text = await callOpenRouter(settings.openrouterKey, prompt, imageBase64, mimeType);
        return { text, usedProvider: 'openrouter' };
      }
      throw new Error(`Gemini 失敗: ${geminiErr.message}`);
    }
  }

  // 沒有 Gemini key，直接用 OpenRouter
  if (settings.openrouterKey) {
    const text = await callOpenRouter(settings.openrouterKey, prompt, imageBase64, mimeType);
    return { text, usedProvider: 'openrouter' };
  }

  throw new Error('請先在設定頁面填入至少一組 AI API Key');
}

// 從 AI 回應中提取 JSON
function extractJSON(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = match ? match[1].trim() : text.trim();
  return JSON.parse(jsonStr);
}

// 分析體重秤截圖 → 提取身體數據
export async function analyzeBodyMetrics(
  settings: AISettings, imageFile: File
): Promise<{ data: BodyMetrics; usedProvider: string }> {
  const base64 = await fileToBase64(imageFile);
  const prompt = `你是健康數據分析專家。請分析這張體重秤/體脂磅截圖，提取所有可見的健康指數。
請以嚴格 JSON 格式回傳（不要其他文字），欄位如下：
{
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "weight_kg": 數字,
  "body_fat_pct": 數字,
  "muscle_pct": 數字,
  "visceral_fat_index": 數字,
  "bmr_kcal": 數字,
  "body_water_pct": 數字,
  "skeletal_muscle_pct": 數字,
  "protein_pct": 數字,
  "bone_mass_kg": 數字,
  "bmi": 數字,
  "metabolic_age": 數字,
  "body_type": "字串",
  "score": 數字
}
如果某項數據無法從圖片中讀取，請用合理的估算值填入。日期如果無法確定就用今天的日期。`;

  const { text, usedProvider } = await callWithFallback(settings, prompt, base64, imageFile.type);
  return { data: extractJSON(text) as BodyMetrics, usedProvider };
}

// 分析食物照片 → 估算卡路里與營養素
export async function analyzeFoodImage(
  settings: AISettings, imageFile: File, mealType: string
): Promise<{ data: MealEntry; usedProvider: string }> {
  const base64 = await fileToBase64(imageFile);
  const prompt = `你是營養分析專家。請分析這張食物照片，辨識食物並估算卡路里與營養素。
請以嚴格 JSON 格式回傳：
{
  "meal_type": "${mealType}",
  "items": [
    { "name": "食物名", "calories": 數字, "protein_g": 數字, "fat_g": 數字, "carbs_g": 數字, "fiber_g": 數字, "sodium_mg": 數字 }
  ],
  "total_calories": 數字,
  "total_protein_g": 數字,
  "total_fat_g": 數字,
  "total_carbs_g": 數字
}`;

  const { text, usedProvider } = await callWithFallback(settings, prompt, base64, imageFile.type);
  return { data: extractJSON(text) as MealEntry, usedProvider };
}

// 分析文字描述的食物 → 估算卡路里
export async function analyzeFoodText(
  settings: AISettings, description: string, mealType: string
): Promise<{ data: MealEntry; usedProvider: string }> {
  const prompt = `你是營養分析專家。用戶描述了他們吃的食物：「${description}」
餐別：${mealType}
請估算每項食物的卡路里與營養素，以嚴格 JSON 格式回傳：
{
  "meal_type": "${mealType}",
  "items": [
    { "name": "食物名", "calories": 數字, "protein_g": 數字, "fat_g": 數字, "carbs_g": 數字, "fiber_g": 數字, "sodium_mg": 數字 }
  ],
  "total_calories": 數字,
  "total_protein_g": 數字,
  "total_fat_g": 數字,
  "total_carbs_g": 數字
}`;

  const { text, usedProvider } = await callWithFallback(settings, prompt);
  return { data: extractJSON(text) as MealEntry, usedProvider };
}
