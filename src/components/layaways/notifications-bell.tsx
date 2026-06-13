"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getUnreadNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getUnreadCountAction,
} from "@/app/actions/notification-actions";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: Date | string;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-yellow-500",
  danger: "text-red-500",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  mora: AlertTriangle,
  riesgo_rojo: TrendingUp,
  cuota_por_vencer: Clock,
};

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(async () => {
    const res = await getUnreadCountAction();
    if (res.success) setUnreadCount(res.count);
  }, []);

  const loadNotifications = useCallback(async () => {
    const res = await getUnreadNotificationsAction();
    if (res.success && res.data) {
      setNotifications(res.data as Notification[]);
      setUnreadCount(res.data.length);
    }
  }, []);

  // Poll count every 60s
  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [loadCount]);

  // Load on open
  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <button
            className="h-9 w-9 rounded-lg grid place-items-center text-[color:var(--tf-fg-muted)] hover:bg-muted hover:text-foreground transition-colors duration-150"
            aria-label="Notificaciones"
          >
            <Bell className="h-[17px] w-[17px]" />
          </button>
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full border-2 border-card flex items-center justify-center text-white"
              style={{ background: "var(--tf-red, #ef4444)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Sin notificaciones pendientes
          </div>
        ) : (
          <div className="space-y-0.5">
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              const colorClass = SEVERITY_STYLES[n.severity] ?? "text-muted-foreground";
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-2 px-3 py-2.5 rounded hover:bg-muted/50 group"
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity mt-0.5"
                    aria-label="Marcar como leída"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
