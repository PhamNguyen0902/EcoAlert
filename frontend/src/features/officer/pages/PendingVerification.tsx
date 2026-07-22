import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Check, X, AlertTriangle } from 'lucide-react';
import { useAlerts, useUpdateAlertStatus } from '@/hooks/hooks';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import toast from 'react-hot-toast';
import { AlertStatus, Alert } from '@/types';

export default function PendingVerification() {
  const { data, isLoading } = useAlerts(1, 100);
  const updateStatus = useUpdateAlertStatus();

  const pendingAlerts = data?.items?.filter((a: Alert) => a.status === 'pending' || a.status === 'ai_analyzing') || [];

  const handleAction = (id: string, status: AlertStatus) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast.success(`Report ${status === 'verified' ? 'accepted' : 'rejected'} successfully`),
      onError: () => toast.error('Failed to update report')
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  if (isLoading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pending Verification</h2>
          <p className="text-muted-foreground">Review and verify new citizen reports.</p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {pendingAlerts.length} Pending
        </Badge>
      </div>

      {pendingAlerts.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="All caught up!" description="There are no pending reports to verify at this time." />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pendingAlerts.map((alert: Alert) => (
            <motion.div key={alert._id} variants={item}>
              <Card className="overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
                <div className="h-48 bg-muted relative">
                  {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
                    <img src={alert.mediaUrls[0]} alt={alert.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No Image Provided
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Badge variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'}>
                      {alert.severity}
                    </Badge>
                    <Badge className="bg-background text-foreground hover:bg-background">{alert.category}</Badge>
                  </div>
                </div>
                <CardContent className="p-5 flex-1 space-y-3">
                  <h3 className="font-semibold text-lg line-clamp-1">{alert.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{alert.description}</p>
                  
                  {alert.aiConfidence && (
                    <div className="bg-primary/5 rounded-lg p-3 mt-4 border border-primary/10">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
                        <AlertTriangle className="w-4 h-4" /> AI Analysis
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Confidence: {(alert.aiConfidence * 100).toFixed(0)}%</span>
                        <span className="capitalize">{alert.category}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-5 pt-0 grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full" onClick={() => handleAction(alert._id, 'rejected')}>
                    <X className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button className="w-full" onClick={() => handleAction(alert._id, 'verified')}>
                    <Check className="w-4 h-4 mr-2" /> Accept
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
