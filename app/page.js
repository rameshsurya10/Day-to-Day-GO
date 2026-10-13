import AppShell from '@/components/AppShell';

/* The home route. AppShell is a client component because it owns live
   state (clock, checklist, weekly log, coach calls). */
export default function Page() {
  return <AppShell />;
}
