import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Bell, CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function OfficerNotifications() {
  const { data, isLoading } = useNotifications(1, 50);
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead();

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert_assigned': return <ShieldAlert className="h-5 w-5 text-blue-500" />;
      case 'alert_escalated': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'system': return <Info className="h-5 w-5 text-gray-500" />;
      default: return <Bell className="h-5 w-5 text-primary" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            You have {unreadCount} unread messages
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => markAllAsRead()}
          disabled={unreadCount === 0 || isMarkingAll}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You're all caught up! New alerts assigned to you will appear here."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification: any) => (
            <Card 
              key={notification._id}
              className={cn(
                "transition-colors hover:bg-muted/50",
                !notification.isRead && "bg-primary/5 border-primary/20"
              )}
            >
              <CardContent className="p-4 flex gap-4 sm:items-center flex-col sm:flex-row">
                <div className="flex-shrink-0 mt-1 sm:mt-0 p-2 bg-background rounded-full border">
                  {getIcon(notification.type)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm">
                      {notification.title}
                    </h4>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                </div>

                {!notification.isRead && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="shrink-0 sm:ml-4 self-start sm:self-center"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
