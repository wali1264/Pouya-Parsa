
import { createClient } from '@supabase/supabase-js';

// این مقادیر مستقیماً بر اساس اطلاعات ارسالی شما تنظیم شده است
const supabaseUrl = 'https://tipbwntomwxgemwuyqev.supabase.co';
const supabaseAnonKey = 'sb_publishable_LPu2e6fkWOstikUFBB_ubg_C9Ltiyqi';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
