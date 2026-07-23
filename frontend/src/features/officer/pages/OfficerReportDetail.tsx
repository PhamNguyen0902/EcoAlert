import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAlert, useUpdateAlertStatus, useAddOfficerNote } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertStatus } from '@/types';
import {
  MapPin, Calendar, Clock, Image as ImageIcon,
  ChevronLeft, CheckCircle2, XCircle, PlayCircle,
  CheckSquare, AlertTriangle, StickyNote, Save, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon in Leaflet + Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function OfficerReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: alert, isLoading } = useAlert(id || '');
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateAlertStatus();
  const { mutate: addNote, isPending: isSavingNote } = useAddOfficerNote();

  const [noteText, setNoteText] = useState('');
  const [noteMode, setNoteMode] = useState<'view' | 'edit'>('view');

  // Initialise noteText from existing officer note
  const existingNote = alert?.officerNote || '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-medium">Report not found or you don't have access.</p>
        <Link to="/officer/reports">
          <Button variant="outline" className="mt-4">Back to Reports</Button>
        </Link>
      </div>
    );
  }

  const handleStatusChange = (newStatus: AlertStatus) => {
    if (!id) return;
    updateStatus(
      { id, status: newStatus },
      {
        onSuccess: () => toast.success(`Status updated to "${newStatus}" ✅`),
        onError: () => toast.error('Failed to update status'),
      }
    );
  };

  const handleSaveNote = () => {
    if (!id || !noteText.trim()) return;
    addNote(
      { id, note: noteText.trim() },
      {
        onSuccess: () => {
          toast.success('Officer note saved ✅');
          setNoteMode('view');
        },
        onError: () => toast.error('Failed to save note'),
      }
    );
  };

  const handleEditNote = () => {
    setNoteText(existingNote);
    setNoteMode('edit');
  };

  const renderActionPanel = () => {
    switch (alert.status) {
      case 'pending':
      case 'ai_analyzing':
        return (
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleStatusChange('verified')} disabled={isUpdating} className="w-full bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Verify & Accept
            </Button>
            <Button onClick={() => handleStatusChange('rejected')} disabled={isUpdating} variant="destructive" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Reject Report
            </Button>
          </div>
        );
      case 'verified':
        return (
          <Button onClick={() => handleStatusChange('assigned')} disabled={isUpdating} className="w-full bg-sky-600 hover:bg-sky-700">
            <CheckSquare className="mr-2 h-4 w-4" /> Mark as Assigned
          </Button>
        );
      case 'assigned':
        return (
          <Button onClick={() => handleStatusChange('in_progress')} disabled={isUpdating} className="w-full bg-blue-600 hover:bg-blue-700">
            <PlayCircle className="mr-2 h-4 w-4" /> Mark In Progress
          </Button>
        );
      case 'in_progress':
        return (
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleStatusChange('resolved')} disabled={isUpdating} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <CheckSquare className="mr-2 h-4 w-4" /> Mark Resolved
            </Button>
            <Button onClick={() => handleStatusChange('assigned')} disabled={isUpdating} variant="outline" className="w-full text-xs">
              Revert to Assigned
            </Button>
          </div>
        );
      case 'resolved':
        return (
          <Button onClick={() => handleStatusChange('closed')} disabled={isUpdating} variant="outline" className="w-full">
            Close Report
          </Button>
        );
      case 'closed':
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

  const [lng, lat] = alert.location?.coordinates || [0, 0];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/officer/reports">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Reports
          </Button>
        </Link>
        <div className="flex gap-2">
          <Badge variant="outline" className="uppercase text-xs font-semibold">{alert.severity}</Badge>
          <Badge className="uppercase text-xs font-semibold">{alert.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{alert.title}</CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(alert.createdAt), 'PP')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(alert.createdAt), 'p')}
                </span>
                {alert.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {alert.address}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">{alert.description}</p>

              {/* Evidence Images */}
              {alert.mediaUrls && alert.mediaUrls.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Evidence ({alert.mediaUrls.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {alert.mediaUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="aspect-video relative rounded-lg overflow-hidden bg-muted block hover:opacity-90 transition-opacity">
                        <img src={url} alt={`Evidence ${i + 1}`} className="object-cover w-full h-full" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {alert.aiConfidence !== undefined && alert.aiConfidence !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" /> AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium">Confidence Score</span>
                    <span className="text-sm font-bold">{Math.round((alert.aiConfidence || 0) * 100)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.round((alert.aiConfidence || 0) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Category</p>
                    <p className="font-medium capitalize">{alert.category || 'Unknown'}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Suggested Priority</p>
                    <p className="font-medium capitalize">{alert.aiSuggestedPriority || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Officer Note */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-amber-500" /> Officer Note
              </CardTitle>
              <CardDescription>Internal note for tracking resolution progress.</CardDescription>
            </CardHeader>
            <CardContent>
              {noteMode === 'view' ? (
                <div className="space-y-3">
                  {existingNote ? (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{existingNote}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No note added yet.</p>
                  )}
                  <Button variant="outline" size="sm" onClick={handleEditNote}>
                    {existingNote ? 'Edit Note' : 'Add Note'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                    placeholder="Add your officer note here..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    maxLength={2000}
                  />
                  <div className="flex gap-2 items-center">
                    <Button size="sm" onClick={handleSaveNote} disabled={isSavingNote || !noteText.trim()}>
                      {isSavingNote ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Note
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setNoteMode('view')}>
                      Cancel
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto">{noteText.length}/2000</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Action Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Officer Action</CardTitle>
              <CardDescription>Update the status of this incident</CardDescription>
            </CardHeader>
            <CardContent>{renderActionPanel()}</CardContent>
          </Card>

          {/* Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-xl">
              {lat && lng ? (
                <div className="h-64 w-full">
                  <MapContainer
                    center={[lat, lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lng]}>
                      <Popup>{alert.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  <MapPin className="h-4 w-4 mr-2" /> Location not available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location coords */}
          {lat && lng && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Coordinates</p>
                <p className="font-mono text-sm">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline mt-1 inline-block"
                >
                  Open in Google Maps ↗
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
