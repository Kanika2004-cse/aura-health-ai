import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { Card } from './ui/Card';

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchAlerts() {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('health_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setAlerts(data);
      }
      setLoading(false);
    }

    void fetchAlerts();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col h-full shadow-2xl text-snow">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="font-display text-xl">Notification History</h2>
          <button onClick={onClose} className="text-haze hover:text-snow text-lg font-bold p-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-haze py-8">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-center text-sm text-haze py-8">No alerts or warnings recorded yet.</p>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className="p-4 bg-slate-800/50 border border-slate-700/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{alert.title}</span>
                  <span className="text-[10px] text-haze">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-haze">{alert.message}</p>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}