/* =================================================================
   planTemplate.js — the neutral starter plan for a fresh install.
   Generic on purpose: no personal details. Users replace it in
   Settings (edit, or import their own plan file).
   `isTemplate: true` lets the UI suggest personalising it.
   ================================================================= */

const item = (food, qty, tags = []) => ({ food, qty, tags });
const day = (breakfast, lunch, snack, dinner) => ({ breakfast, lunch, snack, dinner });

const BREAKFAST_A = [item('Oats (dry weight)', '50 g'), item('Eggs', '2', ['protein']), item('Curd / yogurt', '150 g', ['calcium', 'protein'])];
const BREAKFAST_B = [item('Idli / dosa / toast', '2–3'), item('Eggs', '2', ['protein']), item('Fruit', '1')];
const LUNCH_A = [item('Rice or rotis', '1 plate'), item('Dal / beans', '1 bowl', ['protein']), item('Vegetables', '150 g')];
const LUNCH_B = [item('Rice or rotis', '1 plate'), item('Chicken / paneer / tofu', '150 g', ['protein']), item('Vegetables', '150 g')];
const SNACK = [item('Fruit', '1'), item('Nuts or roasted chana', '30 g', ['protein'])];
const DINNER_A = [item('Rotis', '2–3'), item('Eggs / paneer', '1 portion', ['protein']), item('Vegetables', '150 g')];

export const PLAN_TEMPLATE = {
  version: 1,
  isTemplate: true,
  profile: { name: '', height: '', weight: '', diet: '', region: '' },
  program: {
    weeks: 4,
    keptPct: 67,
    defaultBudget: 1000,
    weekFocus: [
      'Build the basics: sleep on time, regular meals, show up.',
      'Keep the same pattern; notice energy and hunger.',
      'Progress gently where it feels easy.',
      'Review what worked and set next month’s plan.',
    ],
  },
  timetable: [
    { start: '06:00', end: '06:15', icon: 'sunrise',   title: 'Wake up',    note: 'Water, wash up, no phone.' },
    { start: '06:15', end: '07:15', icon: 'book',      title: 'Focus time', note: 'One important thing before the day starts.' },
    { start: '07:15', end: '08:00', icon: 'utensils',  title: 'Breakfast',  note: 'Protein and something filling.' },
    { start: '08:00', end: '09:00', icon: 'route',     title: 'Commute',    note: 'Adjust to your day.' },
    { start: '09:00', end: '17:30', icon: 'briefcase', title: 'Work',       note: 'Lunch break and short walks.' },
    { start: '17:30', end: '18:30', icon: 'dumbbell',  title: 'Exercise',   note: 'Train, walk or stretch.' },
    { start: '18:30', end: '19:30', icon: 'home',      title: 'Free time',  note: 'Family, hobbies, errands.' },
    { start: '19:30', end: '20:00', icon: 'utensils',  title: 'Dinner',     note: 'Balanced plate.' },
    { start: '20:00', end: '22:00', icon: 'moon',      title: 'Wind down',  note: 'Prep for tomorrow, screens down.' },
    { start: '22:00', end: '06:00', icon: 'bed',       title: 'Sleep',      note: 'Aim for 7–8 hours.' },
  ],
  sunday: {
    plan: [
      'Sleep in a little, but within an hour of your usual time.',
      'Rest, family and something you enjoy.',
      'Prep food and clothes for Monday.',
      'Review the week and plan the next one.',
    ],
    food: 'Relaxed home-cooked meals. Prep a few things for Monday.',
  },
  checks: {
    weekday: [
      { id: 'sleep',    icon: 'bed',       label: 'Sleep',    hint: 'On time last night' },
      { id: 'study',    icon: 'book',      label: 'Focus',    hint: 'Morning focus block done' },
      { id: 'food',     icon: 'utensils',  label: 'Food',     hint: 'Regular, balanced meals' },
      { id: 'work',     icon: 'briefcase', label: 'Work',     hint: 'Showed up and took breaks' },
      { id: 'training', icon: 'dumbbell',  label: 'Exercise', hint: 'Session or active recovery' },
      { id: 'recovery', icon: 'droplet',   label: 'Recovery', hint: 'Water, movement, prep' },
    ],
    sunday: [
      { id: 'sleep',    icon: 'bed',      label: 'Sleep',  hint: 'Rested well' },
      { id: 'food',     icon: 'utensils', label: 'Food',   hint: 'Regular meals' },
      { id: 'family',   icon: 'home',     label: 'People', hint: 'Time with family or friends' },
      { id: 'prep',     icon: 'box',      label: 'Prep',   hint: 'Ready for Monday' },
      { id: 'review',   icon: 'chart',    label: 'Review', hint: 'Looked back at the week' },
      { id: 'recovery', icon: 'droplet',  label: 'Rest',   hint: 'Took it easy' },
    ],
  },
  meals: {
    slots: [
      { id: 'breakfast', label: 'Breakfast', at: '07:15' },
      { id: 'lunch',     label: 'Lunch',     at: '13:00' },
      { id: 'snack',     label: 'Snack',     at: '16:30' },
      { id: 'dinner',    label: 'Dinner',    at: '19:30' },
    ],
    days: {
      1: day(BREAKFAST_A, LUNCH_A, SNACK, DINNER_A),
      2: day(BREAKFAST_B, LUNCH_B, SNACK, DINNER_A),
      3: day(BREAKFAST_A, LUNCH_A, SNACK, DINNER_A),
      4: day(BREAKFAST_B, LUNCH_B, SNACK, DINNER_A),
      5: day(BREAKFAST_A, LUNCH_A, SNACK, DINNER_A),
      6: day(BREAKFAST_B, LUNCH_B, SNACK, DINNER_A),
    },
    quantityGuide: ['Adjust portions to your hunger and activity.'],
    hungerRule: 'Still hungry? Add more vegetables, dal or a roti.',
    restDayRule: 'On rest days keep regular meals.',
  },
  calcium: {
    title: 'Calcium',
    target: 'About 1,000 mg a day for most adults aged 19–50 — check what applies to you.',
    items: [
      { title: 'Curd / yogurt', amount: 'Daily', body: 'Calcium and protein.' },
      { title: 'Leafy greens', amount: 'Most days', body: 'Minerals and fibre.' },
    ],
    note: 'Food tables are estimates. Ask a clinician before taking supplements.',
  },
  shopping: {
    note: 'Add your own items and local prices.',
    items: [],
    tips: ['Buy seasonal vegetables and cook at home.'],
  },
  health: {
    priorities: [
      { title: 'Sleep', body: 'The foundation for everything else.' },
      { title: 'Move daily', body: 'Any movement counts.' },
      { title: 'Eat regularly', body: 'Avoid long gaps and constant hunger.' },
    ],
    cards: [
      { icon: 'heart', title: 'Listen to your body', body: 'Progress gradually and rest when needed.' },
    ],
    warning: 'Ongoing pain, swelling or restricted movement needs a professional assessment.',
  },
  reminders: {
    routine: [
      { id: 'focus', at: '06:15', days: 'weekdays', icon: 'book', title: 'Focus time', body: 'One important thing first.' },
      { id: 'bed',   at: '21:45', days: 'all',      icon: 'bed',  title: 'Bedtime soon', body: 'Wind down for a good night’s sleep.' },
    ],
    checklistAt: '20:00',
    spendAt: '21:00',
    weeklyLogAt: '18:00',
    dueSoonDays: 3,
  },
};
