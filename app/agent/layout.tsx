// app/agent/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/agent');
  return <>{children}</>;
}


