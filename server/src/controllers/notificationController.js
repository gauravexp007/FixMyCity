import { notifications } from '../data/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, unread } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const [items, total, unreadCount] = await Promise.all([
    notifications.listForUser(req.user._id, {
      page: pageNum,
      limit: limitNum,
      unread: unread === 'true',
    }),
    notifications.countForUser(req.user._id),
    notifications.countForUser(req.user._id, { unreadOnly: true }),
  ]);
  res.json({
    notifications: items,
    unreadCount,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
  });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notifications.markRead(req.params.id, req.user._id);
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  res.json({ notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await notifications.markAllRead(req.user._id);
  res.json({ message: 'All notifications marked as read' });
});
