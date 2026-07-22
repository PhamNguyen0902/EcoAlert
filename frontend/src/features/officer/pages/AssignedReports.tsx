import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { MoreHorizontal, Search, FileText } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import toast from 'react-hot-toast';
import { AlertStatus, Alert } from '@/types';

export default function AssignedReports() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const { data, isLoading } = useAlerts(page, 10);
  const updateStatus = useUpdateAlertStatus();
  
  const handleStatusUpdate = (id: string, status: AlertStatus) => {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => toast.success('Status updated successfully'),
      onError: () => toast.error('Failed to update status')
    });
  };

  const filteredAlerts = data?.items?.filter((a: Alert) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? a.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Assigned Reports</h2>
        <p className="text-muted-foreground">Manage and process your assigned environmental reports.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CardTitle>Reports List</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
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
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner className="mx-auto my-12" />
          ) : filteredAlerts.length === 0 ? (
            <EmptyState icon={FileText} title="No reports found" description="Try adjusting your search or filters." />
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Severity</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Created</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredAlerts.map((alert: Alert) => (
                    <tr key={alert._id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle font-medium">{alert.title}</td>
                      <td className="p-4 align-middle capitalize">{alert.category.replace('_', ' ')}</td>
                      <td className="p-4 align-middle">
                        <Badge variant={alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default'}>
                          {alert.severity}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle">
                        <Badge variant="outline">{alert.status}</Badge>
                      </td>
                      <td className="p-4 align-middle">
                        {format(new Date(alert.createdAt || Date.now()), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/officer/reports/${alert._id}`}>View</Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'in_progress')}>
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(alert._id, 'resolved')}>
                                Mark Resolved
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
