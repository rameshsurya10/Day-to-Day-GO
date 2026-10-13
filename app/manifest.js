/* Web app manifest (served at /manifest.webmanifest) — makes the app
   installable to the home screen and launch full-screen like a native app. */

export default function manifest() {
  return {
    name: 'Day to Day',
    short_name: 'Day to Day',
    description: 'Routine, meals, money and reminders — one day at a time.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#e6f6f1',
    theme_color: '#e6f6f1',
    categories: ['health', 'productivity', 'finance'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add spending', url: '/#money/spend', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Ask Buddy', url: '/#buddy', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: "Today's meals", url: '/#meals', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
