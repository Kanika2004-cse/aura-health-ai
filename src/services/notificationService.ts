import { LocalNotifications } from '@capacitor/local-notifications';

export async function sendSmartHealthAlert(supabase: any, userId: string, title: string, recommendation: string, severity: string = 'high') {
  try {
    // 1. Save to Supabase so it appears in the In-App Notification Center
    if (supabase && userId) {
      await supabase.from('health_alerts').insert({
        user_id: userId,
        title: title,
        message: recommendation,
        severity: severity,
      });
    }

    // 2. Check and request push permissions
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') return;
    }

    // 3. Trigger native mobile popup notification
    await LocalNotifications.schedule({
      notifications: [
        {
          title: title,
          body: `${recommendation} Tap to view recommendations.`,
          id: new Date().getTime() % 100000,
          schedule: { at: new Date(Date.now() + 500) },
          sound: 'default',
        },
      ],
    });
  } catch (err) {
    console.error('Notification error:', err);
  }
}