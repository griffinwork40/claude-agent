// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = getServerSupabase();
  
  if (!supabase) {
    // If Supabase is not available, redirect to login
    redirect('/login?redirect=/dashboard');
  }
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/dashboard');

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600 mt-2">This is a placeholder dashboard page.</p>
    </div>
  );
}


