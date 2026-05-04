const NOTIFICATION_EVENT = "room-rent-notifications-updated";
const TENANT_REQUESTS_KEY = "tenant_request_notifications";

export type TenantRequestStatus = "Pending" | "Accepted" | "Rejected";

export type TenantRequestNotification = {
  id: string;
  connectionId: string;
  tenantName: string;
  listingTitle: string;
  status: TenantRequestStatus;
  requestedAt: string;
};

type NotificationWindow = Window & {
  dispatchEvent: (event: Event) => boolean;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitNotificationsChanged() {
  if (typeof window === "undefined") return;
  (window as NotificationWindow).dispatchEvent(new CustomEvent(NOTIFICATION_EVENT));
}

export function getTenantRequestNotifications(): TenantRequestNotification[] {
  if (!canUseStorage()) return [];

  try {
    const raw = localStorage.getItem(TENANT_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function syncTenantRequestNotifications(items: TenantRequestNotification[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(TENANT_REQUESTS_KEY, JSON.stringify(items));
  emitNotificationsChanged();
}

export function updateTenantRequestStatus(connectionId: string, status: TenantRequestStatus) {
  const current = getTenantRequestNotifications();
  const next = current.filter((item) => item.connectionId !== connectionId || status === "Pending");
  syncTenantRequestNotifications(next);
}

export function subscribeToNotificationUpdates(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handler = () => callback();
  window.addEventListener(NOTIFICATION_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(NOTIFICATION_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
