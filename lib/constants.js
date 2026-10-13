/* =================================================================
   constants.js — app mechanics only (limits, built-in categories,
   alert sections). Nothing personal lives here: the user's plan is
   data, edited in Settings and stored in the browser (see plan.js).
   ================================================================= */

export const APP_ID = 'day-to-day';
export const STORE_KEY = 'd2d.v3';
export const PLAN_VERSION = 1;
export const BACKUP_VERSION = 1;

/* ---------- plan editing limits ---------- */
export const PLAN_LIMITS = {
  maxList: 40,          // rows in any editable list
  maxMealItems: 12,     // foods per meal
  maxText: 80,          // short fields (titles, labels, quantities)
  maxBody: 400,         // longer fields (notes, descriptions)
  maxWeeks: 12,
  maxBudget: 1000000,
};

/* Meal slots are fixed ids (labels and times are editable). */
export const MEAL_SLOT_IDS = ['breakfast', 'lunch', 'snack', 'dinner'];
/* Days with a food chart: JS weekday numbers, Monday → Saturday. */
export const MEAL_DAYS = [1, 2, 3, 4, 5, 6];

export const FOOD_TAGS = { protein: 'Protein', calcium: 'Calcium' };

/* Icons a user can pick for timetable blocks, checks and reminders. */
export const ICON_CHOICES = [
  'sunrise', 'sun', 'moon', 'bed', 'book', 'utensils', 'coffee', 'briefcase', 'route',
  'dumbbell', 'droplet', 'home', 'box', 'chart', 'heart', 'users', 'wallet', 'calendar', 'clock',
];

/* ---------- spending ---------- */
/* `food: true` counts against the weekly food budget. */
export const SPEND_CATEGORIES = [
  { id: 'groceries', label: 'Groceries',    icon: 'cart',     food: true },
  { id: 'eatout',    label: 'Eating out',   icon: 'utensils', food: true },
  { id: 'snacks',    label: 'Tea & snacks', icon: 'coffee',   food: true },
  { id: 'travel',    label: 'Travel',       icon: 'route',    food: false },
  { id: 'emi',       label: 'EMI & loans',  icon: 'landmark', food: false },
  { id: 'repay',     label: 'Repayments',   icon: 'users',    food: false },
  { id: 'other',     label: 'Other',        icon: 'box',      food: false },
];
export const SPEND_LIMITS = {
  maxAmount: 100000, maxNote: 60, maxBudget: 1000000, maxEntriesPerDay: 50,
  maxCustomCats: 12, maxCatLabel: 24,
};
export const FALLBACK_CATEGORY = 'other';
export const CUSTOM_CATEGORY_ICON = 'tag';
export const AUTO_SPEND = { emi: 'emi', repay: 'repay' };

/* ---------- loans & money owed ---------- */
export const MONEY_LIMITS = {
  maxLoans: 20, maxIous: 100, maxName: 30, maxNote: 60,
  maxAmount: 10000000, maxMonths: 600,
};

/* ---------- alerts ---------- */
export const ALERT_ACTIVE_MINUTES = 60;   // a timed reminder stays visible this long
export const WEEKLY_LOG_DAY = 0;          // Sunday
export const BACKUP_REMIND_DAYS = 7;

export const ALERT_SECTIONS = [
  { id: 'money',     label: 'Money',            hint: 'EMIs, money owed, budget' },
  { id: 'routine',   label: 'Routine',          hint: 'Your timed reminders' },
  { id: 'checklist', label: 'Checklist & logs', hint: 'Evening checklist, spending, weekly log, backups' },
  { id: 'meals',     label: 'Meals',            hint: "Each meal with today's menu" },
];

/* ---------- install (PWA) pop-up ---------- */
export const INSTALL_PROMPT_DELAY_MS = 3000;   // wait after opening before showing
export const INSTALL_SNOOZE_DAYS = 7;          // "Not now" hides it this long

/* ---------- weekly review ---------- */
/* `max` bounds numbers, `maxLength` bounds text, `short` = table header. */
export const WEEKLY_FIELDS = [
  { id: 'weight', label: 'Body weight', short: 'Weight', unit: 'kg', type: 'number', max: 400 },
  { id: 'waist',  label: 'Waist',       short: 'Waist',  unit: 'cm', type: 'number', max: 300 },
  { id: 'gym',    label: 'Training',     type: 'text', maxLength: 200, placeholder: 'e.g. squat 60 kg × 8, felt strong' },
  { id: 'study',  label: 'Study output', type: 'text', maxLength: 200, placeholder: 'e.g. finished pandas basics' },
  { id: 'joints', label: 'Health notes', type: 'text', maxLength: 200, placeholder: 'e.g. sleep, energy, any aches' },
];
