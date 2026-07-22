import { useState } from 'react';
import { useAlerts, useDeleteAlert } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Search, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ReportManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data, isLoading } = useAlerts(page, 10);
  const deleteAlert = useDeleteAlert();

  if (isLoading) return <LoadingSpinner />;

  const filteredAlerts = data?.alerts?.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Report Management</h2>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Environmental Reports</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search reports..."
              className="w-[300px] pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Severity</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map(alert => (
                  <tr key={alert._id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 font-medium">{alert.title}</td>
                    <td className="p-4 capitalize">{alert.category}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={
                        alert.severity === 'high' ? 'border-red-500 text-red-500' :
                        alert.severity === 'medium' ? 'border-orange-500 text-orange-500' :
                        'border-blue-500 text-blue-500'
                      }>
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="p-4 capitalize">{alert.status}</td>
                    <td className="p-4 text-muted-foreground">{format(new Date(alert.createdAt), 'MMM d, yyyy')}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link to={`/admin/reports/${alert._id}`}>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500"
                          onClick={() => {
                            if(confirm('Delete report?')) {
                              deleteAlert.mutate(alert._id);
                              toast.success('Report deleted');
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
