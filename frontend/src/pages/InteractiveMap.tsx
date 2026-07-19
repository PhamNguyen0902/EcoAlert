import { useState, useMemo } from 'react';
import { useAlerts } from '../hooks/hooks';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { Search, Filter, Layers } from 'lucide-react';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

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

// Custom icons based on severity
const getMarkerIcon = (severity: string) => {
  const color = severity === 'CRITICAL' ? 'red' : severity === 'HIGH' ? 'orange' : 'blue';
  
  // Create a custom div icon
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function InteractiveMap() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, CRITICAL, HIGH, NORMAL
  const { data: alertsData, isLoading } = useAlerts(1, 1000); // Fetch up to 1000 for map

  const defaultPosition: [number, number] = [10.8231, 106.6297]; // HCMC default

  const alerts = alertsData?.items || [];

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert: any) => {
      const matchSearch = alert.title.toLowerCase().includes(search.toLowerCase()) || 
                          alert.address?.toLowerCase().includes(search.toLowerCase());
      const matchFilter = activeFilter === 'ALL' || alert.severity === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [alerts, search, activeFilter]);

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Interactive Map</h2>
          <p className="text-muted-foreground mt-1">Geospatial view of all reported environmental incidents.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <Card className="w-full lg:w-80 flex flex-col shrink-0">
          <CardContent className="p-4 flex flex-col h-full gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                className="pl-9 bg-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filter by Severity
              </h3>
              <div className="flex flex-col gap-2">
                <Button 
                  variant={activeFilter === 'ALL' ? 'default' : 'outline'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setActiveFilter('ALL')}
                >
                  All Incidents
                  <Badge variant="secondary" className="ml-auto">{alerts.length}</Badge>
                </Button>
                <Button 
                  variant={activeFilter === 'CRITICAL' ? 'default' : 'outline'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setActiveFilter('CRITICAL')}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Critical
                  <Badge variant="secondary" className="ml-auto">
                    {alerts.filter((a: any) => a.severity === 'CRITICAL').length}
                  </Badge>
                </Button>
                <Button 
                  variant={activeFilter === 'HIGH' ? 'default' : 'outline'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setActiveFilter('HIGH')}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span> High
                  <Badge variant="secondary" className="ml-auto">
                    {alerts.filter((a: any) => a.severity === 'HIGH').length}
                  </Badge>
                </Button>
                <Button 
                  variant={activeFilter === 'NORMAL' ? 'default' : 'outline'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setActiveFilter('NORMAL')}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> Normal
                  <Badge variant="secondary" className="ml-auto">
                    {alerts.filter((a: any) => a.severity === 'NORMAL').length}
                  </Badge>
                </Button>
              </div>
            </div>

            <div className="mt-auto border-t pt-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Layers className="h-4 w-4" /> Map Layers
              </h3>
              <p className="text-xs text-muted-foreground">
                Currently displaying incident clusters using Leaflet GIS integration. 
                Radius filtering can be implemented via backend GIS service queries.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 min-h-0 overflow-hidden relative">
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 bg-white/90 backdrop-blur p-2 rounded-lg shadow-md border">
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="w-3 h-3 bg-red-500 rounded-full border border-white"></div> Critical
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="w-3 h-3 bg-orange-500 rounded-full border border-white"></div> High
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="w-3 h-3 bg-blue-500 rounded-full border border-white"></div> Normal
            </div>
          </div>
          
          <MapContainer center={defaultPosition} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer 
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <MarkerClusterGroup chunkedLoading>
              {filteredAlerts.map((alert: any) => {
                const lat = alert.location?.coordinates?.[1];
                const lng = alert.location?.coordinates?.[0];
                if (!lat || !lng) return null;
                
                return (
                  <Marker 
                    key={alert._id} 
                    position={[lat, lng]}
                    icon={getMarkerIcon(alert.severity)}
                  >
                    <Popup className="rounded-xl">
                      <div className="min-w-[200px] p-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold truncate max-w-[150px]">{alert.title}</h4>
                          <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'HIGH' ? 'warning' : 'default'} className="text-[10px] px-1.5 py-0">
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 truncate">{alert.address}</p>
                        <div className="text-xs mb-3 text-slate-600">
                          {alert.category && <span className="mr-2">📁 {alert.category}</span>}
                          <span>🕒 {format(new Date(alert.createdAt), 'MMM dd')}</span>
                        </div>
                        <Button size="sm" className="w-full h-8 text-xs" asChild>
                          <Link to={`/alerts/${alert._id}`}>
                            View Details
                          </Link>
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </Card>
      </div>
    </div>
  );
}
