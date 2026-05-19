import Console from '@/components/Console';

/* The home route. The Console is a client component because it owns
   live state (clock, task toggles, coach calls). */
export default function Page() {
  return <Console />;
}
