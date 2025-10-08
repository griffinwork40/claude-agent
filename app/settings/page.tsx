// app/settings/page.tsx
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';

// Force dynamic rendering to avoid static generation issues with Supabase
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login?redirect=/settings');

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-gray-600 mt-2">This is a placeholder settings page.</p>
    </div>
  );
}


