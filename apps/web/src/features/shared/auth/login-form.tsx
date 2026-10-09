import { Button } from '@/components/ui/button';
import { getGoogleClientId, getGithubClientId } from '@/lib/env';
import { t } from '@/lib/i18n/id';

import { authClient } from './client';

export function LoginForm() {
  const googleId = getGoogleClientId();
  const githubId = getGithubClientId();

  const isBothDisabled = !googleId && !githubId;
  const handleSocialLogin = (provider: 'google' | 'github') => {
    // Fire-and-forget: sign-in navigates away on success; surface
    // failures via a follow-up (login error UI is tracked separately).
    void authClient.signIn.social({
      provider,
      callbackURL: '/',
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-6 shadow-sm">
        {/* Banner jika login dinonaktifkan (kedua client ID kosong) */}
        {isBothDisabled && (
          <div className="rounded bg-yellow-100 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            {t('login', 'disabledBanner')}
          </div>
        )}

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t('login', 'title')}</h1>
          <p className="text-sm text-gray-500">{t('login', 'hint')}</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Tombol Google */}
          <Button
            onClick={() => handleSocialLogin('google')}
            disabled={!googleId}
            title={
              !googleId
                ? t('login', 'providerDisabled').replace('{provider}', 'Google')
                : undefined
            }
            className="w-full"
          >
            {t('login', 'google')}
          </Button>

          {/* Tombol GitHub */}
          <Button
            onClick={() => handleSocialLogin('github')}
            disabled={!githubId}
            title={
              !githubId
                ? t('login', 'providerDisabled').replace('{provider}', 'GitHub')
                : undefined
            }
            className="w-full"
          >
            {t('login', 'github')}
          </Button>
        </div>
      </div>
    </div>
  );
}
