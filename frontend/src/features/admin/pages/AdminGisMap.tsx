import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  Printer,
  Radio,
  Route as RouteIcon,
  Sparkles,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import {
  useAlerts,
  useAlert,
  useAssignOfficer,
  useOfficerAvailability,
} from "@/hooks/hooks";
import { alertService, gisService } from "@/services/services";
import {
  serviceAreas,
  assignmentReasonLabel,
  type AreaGeometry,
  type AreaOfficer,
  type ServiceArea,
} from "@/services/serviceAreas";
import { useLanguage } from "@/contexts/LanguageContext";
import { createIncidentMarkerIcon } from "@/lib/incident-map-marker";
import {
  calculateHaversineDistanceKm,
  getIncidentLatLng,
  normalizeSeverity,
} from "@/lib/map-filters";
import {
  getAlertDisplayConfidence,
  getAlertDisplaySeverity,
} from "@/lib/ai-confidence";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";
import { getApiErrorMessage } from "@/lib/api-error";
import { EcoAlertBaseMap } from "@/components/location/EcoAlertBaseMap";
import { EvidenceGallery } from "@/components/incidents/EvidenceGallery";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Alert, OfficerAvailability } from "@/types";

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]; // Trung tâm TP.HCM

type CommandFilterTab = "all" | "emergency" | "in_progress" | "patrol";

interface RouteTelemetry {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

// Kiểm tra điểm [lat, lng] có nằm trong một vòng đa giác GeoJSON ([lng, lat][]) hay không (Ray-casting)
function isPointInRing(
  lat: number,
  lng: number,
  ring: readonly number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0] ?? 0;
    const yi = ring[i]?.[1] ?? 0;
    const xj = ring[j]?.[0] ?? 0;
    const yj = ring[j]?.[1] ?? 0;

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInAreaGeometry(
  lat: number,
  lng: number,
  geometry?: AreaGeometry | null,
): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    const outerRing = geometry.coordinates[0];
    return outerRing ? isPointInRing(lat, lng, outerRing) : false;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) =>
      poly[0] ? isPointInRing(lat, lng, poly[0]) : false,
    );
  }
  return false;
}

// Chuyển đổi tọa độ GeoJSON ([lng, lat]) sang định dạng Leaflet ([lat, lng])
function toLeafletPolygons(
  geometry?: AreaGeometry | null,
): [number, number][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    const outer = geometry.coordinates[0] ?? [];
    return [outer.map(([lng, lat]) => [lat, lng] as [number, number])];
  }
  return geometry.coordinates.map((poly) =>
    (poly[0] ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
  );
}

// Tính tâm (centroid) gần đúng của một ServiceArea để định tuyến dự phòng khi cán bộ chưa có GPS ca trực
function getAreaCentroid(
  geometry?: AreaGeometry | null,
): [number, number] | null {
  const rings = toLeafletPolygons(geometry);
  const firstRing = rings[0];
  if (!firstRing || firstRing.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const [lat, lng] of firstRing) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / firstRing.length, lngSum / firstRing.length];
}

// Tạo icon marker nổi bật cho cán bộ / xe tuần tra trên bản đồ
function createPatrolOfficerIcon(label: string, isPrimary = false) {
  return L.divIcon({
    className: "ecoalert-patrol-marker",
    html: `<div style="
      display:flex;
      align-items:center;
      gap:6px;
      padding:4px 10px;
      border-radius:9999px;
      background:${isPrimary ? "#065F46" : "#ffffff"};
      color:${isPrimary ? "#ffffff" : "#065F46"};
      border:2px solid #047857;
      box-shadow:0 6px 18px rgba(4,120,87,0.28);
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
    ">
      <span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${isPrimary ? "#34D399" : "#10B981"};"></span>
      <span>${label}</span>
    </div>`,
    iconSize: [110, 28],
    iconAnchor: [55, 14],
  });
}

// Tự động điều chỉnh khung nhìn bản đồ khi chọn sự cố hoặc khu vực
function MapViewportController({
  selectedCoords,
  areaPolygons,
  allAlertCoords,
}: {
  selectedCoords: [number, number] | null;
  areaPolygons: [number, number][][];
  allAlertCoords: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedCoords) {
      map.flyTo(selectedCoords, Math.max(map.getZoom(), 15), {
        duration: 0.65,
      });
      return;
    }
    if (areaPolygons.length > 0 && areaPolygons[0].length > 2) {
      const bounds = L.latLngBounds(areaPolygons.flat());
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
        return;
      }
    }
    if (allAlertCoords.length === 1) {
      map.setView(allAlertCoords[0], 15);
    } else if (allAlertCoords.length > 1) {
      map.fitBounds(allAlertCoords, { padding: [56, 56], maxZoom: 15 });
    }
  }, [selectedCoords, areaPolygons, allAlertCoords, map]);

  return null;
}

const formatDistanceLabel = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)} km`;

const formatDurationMinutes = (seconds: number) =>
  `${Math.max(1, Math.round(seconds / 60))} phút`;

const formatMassScaleLabel = (scale?: string | null) => {
  switch (scale) {
    case "VERY_LARGE":
      return "Rất lớn (Cần xe ép/cẩu chuyên dụng)";
    case "LARGE":
      return "Lớn (Cần xe ép rác / xe tải thu gom)";
    case "MEDIUM":
      return "Trung bình (Xe thu gom cơ giới)";
    case "SMALL":
      return "Nhỏ (Thu gom thủ công / xe đẩy)";
    case "VERY_SMALL":
      return "Rất nhỏ (Xử lý nhanh tại chỗ)";
    default:
      return null;
  }
};

export default function AdminGisMap() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const topbarQuery = (searchParams.get("q") ?? "").trim().toLowerCase();

  // State điều khiển bộ lọc trên thanh nổi & Panel bên phải
  const [activeTab, setActiveTab] = useState<CommandFilterTab>("all");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("ALL");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState<boolean>(false);
  const [isRejectingLocation, setIsRejectingLocation] =
    useState<boolean>(false);

  // 1. Lấy dữ liệu thật từ các hooks & services
  const { data: alertsPage, isLoading: isAlertsLoading } = useAlerts(1, 100);
  const { data: areasPage } = useQuery({
    queryKey: ["service-areas", "gis-map"],
    queryFn: () => serviceAreas.list(1),
    staleTime: 60_000,
  });
  const { data: officerAvailabilityData } = useOfficerAvailability(true);
  const assignOfficerMutation = useAssignOfficer();

  const allAreas: ServiceArea[] = useMemo(
    () => (areasPage?.items ?? []).filter((a) => a.isActive),
    [areasPage?.items],
  );

  const selectedServiceArea = useMemo(
    () => allAreas.find((a) => a._id === selectedAreaId) ?? null,
    [allAreas, selectedAreaId],
  );

  const availabilityList: OfficerAvailability[] = useMemo(
    () => (officerAvailabilityData ?? []) as OfficerAvailability[],
    [officerAvailabilityData],
  );

  const onShiftOfficers = useMemo(
    () => availabilityList.filter((o) => o.shiftStatus === "ON_SHIFT"),
    [availabilityList],
  );

  // Lọc các sự cố có tọa độ hợp lệ + khớp ô tìm kiếm trên Topbar + khớp Khu vực Phục vụ
  const validCoordinateAlerts = useMemo(() => {
    return (alertsPage?.items ?? []).filter((alert) => {
      const coords = getIncidentLatLng(alert);
      if (!coords) return false;

      if (topbarQuery) {
        const haystack =
          `${alert._id} ${alert.title} ${alert.address ?? ""} ${alert.category ?? ""}`.toLowerCase();
        if (!haystack.includes(topbarQuery)) return false;
      }

      if (selectedServiceArea) {
        const matchesAssignedArea =
          alert.assignedAreaId === selectedServiceArea._id ||
          alert.assignedAreaCode === selectedServiceArea.code;
        const insidePolygon = isPointInAreaGeometry(
          coords[0],
          coords[1],
          selectedServiceArea.geometry,
        );
        if (!matchesAssignedArea && !insidePolygon) return false;
      }

      return true;
    });
  }, [alertsPage?.items, topbarQuery, selectedServiceArea]);

  // Tính số lượng thực tế cho 4 Tab trên Top Floating Filter Bar
  const emergencyAlerts = useMemo(
    () =>
      validCoordinateAlerts.filter((a) => {
        const sev = normalizeSeverity(getAlertDisplaySeverity(a) ?? a.severity);
        return sev === "critical" || sev === "high";
      }),
    [validCoordinateAlerts],
  );

  const inProgressAlerts = useMemo(
    () =>
      validCoordinateAlerts.filter(
        (a) => a.status === "assigned" || a.status === "in_progress",
      ),
    [validCoordinateAlerts],
  );

  // Danh sách sự cố hiển thị theo Tab đang chọn
  const displayedAlerts = useMemo(() => {
    switch (activeTab) {
      case "emergency":
        return emergencyAlerts;
      case "in_progress":
        return inProgressAlerts;
      case "patrol":
      case "all":
      default:
        return validCoordinateAlerts;
    }
  }, [activeTab, emergencyAlerts, inProgressAlerts, validCoordinateAlerts]);

  // Tự động chọn sự cố ưu tiên đầu tiên nếu chưa chọn hoặc sự cố đang chọn không còn trong danh sách
  useEffect(() => {
    if (displayedAlerts.length === 0) {
      setSelectedAlertId(null);
      return;
    }
    const stillExists = displayedAlerts.some((a) => a._id === selectedAlertId);
    if (!stillExists) {
      // Ưu tiên chọn sự cố khẩn cấp hoặc đang chờ điều phối đầu tiên
      const priorityCandidate =
        displayedAlerts.find((a) => {
          const sev = normalizeSeverity(
            getAlertDisplaySeverity(a) ?? a.severity,
          );
          return (
            (sev === "critical" || sev === "high") &&
            ["pending", "verified", "ai_analyzing"].includes(a.status)
          );
        }) ?? displayedAlerts[0];
      setSelectedAlertId(priorityCandidate?._id ?? null);
    }
  }, [displayedAlerts, selectedAlertId]);

  // Lấy chi tiết đầy đủ của sự cố đang chọn (bao gồm aiOverallAnalysis, timeline, checkIn...)
  const { data: detailedSelectedAlert } = useAlert(selectedAlertId ?? "");

  const selectedAlert: Alert | null = useMemo(() => {
    if (!selectedAlertId) return null;
    return (
      detailedSelectedAlert ??
      displayedAlerts.find((a) => a._id === selectedAlertId) ??
      null
    );
  }, [selectedAlertId, detailedSelectedAlert, displayedAlerts]);

  const selectedAlertCoords = useMemo(
    () => (selectedAlert ? getIncidentLatLng(selectedAlert) : null),
    [selectedAlert],
  );

  // 2. Lấy gợi ý điều phối theo ServiceArea từ API thật `/v1/alerts/:id/assignment-preview`
  const {
    data: assignmentPreview,
    isLoading: isPreviewLoading,
    refetch: refetchAssignmentPreview,
  } = useQuery({
    queryKey: ["assignment-preview", selectedAlertId],
    queryFn: () => serviceAreas.preview(selectedAlertId!),
    enabled: Boolean(selectedAlertId),
    staleTime: 15_000,
  });

  // Khu vực phụ trách hiển thị đa giác trên bản đồ (ưu tiên khu vực đang lọc hoặc khu vực khớp với sự cố đang chọn)
  const activeMapArea: ServiceArea | null = useMemo(() => {
    if (selectedServiceArea) return selectedServiceArea;
    if (assignmentPreview?.match?.area) return assignmentPreview.match.area;
    if (selectedAlertCoords) {
      const matched = allAreas.find((area) =>
        isPointInAreaGeometry(
          selectedAlertCoords[0],
          selectedAlertCoords[1],
          area.geometry,
        ),
      );
      if (matched) return matched;
    }
    return allAreas[0] ?? null;
  }, [
    selectedServiceArea,
    assignmentPreview?.match?.area,
    selectedAlertCoords,
    allAreas,
  ]);

  const activeAreaPolygons = useMemo(
    () => toLeafletPolygons(activeMapArea?.geometry),
    [activeMapArea],
  );

  // Kết hợp danh sách ứng viên từ `assignmentPreview.candidates` và `availabilityList` kèm tọa độ thực tế
  const enrichedCandidates = useMemo(() => {
    const rawCandidates: AreaOfficer[] =
      assignmentPreview?.candidates && assignmentPreview.candidates.length > 0
        ? assignmentPreview.candidates
        : availabilityList.map((item) => ({
            officer: {
              ...item.officer,
              isActive: true,
              isDeleted: false,
            },
            shiftStatus: item.shiftStatus,
            activeTaskCount: item.activeTaskCount,
            assignedCount: item.assignedCount,
            inProgressCount: item.inProgressCount,
            workloadLevel: item.workloadLevel,
            eligible: item.shiftStatus === "ON_SHIFT",
          }));

    const areaCenter = getAreaCentroid(activeMapArea?.geometry);

    return rawCandidates
      .map((candidate) => {
        const availabilityMatch = availabilityList.find(
          (a) => a.officer._id === candidate.officer._id,
        );
        const shiftCoords =
          availabilityMatch?.currentShift?.startLocation?.coordinates;
        const hasShiftGps =
          Array.isArray(shiftCoords) &&
          shiftCoords.length === 2 &&
          Number.isFinite(shiftCoords[0]) &&
          Number.isFinite(shiftCoords[1]) &&
          (shiftCoords[0] !== 0 || shiftCoords[1] !== 0);

        const officerLatLng: [number, number] | null = hasShiftGps
          ? [shiftCoords[1], shiftCoords[0]]
          : areaCenter;

        const distanceKm =
          selectedAlertCoords && officerLatLng
            ? calculateHaversineDistanceKm(
                officerLatLng[0],
                officerLatLng[1],
                selectedAlertCoords[0],
                selectedAlertCoords[1],
              )
            : null;

        const distanceMeters =
          distanceKm !== null ? Math.max(50, Math.round(distanceKm * 1000)) : null;
        const estimatedDurationSeconds =
          distanceMeters !== null
            ? Math.max(60, Math.round((distanceMeters / 1000 / 22) * 3600))
            : null;

        const isRecommended =
          assignmentPreview?.selectedOfficerId === candidate.officer._id;

        return {
          ...candidate,
          officerLatLng,
          hasShiftGps,
          distanceMeters,
          estimatedDurationSeconds,
          isRecommended,
        };
      })
      .sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        if (a.shiftStatus === "ON_SHIFT" && b.shiftStatus !== "ON_SHIFT")
          return -1;
        if (a.shiftStatus !== "ON_SHIFT" && b.shiftStatus === "ON_SHIFT")
          return 1;
        if (a.distanceMeters !== null && b.distanceMeters !== null) {
          return a.distanceMeters - b.distanceMeters;
        }
        return a.activeTaskCount - b.activeTaskCount;
      });
  }, [
    assignmentPreview?.candidates,
    assignmentPreview?.selectedOfficerId,
    availabilityList,
    activeMapArea?.geometry,
    selectedAlertCoords,
  ]);

  const primaryCandidate = enrichedCandidates[0] ?? null;
  const secondaryCandidates = enrichedCandidates.slice(1, 4);

  // 3. Gọi dịch vụ định tuyến OSRM thật (`gisService.getDrivingRoute`) từ vị trí Cán bộ Đề xuất số 1 tới điểm sự cố
  const primaryStartLat = primaryCandidate?.officerLatLng?.[0];
  const primaryStartLng = primaryCandidate?.officerLatLng?.[1];
  const targetLat = selectedAlertCoords?.[0];
  const targetLng = selectedAlertCoords?.[1];

  const { data: osrmRoute, isFetching: isFetchingOsrm } =
    useQuery<RouteTelemetry | null>({
      queryKey: [
        "gis-osrm-route",
        selectedAlertId,
        primaryCandidate?.officer._id,
        primaryStartLat,
        primaryStartLng,
        targetLat,
        targetLng,
      ],
      queryFn: async () => {
        if (
          primaryStartLat === undefined ||
          primaryStartLng === undefined ||
          targetLat === undefined ||
          targetLng === undefined
        ) {
          return null;
        }
        // Nếu 2 điểm trùng nhau hoàn toàn thì không cần gọi OSRM
        if (
          Math.abs(primaryStartLat - targetLat) < 0.0001 &&
          Math.abs(primaryStartLng - targetLng) < 0.0001
        ) {
          return null;
        }
        try {
          return await gisService.getDrivingRoute(
            { lat: primaryStartLat, lng: primaryStartLng },
            { lat: targetLat, lng: targetLng },
          );
        } catch {
          return null;
        }
      },
      enabled: Boolean(
        selectedAlertId &&
          primaryStartLat !== undefined &&
          primaryStartLng !== undefined &&
          targetLat !== undefined &&
          targetLng !== undefined,
      ),
      staleTime: 60_000,
      retry: false,
    });

  // Chuỗi tọa độ đường dẫn trên bản đồ (ưu tiên OSRM thật, fallback đường nối trực tiếp nếu OSRM chưa trả về)
  const routePolylinePositions: [number, number][] = useMemo(() => {
    if (osrmRoute?.geometry?.coordinates?.length) {
      return osrmRoute.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
    }
    if (primaryCandidate?.officerLatLng && selectedAlertCoords) {
      return [primaryCandidate.officerLatLng, selectedAlertCoords];
    }
    return [];
  }, [osrmRoute, primaryCandidate?.officerLatLng, selectedAlertCoords]);

  const primaryDistanceMeters =
    osrmRoute?.distanceMeters ?? primaryCandidate?.distanceMeters ?? null;
  const primaryDurationSeconds =
    osrmRoute?.durationSeconds ??
    primaryCandidate?.estimatedDurationSeconds ??
    null;

  // 4. Các hàm xử lý nghiệp vụ thật (Chỉ định cán bộ / Tự động điều phối / Báo sai tọa độ - Từ chối)
  const handleDispatchOfficer = async (officerId: string, fullName: string) => {
    if (!selectedAlert) return;
    try {
      // Nếu báo cáo đang ở trạng thái pending / ai_analyzing, xác minh trước khi gán cán bộ
      if (
        selectedAlert.status === "pending" ||
        selectedAlert.status === "ai_analyzing"
      ) {
        await alertService.updateStatus(selectedAlert._id, "verified");
      }

      await assignOfficerMutation.mutateAsync({
        id: selectedAlert._id,
        officerId,
        overrideConfirmed: true,
        assignmentReason: `Điều phối từ Trung tâm Bản đồ GIS (${activeMapArea?.name ?? "OSRM"})`,
      });

      toast.success(`Đã phát lệnh điều phối cho Đ/c ${fullName}`);
      void refetchAssignmentPreview();
      void queryClient.invalidateQueries({ queryKey: ["officer-availability"] });
    } catch (err) {
      // Thử fallback sang autoAssign của serviceAreas nếu được cấu hình
      try {
        const autoRes = await serviceAreas.autoAssign(selectedAlert._id);
        if (autoRes.assigned) {
          toast.success(`Đã tự động điều phối cán bộ cho sự cố`);
          void queryClient.invalidateQueries({
            queryKey: ["alert", selectedAlert._id],
          });
          void queryClient.invalidateQueries({ queryKey: ["alerts"] });
          void refetchAssignmentPreview();
          return;
        }
      } catch {
        // Bỏ qua lỗi fallback để hiển thị lỗi chính
      }
      toast.error(
        getApiErrorMessage(
          err,
          "Không thể phân công cán bộ. Vui lòng kiểm tra trạng thái sự cố.",
        ),
      );
    }
  };

  const handleRejectInvalidCoordinates = async () => {
    if (!selectedAlert || isRejectingLocation) return;
    const confirmed = window.confirm(
      `Xác nhận đánh dấu sự cố #${selectedAlert._id.slice(-6).toUpperCase()} là "Báo sai tọa độ / Từ chối xử lý"?`,
    );
    if (!confirmed) return;

    try {
      setIsRejectingLocation(true);
      await alertService.updateStatus(selectedAlert._id, "rejected");
      await queryClient.invalidateQueries({
        queryKey: ["alert", selectedAlert._id],
      });
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Đã cập nhật trạng thái từ chối do sai tọa độ.");
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, "Không thể cập nhật trạng thái báo cáo."),
      );
    } finally {
      setIsRejectingLocation(false);
    }
  };

  // Trích xuất thông tin AI Vision & Geo cho Panel bên phải
  const confidenceInfo = selectedAlert
    ? getAlertDisplayConfidence(selectedAlert)
    : { value: null, source: "NONE" as const };
  const confidencePercentText =
    confidenceInfo.value !== null
      ? `${(confidenceInfo.value * 100).toFixed(1)}%`
      : selectedAlert?.aiOverallAnalysis?.categoryConfidence !== undefined
        ? `${(selectedAlert.aiOverallAnalysis.categoryConfidence * 100).toFixed(1)}%`
        : "Đang phân tích";

  const yoloDetections = useMemo(() => {
    if (!selectedAlert?.visionEvidence?.length) return [];
    return selectedAlert.visionEvidence.flatMap((v) => v.detections ?? []);
  }, [selectedAlert?.visionEvidence]);

  const detectedMaterialsLabel = useMemo(() => {
    if (!selectedAlert) return "Chờ phân loại";
    const categoryText = getIncidentCategoryLabel(
      selectedAlert.aiOverallAnalysis?.categorySuggestion ??
        selectedAlert.category,
      language,
    );
    if (yoloDetections.length > 0) {
      const uniqueClasses = Array.from(
        new Set(yoloDetections.map((d) => d.materialClass).filter(Boolean)),
      ).slice(0, 2);
      if (uniqueClasses.length > 0) {
        return `${categoryText} (${uniqueClasses.join(", ")})`;
      }
    }
    return categoryText;
  }, [selectedAlert, yoloDetections, language]);

  const massAssessmentLabel = useMemo(() => {
    const mass = selectedAlert?.aiOverallAnalysis?.massEstimate;
    if (mass?.available && mass.mostLikelyKg !== null) {
      const kg = mass.mostLikelyKg;
      const weightText =
        kg >= 1000 ? `~${(kg / 1000).toFixed(1)} Tấn` : `~${Math.round(kg)} kg`;
      const vehicleHint =
        kg >= 500
          ? "(Cần xe ép/cẩu)"
          : kg >= 100
            ? "(Xe thu gom cơ giới)"
            : "(Thu gom tiêu chuẩn)";
      return `${weightText} ${vehicleHint}`;
    }
    const scaleText = formatMassScaleLabel(mass?.scale);
    if (scaleText) return scaleText;
    const sev = normalizeSeverity(
      selectedAlert
        ? (getAlertDisplaySeverity(selectedAlert) ?? selectedAlert.severity)
        : null,
    );
    if (sev === "critical" || sev === "high") {
      return "Quy mô lớn (Ưu tiên xe cơ giới)";
    }
    return "Tiêu chuẩn (Đang cập nhật khối lượng)";
  }, [selectedAlert]);

  const urbanImpactLabel = useMemo(() => {
    if (!selectedAlert) return "Đang đánh giá";
    const sevScore = selectedAlert.aiOverallAnalysis?.severityScore;
    const sev = normalizeSeverity(
      getAlertDisplaySeverity(selectedAlert) ?? selectedAlert.severity,
    );
    if (typeof sevScore === "number" && Number.isFinite(sevScore)) {
      const pct = Math.round(sevScore <= 1 ? sevScore * 100 : sevScore);
      const suffix =
        pct >= 75
          ? "Nguy cơ cản trở cao"
          : pct >= 50
            ? "Ảnh hưởng mỹ quan"
            : "Mức độ cục bộ";
      return `${pct}% (${suffix})`;
    }
    if (sev === "critical") return "Nghiêm trọng (Cản trở lưu thông)";
    if (sev === "high") return "Cao (Ảnh hưởng khu dân cư)";
    if (sev === "medium") return "Trung bình (Điểm tồn đọng rác)";
    return "Thấp (Phạm vi hẹp)";
  }, [selectedAlert]);

  const gpsVerificationLabel = useMemo(() => {
    if (!selectedAlert) return "Chưa kiểm chứng";
    if (selectedAlert.checkIn?.verified) {
      return `100% (Đã Check-in ±${Math.round(selectedAlert.checkIn.accuracyMeters)}m)`;
    }
    if (selectedAlertCoords) {
      if (activeMapArea) {
        return `100% (Trùng mốc ${activeMapArea.code})`;
      }
      return "100% (Trùng mốc GPS)";
    }
    return "Chưa có tọa độ GPS";
  }, [selectedAlert, selectedAlertCoords, activeMapArea]);

  const allDisplayedCoords = useMemo(
    () =>
      displayedAlerts
        .map(getIncidentLatLng)
        .filter((c): c is [number, number] => c !== null),
    [displayedAlerts],
  );

  if (isAlertsLoading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#047857]" />
          <p className="text-xs font-medium text-slate-500">
            Đang tải dữ liệu Trung tâm Điều hành Bản đồ GIS...
          </p>
        </div>
      </div>
    );
  }

  const selectedSeverity = selectedAlert
    ? normalizeSeverity(
        getAlertDisplaySeverity(selectedAlert) ?? selectedAlert.severity,
      )
    : "medium";

  const isSelectedUrgent =
    selectedSeverity === "critical" || selectedSeverity === "high";

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* =====================================================================
          KHU VỰC 2: KHUNG BẢN ĐỒ GIS TRUNG TÂM (CENTER INTERACTIVE MAP)
      ===================================================================== */}
      <section
        aria-label="Bản đồ điều hành GIS"
        className="relative isolate z-0 flex-1 overflow-hidden"
      >
        {/* 2.1 Thanh Bộ lọc Nổi phía trên Bản đồ (Top Floating Filter Bar) */}
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-[500] flex flex-wrap items-center justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-md backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            {/* Tab 1: Tất cả điểm nóng */}
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-[#065F46] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${
                  activeTab === "all" ? "text-emerald-300" : "text-[#047857]"
                }`}
              />
              <span>Tất cả điểm nóng</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "all"
                    ? "bg-emerald-500/30 text-white"
                    : "bg-emerald-500/15 text-[#047857] dark:text-emerald-400"
                }`}
              >
                {validCoordinateAlerts.length}
              </span>
            </button>

            {/* Tab 2: Khẩn cấp */}
            <button
              type="button"
              onClick={() => setActiveTab("emergency")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "emergency"
                  ? "bg-[#065F46] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-500/25" />
              <span>Khẩn cấp</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "emergency"
                    ? "bg-white/20 text-white"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                }`}
              >
                {emergencyAlerts.length}
              </span>
            </button>

            {/* Tab 3: Đang xử lý */}
            <button
              type="button"
              onClick={() => setActiveTab("in_progress")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "in_progress"
                  ? "bg-[#065F46] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/25" />
              <span>Đang xử lý</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "in_progress"
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                }`}
              >
                {inProgressAlerts.length}
              </span>
            </button>

            {/* Tab 4: Tổ đội tuần tra */}
            <button
              type="button"
              onClick={() => setActiveTab("patrol")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === "patrol"
                  ? "bg-[#065F46] text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <Truck
                className={`h-3.5 w-3.5 ${
                  activeTab === "patrol" ? "text-emerald-300" : "text-emerald-600"
                }`}
              />
              <span>Tổ đội tuần tra</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "patrol"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {onShiftOfficers.length || availabilityList.length}
              </span>
            </button>

            <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />

            {/* Dropdown chọn nhanh Khu vực phục vụ (ServiceArea / Phường) */}
            <div className="relative flex items-center">
              <RouteIcon className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-500" />
              <select
                aria-label="Chọn khu vực phục vụ"
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="h-9 appearance-none rounded-xl border border-slate-200/80 bg-slate-50 pl-8 pr-8 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">
                  {allAreas.length > 0
                    ? `${allAreas.length} Khu vực / Phường`
                    : "Tất cả khu vực"}
                </option>
                {allAreas.map((area) => (
                  <option key={area._id} value={area._id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Nút bật/tắt Panel bên phải khi thu gọn */}
          {!isDrawerOpen && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-md backdrop-blur hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <PanelRightOpen className="h-4 w-4 text-[#047857]" />
              <span>Mở Panel Điều phối</span>
            </button>
          )}
        </div>

        {/* 2.2 Bản đồ Tương tác (EcoAlertBaseMap + Polygon + Markers + OSRM Route) */}
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={14}
          maxZoom={19}
          minZoom={3}
          className="h-full w-full z-0"
        >
          <EcoAlertBaseMap />
          <MapViewportController
            selectedCoords={selectedAlertCoords}
            areaPolygons={activeAreaPolygons}
            allAlertCoords={allDisplayedCoords}
          />

          {/* Ranh giới Đa giác Khu vực Phục vụ (Service Area Polygon) với viền nét đứt #047857 */}
          {activeAreaPolygons.map((ring, idx) => (
            <Polygon
              key={`area-poly-${activeMapArea?._id ?? idx}-${idx}`}
              positions={ring}
              pathOptions={{
                color: "#047857",
                weight: 2.5,
                dashArray: "8 6",
                fillColor: "#10B981",
                fillOpacity: 0.08,
              }}
            >
              {activeMapArea && idx === 0 && (
                <Tooltip sticky direction="top">
                  <div className="text-xs font-semibold text-emerald-900">
                    {activeMapArea.name} ({activeMapArea.code})
                  </div>
                </Tooltip>
              )}
            </Polygon>
          ))}

          {/* Đường dẫn OSRM từ Cán bộ Đề xuất số 1 đến điểm sự cố đang chọn */}
          {routePolylinePositions.length >= 2 && (
            <Polyline
              positions={routePolylinePositions}
              pathOptions={{
                color: "#047857",
                weight: 4,
                dashArray: "10 8",
                opacity: 0.9,
              }}
            />
          )}

          {/* Marker vị trí Cán bộ Đề xuất số 1 kèm Thẻ thông tin nổi (Tooltip Card) trên bản đồ */}
          {primaryCandidate?.officerLatLng && selectedAlert && (
            <Marker
              position={primaryCandidate.officerLatLng}
              icon={createPatrolOfficerIcon(
                primaryCandidate.officer.fullName,
                true,
              )}
            >
              <Tooltip
                permanent
                direction="right"
                offset={[16, 0]}
                className="ecoalert-osrm-map-card !rounded-2xl !border-2 !border-[#047857] !bg-white/95 !p-2.5 !shadow-xl"
              >
                <div className="min-w-[135px] space-y-1 text-left">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
                    <Truck className="h-3.5 w-3.5 text-[#047857]" />
                    <span className="truncate">
                      {primaryCandidate.officer.fullName}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-[#047857]">
                    {primaryDistanceMeters !== null
                      ? `${formatDistanceLabel(primaryDistanceMeters)} đến sự cố`
                      : "Đang định tuyến"}
                    {primaryDurationSeconds !== null
                      ? ` (${Math.max(1, Math.round(primaryDurationSeconds / 60))}p)`
                      : ""}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {primaryCandidate.shiftStatus === "ON_SHIFT"
                      ? "Đang trực tại địa bàn"
                      : "Cán bộ dự phòng"}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          )}

          {/* Hiển thị thêm các cán bộ đang trong ca trực có GPS khi bật tab "Tổ đội tuần tra" */}
          {activeTab === "patrol" &&
            availabilityList.map((officerItem) => {
              const coords =
                officerItem.currentShift?.startLocation?.coordinates;
              if (
                !Array.isArray(coords) ||
                coords.length !== 2 ||
                !Number.isFinite(coords[0]) ||
                !Number.isFinite(coords[1]) ||
                (coords[0] === 0 && coords[1] === 0)
              ) {
                return null;
              }
              if (officerItem.officer._id === primaryCandidate?.officer._id) {
                return null;
              }
              return (
                <Marker
                  key={`patrol-${officerItem.officer._id}`}
                  position={[coords[1], coords[0]]}
                  icon={createPatrolOfficerIcon(
                    officerItem.officer.fullName,
                    false,
                  )}
                >
                  <Popup>
                    <div className="space-y-1 p-1 text-xs">
                      <p className="font-bold text-slate-900">
                        {officerItem.officer.fullName}
                      </p>
                      <p className="text-slate-500">
                        {officerItem.shiftStatus === "ON_SHIFT"
                          ? "Đang trong ca trực"
                          : "Ngoài ca trực"}{" "}
                        · {officerItem.activeTaskCount} việc đang xử lý
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Cụm Marker Sự cố (nhấp vào Marker sẽ chọn sự cố và cập nhật Panel bên phải) */}
          <MarkerClusterGroup chunkedLoading maxClusterRadius={36}>
            {displayedAlerts.map((alert) => {
              const coordinates = getIncidentLatLng(alert);
              if (!coordinates) return null;
              const isSelected = alert._id === selectedAlert?._id;
              const displaySev =
                getAlertDisplaySeverity(alert) ?? alert.severity;

              return (
                <Marker
                  key={alert._id}
                  position={coordinates}
                  icon={createIncidentMarkerIcon(displaySev, {
                    emphasized: isSelected,
                    size: isSelected ? 30 : 24,
                  })}
                  eventHandlers={{
                    click: () => {
                      setSelectedAlertId(alert._id);
                      setIsDrawerOpen(true);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -12]}>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-slate-900">{alert.title}</p>
                      <p className="text-[11px] text-slate-500">
                        #{alert._id.slice(-6).toUpperCase()} ·{" "}
                        {getIncidentSeverityLabel(displaySev, language)}
                      </p>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>

        {/* Nhãn góc dưới bên trái hiển thị Khu vực đang giám sát */}
        {activeMapArea && (
          <div className="pointer-events-none absolute bottom-5 left-4 z-[500] hidden items-center gap-2 rounded-lg border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur xl:inline-flex dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-200">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#047857]" />
            <span>
              {activeMapArea.name} ({activeMapArea.code})
            </span>
          </div>
        )}

        {/* 2.3 Thanh Trạng thái Tác chiến Nổi phía dưới Bản đồ (Bottom Floating Telemetry Pill) */}
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-[500] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-4 overflow-x-auto rounded-full border border-slate-200/90 bg-white/95 px-5 py-2.5 shadow-lg backdrop-blur sm:gap-6 sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          {/* Chỉ số 1: Khu vực đang xem */}
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="h-7 w-1 rounded-full bg-[#047857]" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Địa bàn:{" "}
              </span>
              <strong className="font-bold text-slate-800 dark:text-slate-100">
                {activeMapArea
                  ? `${activeMapArea.name} (${activeMapArea.code})`
                  : "Toàn đô thị TP.HCM"}
              </strong>
            </div>
          </div>

          <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-800" />

          {/* Chỉ số 2: Trực ban hiện trường */}
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-[#047857] dark:text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </span>
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                Trực ban hiện trường:{" "}
              </span>
              <strong className="font-bold text-slate-900 dark:text-white">
                {onShiftOfficers.length}/{availabilityList.length || 0} Cán bộ
              </strong>
            </div>
          </div>

          <div className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-800" />

          {/* Chỉ số 3: Độ chuẩn GPS / Định tuyến OSRM */}
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Navigation className="h-4 w-4" />
            </span>
            <div>
              <span className="text-slate-500 dark:text-slate-400">
                Độ chuẩn GPS:{" "}
              </span>
              <strong className="font-bold text-sky-600 dark:text-sky-400">
                {isFetchingOsrm
                  ? "Đang tính OSRM..."
                  : osrmRoute
                    ? "OSRM Thực tế"
                    : "99.8% RTK"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          KHU VỰC 3: PANEL CHI TIẾT SỰ CỐ & ĐIỀU PHỐI CÁN BỘ BÊN PHẢI (420px)
      ===================================================================== */}
      {isDrawerOpen && (
        <aside
          aria-label="Panel chi tiết sự cố và điều phối cán bộ"
          className="relative z-10 flex h-full w-full shrink-0 flex-col border-l border-slate-200 bg-white sm:w-[420px] dark:border-slate-800 dark:bg-slate-950"
        >
          {!selectedAlert ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-[#047857]">
                <MapPin className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-100">
                Chưa có sự cố nào được chọn
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Nhấp vào một điểm nóng trên bản đồ GIS hoặc đổi bộ lọc khu vực để
                xem phân tích EcoVision AI và phát lệnh điều phối cán bộ.
              </p>
            </div>
          ) : (
            <>
              {/* Vùng cuộn nội dung chính của Panel */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* 3.1 HEADER SỰ CỐ */}
                <div className="space-y-2.5 border-b border-slate-100 pb-3.5 dark:border-slate-800/80">
                  {/* Dòng 1: Chấm tròn màu + Mã sự cố #EA-... + Nút In & Mở trang chi tiết */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full ${
                          isSelectedUrgent
                            ? "bg-red-500 ring-4 ring-red-500/15"
                            : "bg-emerald-500 ring-4 ring-emerald-500/15"
                        }`}
                      />
                      <h2 className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Sự cố #{selectedAlert._id.slice(-4).toUpperCase()}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        title="In phiếu điều phối sự cố"
                        aria-label="In phiếu điều phối sự cố"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <Link
                        to={`/admin/reports/${selectedAlert._id}`}
                        title="Mở trang hồ sơ chi tiết"
                        aria-label="Mở trang hồ sơ chi tiết"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(false)}
                        title="Thu gọn Panel"
                        aria-label="Thu gọn Panel"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <PanelRightClose className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dòng 2: Thời gian báo cáo & địa chỉ tóm tắt */}
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Báo cáo lúc{" "}
                    {selectedAlert.createdAt
                      ? format(new Date(selectedAlert.createdAt), "HH:mm")
                      : "--:--"}{" "}
                    ·{" "}
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedAlert.address || "Đang cập nhật địa chỉ"}
                    </span>
                  </p>

                  {/* Dòng 3: Cụm Badges trạng thái & Thời gian tương đối */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          isSelectedUrgent
                            ? "bg-red-500/12 text-red-600 dark:text-red-400"
                            : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        <AlertCircle className="h-3 w-3" />
                        {isSelectedUrgent
                          ? "KHẨN CẤP"
                          : getIncidentSeverityLabel(
                              selectedSeverity,
                              language,
                            ).toUpperCase()}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        {selectedAlert.status === "pending" ||
                        selectedAlert.status === "verified" ||
                        selectedAlert.status === "ai_analyzing"
                          ? "Chờ điều phối"
                          : getIncidentStatusLabel(
                              selectedAlert.status,
                              language,
                            )}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      {selectedAlert.createdAt
                        ? formatDistanceToNow(
                            new Date(selectedAlert.createdAt),
                            {
                              addSuffix: true,
                              locale: vi,
                            },
                          )
                        : "Vừa xong"}
                    </span>
                  </div>
                </div>

                {/* 3.2 KHỐI 1 - ẢNH PHẢN ÁNH TỪ CÔNG DÂN (EVIDENCE CARD) */}
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                      <Camera className="h-4 w-4 text-[#047857]" />
                      <span>Ảnh phản ánh từ công dân</span>
                    </div>
                    <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      Mã CD:{" "}
                      {selectedAlert.citizenId
                        ? `#${String(selectedAlert.citizenId).slice(-5).toUpperCase()} (Đã xác thực)`
                        : "Công dân đô thị"}
                    </span>
                  </div>

                  {selectedAlert.mediaUrls &&
                  selectedAlert.mediaUrls.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setIsGalleryModalOpen(true)}
                      className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-[#047857] dark:border-slate-800"
                    >
                      <img
                        src={selectedAlert.mediaUrls[0]}
                        alt={selectedAlert.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

                      {/* Overlay góc dưới bên trái: Icon vị trí + địa chỉ GPS chi tiết */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                        <div className="inline-flex max-w-[82%] items-center gap-1.5 rounded-lg bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span className="truncate">
                            {selectedAlert.address ||
                              (selectedAlertCoords
                                ? `${selectedAlertCoords[0].toFixed(5)}, ${selectedAlertCoords[1].toFixed(5)}`
                                : "Chưa rõ tọa độ")}
                          </span>
                        </div>

                        {selectedAlert.mediaUrls.length > 1 && (
                          <span className="shrink-0 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur-xs">
                            +{selectedAlert.mediaUrls.length - 1} ảnh
                          </span>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                      <Camera className="mb-1.5 h-5 w-5 text-slate-400" />
                      <span>Báo cáo không đính kèm hình ảnh</span>
                    </div>
                  )}
                </div>

                {/* 3.3 KHỐI 2 - PHÂN TÍCH ECOVISION AI (AI ASSESSMENT CARD) */}
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-500/25 dark:bg-emerald-950/20">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#047857] text-white">
                        <BrainCircuit className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Phân tích EcoVision AI
                      </h3>
                    </div>

                    <span className="rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-[11px] font-bold text-[#047857] dark:bg-emerald-500/20 dark:text-emerald-300">
                      Độ tin cậy: {confidencePercentText}
                    </span>
                  </div>

                  {/* Lưới 2x2 (Grid 4 ô trắng nhỏ bên trong) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Ô 1: Loại phế thải phát hiện */}
                    <div className="rounded-lg border border-white/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Loại phế thải phát hiện
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {detectedMaterialsLabel}
                      </p>
                    </div>

                    {/* Ô 2: Ước tính thể tích / quy mô */}
                    <div className="rounded-lg border border-white/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Đánh giá khối lượng / Quy mô
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                        {massAssessmentLabel}
                      </p>
                    </div>

                    {/* Ô 3: Mức độ ảnh hưởng */}
                    <div className="rounded-lg border border-white/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Mức độ ảnh hưởng
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {urbanImpactLabel}
                      </p>
                    </div>

                    {/* Ô 4: Khớp tọa độ địa chính */}
                    <div className="rounded-lg border border-white/80 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        Khớp tọa độ địa chính
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-[#047857] dark:text-emerald-400">
                        {gpsVerificationLabel}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3.4 KHỐI 3 - ĐỀ XUẤT ĐIỀU PHỐI TỐI ƯU (OSRM OFFICER DISPATCH CARD) */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <RouteIcon className="h-4 w-4 text-[#047857]" />
                      <span>Đề xuất điều phối tối ưu</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Thuật toán OSRM
                    </span>
                  </div>

                  {isPreviewLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-slate-200 p-6 text-xs text-slate-500 dark:border-slate-800">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#047857]" />
                      Đang tính toán lộ trình OSRM và ca trực...
                    </div>
                  ) : primaryCandidate ? (
                    <>
                      {/* Thẻ Cán bộ Đề xuất số 1 (Highlighted Card) */}
                      <div className="relative rounded-xl border-2 border-emerald-600 bg-white p-3.5 shadow-xs dark:bg-slate-900">
                        <span className="absolute -top-2.5 right-3 rounded-full bg-[#065F46] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-xs">
                          ĐỀ XUẤT SỐ 1 - GẦN NHẤT
                        </span>

                        <div className="flex items-start gap-3 pt-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-[#047857] dark:text-emerald-400">
                            <UserCheck className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                              Đ/c {primaryCandidate.officer.fullName}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {activeMapArea
                                ? `Phụ trách ${activeMapArea.name} · #${activeMapArea.code}`
                                : primaryCandidate.officer.email}
                            </p>
                          </div>
                        </div>

                        {/* Hàng thông số: Pill khoảng cách OSRM & Tải công việc hiện tại */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70">
                          <span className="inline-flex items-center gap-1 font-bold text-[#047857] dark:text-emerald-400">
                            <Navigation className="h-3.5 w-3.5" />
                            {primaryDistanceMeters !== null
                              ? `${formatDistanceLabel(primaryDistanceMeters)} · ${formatDurationMinutes(primaryDurationSeconds ?? 240)}`
                              : "Trong vùng phụ trách"}
                          </span>

                          <span className="text-slate-400">|</span>

                          <span className="text-xs text-slate-600 dark:text-slate-300">
                            Tải công việc:{" "}
                            <strong className="font-bold text-slate-900 dark:text-white">
                              {primaryCandidate.activeTaskCount} nhiệm vụ (
                              {primaryCandidate.activeTaskCount <= 2
                                ? "Đủ tải"
                                : "Cao"}
                              )
                            </strong>
                          </span>
                        </div>

                        <p className="mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                          Trạng thái:{" "}
                          <span className="font-semibold text-[#047857] dark:text-emerald-400">
                            {primaryCandidate.shiftStatus === "ON_SHIFT"
                              ? "Sẵn sàng điều động"
                              : "Cần xác nhận ngoài ca"}
                          </span>{" "}
                          ({assignmentReasonLabel(assignmentPreview?.reason)})
                        </p>

                        {/* Nút CTA chính màu xanh đậm toàn chiều ngang */}
                        <button
                          type="button"
                          disabled={
                            assignOfficerMutation.isPending ||
                            selectedAlert.assignedOfficerId ===
                              primaryCandidate.officer._id
                          }
                          onClick={() =>
                            void handleDispatchOfficer(
                              primaryCandidate.officer._id,
                              primaryCandidate.officer.fullName,
                            )
                          }
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {assignOfficerMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Đang phát lệnh điều phối...</span>
                            </>
                          ) : selectedAlert.assignedOfficerId ===
                            primaryCandidate.officer._id ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Đã phân công cho cán bộ này</span>
                            </>
                          ) : (
                            <>
                              <span>Chỉ định & Phát lệnh điều phối</span>
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Danh sách Cán bộ Dự phòng (Secondary Candidates) */}
                      {secondaryCandidates.length > 0 && (
                        <div className="space-y-2">
                          {secondaryCandidates.map((candidate) => (
                            <div
                              key={candidate.officer._id}
                              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    <UserCheck className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                                      Đ/c {candidate.officer.fullName}
                                    </p>
                                    <p className="truncate text-[11px] text-slate-500">
                                      {candidate.officer.email}
                                    </p>
                                  </div>
                                </div>

                                <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                                  {candidate.distanceMeters !== null
                                    ? `${formatDistanceLabel(candidate.distanceMeters)} · ${Math.max(1, Math.round((candidate.estimatedDurationSeconds ?? 480) / 60))}p`
                                    : `${candidate.activeTaskCount} việc`}
                                </span>
                              </div>

                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                <span
                                  className={`text-[11px] font-medium ${
                                    candidate.shiftStatus === "ON_SHIFT"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {candidate.shiftStatus === "ON_SHIFT"
                                    ? `Đang trong ca (${candidate.activeTaskCount} việc)`
                                    : `Ngoài ca trực (${candidate.activeTaskCount} việc)`}
                                </span>

                                <button
                                  type="button"
                                  disabled={assignOfficerMutation.isPending}
                                  onClick={() =>
                                    void handleDispatchOfficer(
                                      candidate.officer._id,
                                      candidate.officer.fullName,
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  Điều phối dự phòng
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800">
                      Chưa có cán bộ đủ điều kiện trong khu vực này. Bạn có thể
                      mở trang{" "}
                      <Link
                        to="/admin/service-areas"
                        className="font-semibold text-[#047857] underline"
                      >
                        Khu vực phục vụ
                      </Link>{" "}
                      để gán thêm cán bộ.
                    </div>
                  )}
                </div>
              </div>

              {/* 3.5 FOOTER HÀNH ĐỘNG PHỤ (BOTTOM SECONDARY ACTIONS) */}
              <div className="grid grid-cols-2 gap-2.5 border-t border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <Link
                  to={`/admin/reports/${selectedAlert._id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Lịch sử xử lý / Chi tiết</span>
                </Link>

                <button
                  type="button"
                  disabled={
                    isRejectingLocation || selectedAlert.status === "rejected"
                  }
                  onClick={() => void handleRejectInvalidCoordinates()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/70"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    {selectedAlert.status === "rejected"
                      ? "Đã từ chối"
                      : "Báo sai tọa độ / Từ chối"}
                  </span>
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Modal xem toàn bộ ảnh minh chứng từ công dân */}
      {isGalleryModalOpen && selectedAlert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thư viện ảnh phản ánh từ công dân"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsGalleryModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-3xl">
            <div className="mb-2 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold">{selectedAlert.title}</span>
                <Badge variant="secondary" className="text-[11px]">
                  #{selectedAlert._id.slice(-6).toUpperCase()}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGalleryModalOpen(false)}
                className="text-white hover:bg-white/15"
              >
                <X className="mr-1 h-4 w-4" />
                Đóng
              </Button>
            </div>
            <EvidenceGallery
              title="Ảnh phản ánh từ công dân"
              description={selectedAlert.address}
              images={selectedAlert.mediaUrls ?? []}
              emptyMessage="Không có ảnh minh chứng."
            />
          </div>
        </div>
      )}
    </div>
  );
}
