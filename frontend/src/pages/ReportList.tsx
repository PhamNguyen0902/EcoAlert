import { useState } from 'react';
import { useAlerts, useUpdateAlertStatus } from '../hooks/hooks';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Search, Eye, Filter, Trash2, Edit2, MoreVertical, CheckCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export default function ReportList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  // In a real app we'd debounce search, but for MVP this is fine
  const { data: alertsData, isLoading } = useAlerts(page, 10, search ? { title: search } : {});
  const updateStatusMutation = useUpdateAlertStatus();

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  const alerts = alertsData?.items || [];
  const total = alertsData?.total || 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Report Management</h2>
          <p className="text-muted-foreground mt-1">View, search, and manage all environmental reports.</p>
        </div>
        <Button asChild><Link to="/report">Create Report</Link></Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports by title..."
                className="pl-9 bg-muted/50 w-full sm:max-w-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-500">ID / Title</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Date</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Category</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Severity</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {alerts.map((alert: any) => (
                  <tr key={alert._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{alert.title}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{alert._id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(alert.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {alert.category || 'Unclassified'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'HIGH' ? 'warning' : 'default'}>
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={['RESOLVED', 'CLOSED'].includes(alert.status) ? 'success' : 'outline'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild title="View Details">
                          <Link to={`/alerts/${alert._id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/alerts/${alert._id}`} className="cursor-pointer flex items-center">
                                <Eye className="mr-2 h-4 w-4" /> View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="cursor-pointer flex items-center">
                              <Edit2 className="mr-2 h-4 w-4" /> Edit (Coming soon)
                            </DropdownMenuItem>
                            {alert.status !== 'CLOSED' && (
                              <DropdownMenuItem 
                                className="cursor-pointer flex items-center text-green-600 focus:text-green-600"
                                onClick={() => updateStatusMutation.mutate({ id: alert._id, status: 'CLOSED' })}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Closed
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="cursor-pointer flex items-center text-red-600 focus:text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No reports found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, total)} of {total} entries
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
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

// Ensure CheckCircle is imported correctly in the above code if not already. Wait, let me just add it.
