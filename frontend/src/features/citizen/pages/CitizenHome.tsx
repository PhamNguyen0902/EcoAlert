import { useState, useMemo } from 'react';
import { useAlerts } from '@/hooks/hooks';
import { useGeolocation } from '../hooks/useGeolocation';
import { HeroSection } from '../components/HeroSection';
import { IncidentMap } from '../components/IncidentMap';
import { StatsSection } from '../components/StatsSection';
import { CategoryFilter } from '../components/CategoryFilter';
import { NearbyIncidents } from '../components/NearbyIncidents';
import { WeatherWidget } from '../components/WeatherWidget';
import { NewsSection } from '../components/NewsSection';
import type { Alert } from '@/types';

export default function CitizenHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: alertsData } = useAlerts(1, 1000);
  const { latitude, longitude } = useGeolocation();

  const alerts: Alert[] = useMemo(() => alertsData?.items || [], [alertsData]);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <section className="py-12">
        <StatsSection alerts={alerts} />
      </section>

      <section className="py-8" id="map-section">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Live Incident Map
          </h2>
          <p className="text-muted-foreground mt-1">
            Real-time environmental incidents across your area
          </p>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <IncidentMap
                alerts={alerts}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
            <div className="space-y-6">
              <WeatherWidget latitude={latitude} longitude={longitude} />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Filter by Category
          </h2>
          <p className="text-muted-foreground mt-1">
            Click a category to filter incidents on the map
          </p>
        </div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          alerts={alerts}
        />
      </section>

      <section className="py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Nearby Incidents
          </h2>
          <p className="text-muted-foreground mt-1">
            Recent environmental reports in your area
          </p>
        </div>
        <NearbyIncidents alerts={alerts} />
      </section>

      <section className="py-12">
        <NewsSection />
      </section>
    </div>
  );
}
