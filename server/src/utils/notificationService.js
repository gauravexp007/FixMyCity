import { notifications } from '../data/index.js';

let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export async function createNotification({ user, type, title, message, complaint, metadata = {} }) {
  if (!user) return null;
  const notification = await notifications.create({ user, type, title, message, complaint, metadata });
  if (ioInstance) {
    ioInstance.to(`user:${user.toString()}`).emit('notification:new', notification);
  }
  return notification;
}

export async function notifyUsers(users, payload) {
  const ids = [...new Set(users.filter(Boolean).map((u) => u.toString()))];
  await Promise.all(ids.map((user) => createNotification({ ...payload, user })));
}
