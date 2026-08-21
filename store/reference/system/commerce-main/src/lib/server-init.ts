import { initializeApp } from '@/lib/initialize';
import { ensureRfmWorker, scheduleNightlyRfm } from '@/modules/analytics/rfm/services/rfmJobService';

// Initialize the application on server startup
// This is imported by the app/layout.tsx file

let initialized = false;

export async function runServerInitialization() {
  if (initialized) return;
  
  // Allow explicitly skipping initialization (useful during docker build/static export)
  if (process.env.SKIP_SERVER_INIT === 'true') {
    console.log('🔧 Application initialization skipped because SKIP_SERVER_INIT=true');
    initialized = true;
    return;
  }

  // Only run in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.RUN_SEEDERS === 'true') {
    await initializeApp();
  } else {
    console.log('🔧 Application initialization skipped in development. Set RUN_SEEDERS=true to force run.');
  }

  // Schedule nightly RFM recompute when enabled
  if (process.env.RFM_SCHEDULE_ENABLED === 'true') {
    try {
      ensureRfmWorker();
      await scheduleNightlyRfm();
      console.log('⏰ تم تفعيل الجدولة الليلية لـ RFM');
    } catch (err) {
      console.error('⚠️ تعذر تفعيل الجدولة الليلية لـ RFM:', err);
    }
  }
  
  initialized = true;
}