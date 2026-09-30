import { useState, useMemo } from 'react';
import { useAlerts } from '@/hooks/hooks';
import { HeroSection } from '../components/HeroSection';
import { IncidentMap } from '../components/IncidentMap';
import { CategoryFilter } from '../components/CategoryFilter';
import { NearbyIncidents } from '../components/NearbyIncidents';
import type { Alert } from '@/types';
// giao diện phía dưới hero section
export default function CitizenHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: alertsData } = useAlerts(1, 1000);

  const alerts: Alert[] = useMemo(() => alertsData?.items || [], [alertsData]);

  return (
    <div className="min-h-screen">
      <HeroSection />

      <section className="py-8" id="map-section">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-5">
            <h2 className="text-3xl font-bold tracking-tight">
              Bản đồ sự cố trực tiếp
            </h2>
            <p className="mt-1 text-muted-foreground">
              Các sự cố môi trường theo thời gian thực tại khu vực của bạn
            </p>
          </div>
          <IncidentMap
            alerts={alerts}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            categoryFilter={
              <>
                <h2 className="text-base font-semibold tracking-tight">Lọc theo danh mục</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Chọn danh mục để xem các sự cố tương ứng trên bản đồ.
                </p>
                <div className="mt-3">
                  <CategoryFilter
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    alerts={alerts}
                    compact
                  />
                </div>
              </>
            }
          />
        </div>
      </section>

      {/* Các sự cố lân cận */}
      <section className="py-12 bg-muted/30">
        <NearbyIncidents alerts={alerts} />
      </section>
    </div>
  );
}
