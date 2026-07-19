import { useState } from 'react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../hooks/hooks';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Bell, CheckCircle2, Circle, Clock, MailOpen, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationCenter() {
  const [page, setPage] = useState(1);
  const { data: notificationsData, isLoading } = useNotifications(page, 20);
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const notifications = notificationsData?.items || [];
  const total = notificationsData?.total || 0;
  const totalPages = Math.ceil(total / 20);
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const handleMarkAsRead = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAsReadMutation.mutate(id);
    }
  };

  const getIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('status') || t.includes('resolved') || t.includes('verified')) return <ShieldCheck className="h-5 w-5 text-green-500" />;
    if (t.includes('new alert') || t.includes('critical') || t.includes('high')) return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return <Bell className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground mt-1">Stay updated on your reports and system alerts.</p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="flex items-center gap-2"
          >
            <MailOpen className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {notifications.map((notification: any) => (
              <div 
                key={notification._id} 
                className={`p-6 flex gap-4 transition-colors hover:bg-muted/30 cursor-pointer ${!notification.isRead ? 'bg-primary/5' : ''}`}
                onClick={() => {
                  handleMarkAsRead(notification._id, notification.isRead);
                  // Optional: navigate based on notification content if it contains an alert ID.
                  // For now, just mark read.
                }}
              >
                <div className="mt-1 shrink-0">
                  {getIcon(notification.title)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-semibold ${!notification.isRead ? 'text-foreground' : 'text-slate-700'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-sm ${!notification.isRead ? 'text-slate-700' : 'text-muted-foreground'}`}>
                    {notification.message}
                  </p>
                </div>

                <div className="shrink-0 flex items-center justify-center w-6">
                  {!notification.isRead ? (
                    <Circle className="h-3 w-3 fill-primary text-primary" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No notifications yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  When there are updates to your reports or system alerts, they will appear here.
                </p>
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
