import { useParams, Link } from 'react-router-dom';
import { useAlert, useUpdateAlertStatus } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertStatus } from '@/types';
import { MapPin, Calendar, Clock, Image as ImageIcon, ChevronLeft, CheckCircle2, XCircle, PlayCircle, CheckSquare, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function OfficerReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: alert, isLoading } = useAlert(id || '');
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateAlertStatus();

  if (isLoading) {
    return <div className="p-8 text-center">Loading report details...</div>;
  }

  if (!alert) {
    return <div className="p-8 text-center text-red-500">Report not found</div>;
  }

  const handleStatusChange = (newStatus: AlertStatus) => {
    if (!id) return;
    updateStatus(
      { id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Status updated to ${newStatus}`);
        },
        onError: () => {
          toast.error('Failed to update status');
        }
      }
    );
  };

  const renderActionPanel = () => {
    switch (alert.status) {
      case 'pending':
      case 'ai_analyzing':
        return (
          <div className="flex flex-col gap-3">
            <Button onClick={() => handleStatusChange('verified')} disabled={isUpdating} className="w-full bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Verify & Accept
            </Button>
            <Button onClick={() => handleStatusChange('rejected')} disabled={isUpdating} variant="destructive" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Reject Report
            </Button>
          </div>
        );
      case 'verified':
      case 'assigned':
        return (
          <Button onClick={() => handleStatusChange('in_progress')} disabled={isUpdating} className="w-full bg-blue-600 hover:bg-blue-700">
            <PlayCircle className="mr-2 h-4 w-4" /> Mark In Progress
          </Button>
        );
      case 'in_progress':
        return (
          <Button onClick={() => handleStatusChange('resolved')} disabled={isUpdating} className="w-full bg-emerald-600 hover:bg-emerald-700">
            <CheckSquare className="mr-2 h-4 w-4" /> Mark Resolved
          </Button>
        );
      case 'resolved':
      case 'rejected':
        return (
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">This report is closed.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/officer/reports">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Reports
          </Button>
        </Link>
        <div className="flex gap-2">
          <Badge variant="outline" className="uppercase text-xs">{alert.severity}</Badge>
          <Badge className="uppercase text-xs">{alert.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{alert.title}</CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {format(new Date(alert.createdAt), 'PP')}</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {format(new Date(alert.createdAt), 'p')}</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {alert.address}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{alert.description}</p>

              {alert.mediaUrls && alert.mediaUrls.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Attached Media</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {alert.mediaUrls.map((url, i) => (
                      <div key={i} className="aspect-video relative rounded-lg overflow-hidden bg-muted">
                        <img src={url} alt={`Evidence ${i+1}`} className="object-cover w-full h-full" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {alert.aiConfidence !== undefined && alert.aiConfidence !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" /> AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Confidence Score</span>
                    <span className="text-sm font-medium">{Math.round((alert.aiConfidence || 0) * 100)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${Math.round((alert.aiConfidence || 0) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase">Category</p>
                    <p className="font-medium capitalize">{alert.category || 'Unknown'}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase">Suggested Priority</p>
                    <p className="font-medium capitalize">{alert.aiSuggestedPriority || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Officer Action</CardTitle>
              <CardDescription>Update the status of this incident</CardDescription>
            </CardHeader>
            <CardContent>
              {renderActionPanel()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center px-4">
                  Map View<br/>
                  [{alert.location.coordinates[1]}, {alert.location.coordinates[0]}]
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
