import { NotFoundException } from '@nestjs/common';
import { NotificationKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('Notifications tenant isolation', () => {
  it('filters notification lists and counts by company and user', async () => {
    const prisma: any = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    const service = new NotificationsService(prisma, {} as any);

    await service.list('company-b', 'admin', true);
    await service.unreadCount('company-b', 'admin');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: 'company-b', userId: 'admin', readAt: null },
    }));
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { companyId: 'company-b', userId: 'admin', readAt: null },
    });
  });

  it('cannot mark a notification from another company as read', async () => {
    const prisma: any = {
      notification: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new NotificationsService(prisma, {} as any);

    await expect(service.markRead('company-b', 'admin', 'notification-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-a', companyId: 'company-b', userId: 'admin' },
      data: { readAt: expect.any(Date) },
    });
  });

  it('scopes web push delivery to the notification company', async () => {
    const notification = { id: 'notification-b' };
    const prisma: any = {
      notification: { create: vi.fn().mockResolvedValue(notification) },
    };
    const push: any = { sendToUser: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationsService(prisma, push);

    await service.create('company-b', 'admin', NotificationKind.MESSAGE, 'Nova mensagem');

    expect(push.sendToUser).toHaveBeenCalledWith(
      'company-b',
      'admin',
      expect.objectContaining({ title: 'Nova mensagem', tag: NotificationKind.MESSAGE }),
    );
  });
});
