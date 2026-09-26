import { useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getGoogleClientId, getGithubClientId } from '@/lib/env';
import { t } from '@/lib/i18n/id';

interface AuthWallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthWall({ open, onOpenChange }: AuthWallProps) {
  const googleId = getGoogleClientId();
  const githubId = getGithubClientId();

  const navigate = useNavigate();
  const isLoginEnabled = Boolean(googleId || githubId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('authWall', 'title')}</DialogTitle>
          <DialogDescription>{t('authWall', 'message')}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 pt-4 sm:flex-row">
          {isLoginEnabled ? (
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                void navigate({ to: '/login' });
              }}
            >
              {t('authWall', 'login')}
            </Button>
          ) : (
            <div className="w-full rounded bg-yellow-100 p-3 text-center text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
              {t('login', 'disabledBanner')}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
