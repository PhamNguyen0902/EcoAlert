import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { MoreHorizontal, Search, FileText, RefreshCw, MapPin } from 'lucide-react';
import { useAlerts, useUpdateAlertStatus } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import toast from 'react-hot-toast';
import { AlertStatus, Alert } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'verified', label: 'Verified' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ai_analyzing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  verified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  assigned: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const PAGE_LIMIT = 10;

export default function AssignedReports() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Build filters for server-side filtering
  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;

  const { data, isLoading, refetch, isFetching } = useAlerts(page, PAGE_LIMIT, filters);
  const updateStatus = useUpdateAlertStatus();

  const alerts: Alert[] = data?.items || [];
  const total: number = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  // Client-side search on title (for quick UX without extra server call)
  const filtered = search
    ? alerts.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : alerts;

  const handleStatusUpdate = (id: string, status: AlertStatus) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast.success(`Status updated to "${status}" ✅`),
      onError: () => toast.error('Failed to update status'),
    });
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assigned Reports</h2>
          <p className="text-muted-foreground">Manage and process environmental reports.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            Reports
            <Badge variant="secondary">{total}</Badge>
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search titles..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner className="mx-auto my-16" />
          ) : filtered.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={FileText} title="No reports found" description="Try adjusting your search or filters." />
            </div>
          ) : (
            <>
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden md:table-cell">Category</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Severity</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden lg:table-cell">Address</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground hidden sm:table-cell">Created</th>
                      <th className="h-11 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((alert: Alert) => (
                      <tr
                        key={alert._id}
                        className={`border-b last:border-0 transition-colors hover:bg-muted/40 ${
                          ['closed', 'rejected'].includes(alert.status?.toLowerCase?.() ?? alert.status)
                            ? 'opacity-50 grayscale-[30%]'
                            : ''
                        }`}
                      >
                        <td className="p-4 align-middle">
                          <div className="font-medium line-clamp-1 max-w-[200px]">{alert.title}</div>
                        </td>
                        <td className="p-4 align-middle uppercase text-xs hidden md:table-cell">
                          {alert.category.replace(/_/g, ' ')}
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${SEVERITY_BADGE[alert.severity?.toLowerCase()] || SEVERITY_BADGE[alert.severity] || ''}`}>
                            {alert.severity?.toUpperCase?.() ?? alert.severity}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_BADGE[alert.status?.toLowerCase()] || STATUS_BADGE[alert.status] || ''}`}>
                            {alert.status?.replace(/_/g, ' ')?.toUpperCase?.() ?? alert.status}
                          </span>
                        </td>
                        <td className="p-4 align-middle hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[160px] truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {alert.address || '—'}
                          </div>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground text-xs hidden sm:table-cell">
                          {format(new Date(alert.createdAt || Date.now()), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                              <Link to={`/officer/reports/${alert._id}`}>View</Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {alert.status === 'verified' && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'assigned')}>
                                    Mark Assigned
                                  </DropdownMenuItem>
                                )}
                                {(alert.status === 'verified' || alert.status === 'assigned') && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'in_progress')}>
                                    Mark In Progress
                                  </DropdownMenuItem>
                                )}
                                {alert.status === 'in_progress' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'resolved')}>
                                      Mark Resolved
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'assigned')}>
                                      Revert to Assigned
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {alert.status === 'resolved' && (
                                  <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'closed')}>
                                    Close Report
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{(page - 1) * PAGE_LIMIT + 1}</span>–
                  <span className="font-medium">{Math.min(page * PAGE_LIMIT, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> reports
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
