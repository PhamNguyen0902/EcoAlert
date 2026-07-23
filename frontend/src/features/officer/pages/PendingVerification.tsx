import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Check, X, AlertTriangle, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useAlerts, useUpdateAlertStatus } from '@/hooks/hooks';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import toast from 'react-hot-toast';
import { AlertStatus, Alert } from '@/types';

// Confirm Dialog Component
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
      >
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </div>
  );
}

// Quick View Modal
function QuickViewModal({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  if (!alert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-background border rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
          <div className="h-56 bg-muted relative flex-shrink-0">
            <img src={alert.mediaUrls[0]} alt={alert.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-white text-xl font-bold line-clamp-1">{alert.title}</h2>
            </div>
          </div>
        ) : (
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">{alert.title}</h2>
          </div>
        )}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'}>{alert.severity}</Badge>
            <Badge variant="outline">{alert.category}</Badge>
            <Badge variant="secondary">{alert.status}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
            <p className="text-sm whitespace-pre-wrap">{alert.description}</p>
          </div>
          {alert.address && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Address</p>
              <p className="text-sm">{alert.address}</p>
            </div>
          )}
          {alert.aiConfidence && (
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <div className="flex items-center gap-2 text-sm font-medium text-primary mb-1">
                <AlertTriangle className="w-4 h-4" /> AI Analysis
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Confidence: {(alert.aiConfidence * 100).toFixed(0)}%</span>
                <span className="capitalize">{alert.aiSuggestedPriority ?? alert.category}</span>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex-shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </div>
  );
}

const ITEMS_PER_PAGE = 9;

export default function PendingVerification() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; status: AlertStatus } | null>(null);
  const [quickView, setQuickView] = useState<Alert | null>(null);

  const { data, isLoading } = useAlerts(1, 200); // Fetch more, then filter client-side for search
  const updateStatus = useUpdateAlertStatus();

  const allPending = data?.items?.filter((a: Alert) =>
    a.status === 'pending' || a.status === 'ai_analyzing'
  ) || [];

  const filtered = allPending.filter((a: Alert) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleActionClick = (id: string, status: AlertStatus) => {
    setConfirm({ id, status });
  };

  const handleConfirm = () => {
    if (!confirm) return;
    updateStatus.mutate(
      { id: confirm.id, status: confirm.status },
      {
        onSuccess: () => {
          toast.success(`Report ${confirm.status === 'verified' ? 'accepted ✅' : 'rejected ❌'} successfully`);
          setConfirm(null);
        },
        onError: () => {
          toast.error('Failed to update report status');
          setConfirm(null);
        },
      }
    );
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 },
  };

  if (isLoading) return <LoadingSpinner className="mx-auto mt-20" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pending Verification</h2>
          <p className="text-muted-foreground">Review and verify new citizen reports.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-base px-3 py-1">
            {filtered.length} Pending
          </Badge>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or address..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {pageItems.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="All caught up!" description="No pending reports match your search." />
      ) : (
        <>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((alert: Alert) => (
              <motion.div key={alert._id} variants={item}>
                <Card className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow border-border/60">
                  <div className="h-48 bg-muted relative">
                    {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
                      <img src={alert.mediaUrls[0]} alt={alert.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        No Image Provided
                      </div>
                    )}
                    <div className="absolute top-2 left-2 right-2 flex justify-between">
                      <div className="flex gap-1">
                        <Badge variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'} className="text-xs">
                          {alert.severity}
                        </Badge>
                        <Badge className="bg-background/90 text-foreground hover:bg-background text-xs backdrop-blur-sm">
                          {alert.category}
                        </Badge>
                      </div>
                      <button
                        onClick={() => setQuickView(alert)}
                        className="bg-background/90 backdrop-blur-sm rounded-md p-1 hover:bg-background transition-colors"
                        title="Quick view"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="p-5 flex-1 space-y-2">
                    <h3 className="font-semibold text-base line-clamp-1">{alert.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{alert.description}</p>
                    {alert.address && (
                      <p className="text-xs text-muted-foreground line-clamp-1">📍 {alert.address}</p>
                    )}
                    {alert.aiConfidence && (
                      <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/10">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                          <AlertTriangle className="w-3 h-3" /> AI Confidence: {(alert.aiConfidence * 100).toFixed(0)}%
                        </div>
                        <div className="w-full bg-primary/10 rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(alert.aiConfidence * 100).toFixed(0)}%` }} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => handleActionClick(alert._id, 'rejected')}
                      disabled={updateStatus.isPending}
                    >
                      <X className="w-4 h-4 mr-1.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleActionClick(alert._id, 'verified')}
                      disabled={updateStatus.isPending}
                    >
                      <Check className="w-4 h-4 mr-1.5" /> Accept
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            open={!!confirm}
            title={confirm.status === 'verified' ? 'Accept Report?' : 'Reject Report?'}
            description={
              confirm.status === 'verified'
                ? 'This report will be marked as verified and moved to the assigned queue.'
                : 'This report will be rejected. This action cannot be undone easily.'
            }
            confirmLabel={confirm.status === 'verified' ? 'Yes, Accept' : 'Yes, Reject'}
            confirmVariant={confirm.status === 'verified' ? 'default' : 'destructive'}
            onConfirm={handleConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickView && <QuickViewModal alert={quickView} onClose={() => setQuickView(null)} />}
      </AnimatePresence>
    </div>
  );
}
