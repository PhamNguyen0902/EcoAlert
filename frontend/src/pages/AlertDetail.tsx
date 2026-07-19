import { useParams, useNavigate } from 'react-router-dom';
import { useAlert, useUpdateAlertStatus } from '../hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Clock, MapPin, Tag, CheckCircle, ShieldAlert } from 'lucide-react';
import L from 'leaflet';
import toast from 'react-hot-toast';

// Fix leaflet icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: alert, isLoading } = useAlert(id || '');
  const updateStatusMutation = useUpdateAlertStatus();
  
  const role = JSON.parse(localStorage.getItem('user') || '{}')?.role;
  const isOfficerOrAdmin = role === 'OFFICER' || role === 'ADMIN';

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  if (!alert) {
    return <div className="text-center p-12 text-muted-foreground">Report not found.</div>;
  }

  const handleUpdateStatus = (status: string) => {
    updateStatusMutation.mutate(
      { id: alert._id, status },
      {
        onSuccess: () => toast.success(`Status updated to ${status}`),
        onError: () => toast.error('Failed to update status')
      }
    );
  };

  const position: [number, number] = [
    alert.location?.coordinates[1] || 10.8231, // lat
    alert.location?.coordinates[0] || 106.6297  // lng
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight flex-1 truncate">{alert.title}</h2>
        <div className="flex gap-2 hidden sm:flex">
          <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'HIGH' ? 'warning' : 'default'} className="text-sm px-3 py-1">
            {alert.severity || 'UNKNOWN SEVERITY'}
          </Badge>
          <Badge variant={['RESOLVED', 'CLOSED'].includes(alert.status) ? 'success' : 'outline'} className="text-sm px-3 py-1">
            {alert.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Description
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{alert.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Reported On
                    </h3>
                    <p className="text-sm font-medium">{format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Address
                    </h3>
                    <p className="text-sm font-medium">{alert.address}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Evidence & Media</CardTitle>
            </CardHeader>
            <CardContent>
              {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {alert.mediaUrls.map((url: string, i: number) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border bg-muted group relative">
                      <img src={url} alt={`Evidence ${i+1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="secondary" size="sm">View</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-muted/30 rounded-xl border border-dashed">
                  <p className="text-muted-foreground">No media attached to this report.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" /> AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Detected Category</div>
                  <div className="font-semibold text-lg">{alert.category || 'Pending Analysis'}</div>
                </div>
                
                {alert.aiConfidence && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Confidence Score</span>
                      <span className="font-medium">{Math.round(alert.aiConfidence * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${alert.aiConfidence > 0.8 ? 'bg-green-500' : alert.aiConfidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                        style={{ width: `${alert.aiConfidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[250px] w-full rounded-b-xl overflow-hidden relative z-0">
                <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={position} />
                </MapContainer>
              </div>
            </CardContent>
          </Card>

          {isOfficerOrAdmin && alert.status !== 'CLOSED' && (
            <Card className="border-primary/50 shadow-sm">
              <CardHeader className="pb-3 bg-primary/5 border-b">
                <CardTitle className="text-primary flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" /> Officer Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {alert.status === 'PENDING' && (
                  <Button 
                    className="w-full" 
                    onClick={() => handleUpdateStatus('VERIFIED')}
                    disabled={updateStatusMutation.isPending}
                  >
                    Verify & Accept Report
                  </Button>
                )}
                
                {['VERIFIED', 'ASSIGNED'].includes(alert.status) && (
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={() => handleUpdateStatus('IN_PROGRESS')}
                    disabled={updateStatusMutation.isPending}
                  >
                    Mark In Progress
                  </Button>
                )}

                {alert.status === 'IN_PROGRESS' && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Resolved
                  </Button>
                )}
                
                {['PENDING', 'VERIFIED'].includes(alert.status) && (
                  <Button 
                    variant="destructive" 
                    className="w-full" 
                    onClick={() => handleUpdateStatus('REJECTED')}
                    disabled={updateStatusMutation.isPending}
                  >
                    Reject Report (Invalid/Spam)
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Add FileText import
import { FileText } from 'lucide-react';
