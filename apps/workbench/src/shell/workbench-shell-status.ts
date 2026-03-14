import type { I18nService } from '../i18n/i18n-service';
import type { NotificationSnapshot } from './notification-center';
import type { StatusBarItemRegistration, StatusContent } from './workbench-shell-contract';

export function createNotificationStatusItem(
  i18n: I18nService,
  snapshot: NotificationSnapshot
): StatusBarItemRegistration {
  const count = snapshot.unseenCount;
  const text: StatusContent = count
    ? i18n.translate(count === 1 ? 'status.notifications.count.one' : 'status.notifications.count.other', {
        fallback: count === 1 ? '{count} Notification' : '{count} Notifications',
        args: { count }
      })
    : i18n.translate('status.notifications.none', {
        fallback: '0 Notifications'
      });

  return {
    id: 'status.notifications',
    alignment: 'right',
    text,
    commandId: 'nexus.notifications.show',
    priority: 10,
    tooltip: i18n.translate(
      count ? 'status.notifications.tooltip.pending' : 'status.notifications.tooltip.none',
      {
        fallback: count ? 'View pending notifications' : 'All caught up'
      }
    ),
    ariaLabel: i18n.translate(
      count ? 'status.notifications.aria.pending' : 'status.notifications.aria.none',
      {
        fallback: count ? '{count} pending notifications' : 'No pending notifications',
        args: { count }
      }
    )
  };
}
