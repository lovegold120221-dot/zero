import { useState, useRef, useCallback } from 'react';
import { SplashPage } from './SplashPage';
import { OnboardingPage } from './OnboardingPage';

// ─── Entry flow: Splash → Onboarding (shows for ALL users) ────────────
export function EntryFlow({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'splash' | 'onboarding' | 'done'>('splash');
  const splashStart = useRef(Date.now());

  // After splash page finishes (user tapped or 3s auto), transition
  const handleSplashDone = useCallback(() => {
    const elapsed = Date.now() - splashStart.current;
    // Ensure at least 1.5s of splash even for returning users
    const remaining = Math.max(0, 1500 - elapsed);
    setTimeout(() => {
      try {
        if (localStorage.getItem('beatrice_has_seen_onboarding')) {
          // Returning user — skip onboarding, go straight to app/auth
          onComplete();
        } else {
          setPhase('onboarding');
        }
      } catch {
        onComplete();
      }
    }, remaining);
  }, [onComplete]);

  if (phase === 'splash') {
    return <SplashPage onComplete={handleSplashDone} />;
  }

  if (phase === 'onboarding') {
    return (
      <OnboardingPage onComplete={() => {
        try { localStorage.setItem('beatrice_has_seen_onboarding', 'true'); } catch {}
        onComplete();
      }} />
    );
  }

  return null;
}

// ─── Helper: check if the user has Google linked as an auth provider ──
export function isGoogleLinked(user: { providerData: { providerId: string }[] }): boolean {
  return user.providerData.some(p => p.providerId === 'google.com');
}
