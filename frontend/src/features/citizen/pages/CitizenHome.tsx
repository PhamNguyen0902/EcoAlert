import { useState, useMemo } from 'react';
import { useAlerts } from '@/hooks/hooks';
import { HeroSection } from '../components/HeroSection';
import { IncidentMap } from '../components/IncidentMap';
import { CategoryFilter } from '../components/CategoryFilter';
import { NearbyIncidents } from '../components/NearbyIncidents';
import type { Alert } from '@/types';

export default function CitizenHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: alertsData } = useAlerts(1, 1000);

  const alerts: Alert[] = useMemo(() => alertsData?.items || [], [alertsData]);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <section className="py-8" id="map-section">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Bản đồ sự cố trực tiếp
          </h2>
          <p className="text-muted-foreground mt-1">
            Các sự cố môi trường theo thời gian thực tại khu vực của bạn
          </p>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <IncidentMap
            alerts={alerts}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight">
            Lọc theo danh mục
          </h2>
          <p className="text-muted-foreground mt-1">
            Nhấn vào một danh mục để lọc các sự cố trên bản đồ
          </p>
        </div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          alerts={alerts}
        />
      </section>

      <section className="py-12 bg-muted/30">
        <NearbyIncidents alerts={alerts} />
      </section>
    </div>
  );
}
