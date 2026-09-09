import * as z from 'zod';

export const auditActionSchema = z.enum([
  'post.moderate',
  'post.withdraw',
  'post.retry',
  'comment.hide',
  'photo_item.replace',
  'photo_item.revert',
  'exhibition.phase_change',
  'feature_flag.toggle',
  'site_settings.update',
  'user.role_change',
]);
