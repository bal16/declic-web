import { Link, createFileRoute } from '@tanstack/react-router';

import { buttonVariants } from '@/components/ui/button';
import { t } from '@/lib/i18n/id';

export const Route = createFileRoute('/403')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-4 rounded-lg border p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('forbidden', 'title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('forbidden', 'message')}
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className={buttonVariants({ variant: 'default' }) + ' w-full'}
          >
            {t('forbidden', 'home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
