"use server";

import {
  getUnreadNotifications,
  getAllNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/notification-service";

export async function getUnreadNotificationsAction() {
  try {
    const data = await getUnreadNotifications();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Error al cargar notificaciones" };
  }
}

export async function getAllNotificationsAction() {
  try {
    const data = await getAllNotifications();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Error al cargar notificaciones" };
  }
}

export async function getUnreadCountAction() {
  try {
    const count = await getUnreadCount();
    return { success: true, count };
  } catch (error) {
    return { success: false, count: 0 };
  }
}

export async function markNotificationReadAction(id: string) {
  try {
    await markNotificationRead(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al marcar notificación" };
  }
}

export async function markAllNotificationsReadAction() {
  try {
    await markAllNotificationsRead();
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al marcar notificaciones" };
  }
}
