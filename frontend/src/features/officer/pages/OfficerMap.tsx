import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Link } from 'react-router-dom';
import { useAlerts } from '@/hooks/hooks';
import { Alert } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

const createCustomIcon = (severity: string) => {
  const colorClass = getSeverityColor(severity);
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-4 h-4 rounded-full ${colorClass} border-2 border-white shadow-md"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
};

export default function OfficerMap() {
  const { data, isLoading } = useAlerts(1, 1000);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((alert: Alert) => {
      const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity = filterSeverity ? alert.severity === filterSeverity : true;
      return matchesSearch && matchesSeverity;
    });
  }, [data, searchTerm, filterSeverity]);

  if (isLoading) {
    return <div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-4 overflow-y-auto pr-2">
        <h2 className="text-2xl font-bold tracking-tight">Incident Map</h2>
        
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterSeverity === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSeverity(null)}
          >
            All
          </Button>
          {['critical', 'high', 'medium', 'low'].map((sev) => (
            <Button
              key={sev}
              variant={filterSeverity === sev ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterSeverity(sev)}
              className="capitalize"
            >
              {sev}
            </Button>
          ))}
        </div>

        <div className="text-sm text-muted-foreground mt-4">
          Showing {filteredAlerts.length} alerts on the map.
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border shadow-sm relative z-0">
        <MapContainer
          center={[10.762622, 106.660172]} // Default center (HCMC)
          zoom={12}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={40}
          >
            {filteredAlerts.map((alert: Alert) => (
              <Marker
                key={alert._id}
                position={[alert.location.coordinates[1], alert.location.coordinates[0]]}
                icon={createCustomIcon(alert.severity)}
              >
                <Popup className="rounded-lg">
                  <div className="p-1 max-w-xs">
                    <h3 className="font-semibold text-sm mb-1 line-clamp-1">{alert.title}</h3>
                    <div className="flex gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {alert.severity}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1 line-clamp-2">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      {alert.address}
                    </p>
                    <Link to={`/officer/reports/${alert._id}`}>
                      <Button size="sm" className="w-full text-xs h-7">View Details</Button>
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
