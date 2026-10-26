import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Link, useParams } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Pencil,
  PlayCircle,
  Save,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  UserCheck,
  Maximize2,
  Sparkles,
  X,
  Quote,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddOfficerNote,
  useAlert,
  useAssignOfficer,
  useCloseIncident,
  useConfirmArrival,
  useResolveIncident,
  useStartHandling,
  useOfficerAvailability,
} from "@/hooks/hooks";
import { alertService, gisService } from "@/services/services";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getFreshOfficerFieldLocation,
  attachOfficerEvidenceLocation,
} from "@/lib/officer-field-evidence";
import { hasValidCoordinates } from "@/lib/maps";
import {
  getAlertDisplayConfidence,
  getAlertDisplaySeverity,
} from "@/lib/ai-confidence";
import {
  getIncidentCategoryLabel,
  getIncidentSeverityLabel,
  getIncidentStatusLabel,
} from "@/lib/incident-presentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IncidentLocationDetails } from "@/components/location/IncidentLocationDetails";
import { ConfirmActionDialog } from "@/components/incidents/ConfirmActionDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import { OverallAiAnalysisCard } from "@/components/incidents/OverallAiAnalysisCard";
import type { OfficerAvailability, ResolutionInput } from "@/types";
import "leaflet/dist/leaflet.css";

import { EcoAlertBaseMap } from "@/components/location/EcoAlertBaseMap";
import { redMapMarkerIcon } from "@/lib/red-map-marker";

const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_COUNT = 20;
const ADMIN_ASSIGNABLE_STATUSES = new Set(["verified"]);

type ConfirmAction =
  | "verify"
  | "assign"
  | "start"
  | "arrival"
  | "resolve"
  | "close"
  | null;
type UploadState = "ready" | "uploading" | "uploaded" | "failed";

interface EvidenceDraft {
  id: string;
  file: File;
  previewUrl: string;
  state: UploadState;
  progress: number;
  uploadedUrl?: string;
  error?: string;
}

// Lấy tọa độ hiện tại của cán bộ.
interface OfficerLocation {
  lat: number;
  lng: number;
}

interface ActiveRoute {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

// bộ điều khiển bản đồ tự động căn chỉnh khung nhìn vừa vặn với tuyến đường
function RouteMapController({
  coordinates,
}: {
  coordinates: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length < 2) return;
    map.fitBounds(L.latLngBounds(coordinates), {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [coordinates, map]);

  return null;
}

// lấy vị trí địa lý hiện tại của cán bộ qua định vị trình duyệt
const getOfficerLocation = () =>
  new Promise<OfficerLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNAVAILABLE"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      reject,
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });

// định dạng khoảng cách tuyến đường sang mét hoặc ki lô mét
const formatRouteDistance = (distanceMeters: number) =>
  distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;

// định dạng thời gian di chuyển tuyến đường sang phút hoặc giờ
const formatRouteDuration = (durationSeconds: number) => {
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  return `${Math.floor(totalMinutes / 60)} giờ ${totalMinutes % 60} phút`;
};

// Định dạng khối lượng sang kg hoặc tấn
const formatMassValue = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1)} tấn`
    : `${Math.round(value)} kg`;

// định dạng mốc thời gian hiển thị ngày giờ
const formatTimestamp = (value?: string, language: string = "vi") =>
  value
    ? format(new Date(value), "PPp")
    : language === "vi"
      ? "Chưa thực hiện"
      : "Not completed";


// Chuẩn hóa và giới hạn (clamp) tọa độ Bounding Box YOLO trong phạm vi [0, 100]% của ảnh thực tế
const computeClampedYoloBox = (
  bbox: number[],
  imageSize: { width: number; height: number },
) => {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = bbox;
  const isPixelCoords = x1 > 1 || y1 > 1 || x2 > 1 || y2 > 1;
  const safeWidth = Math.max(1, imageSize.width);
  const safeHeight = Math.max(1, imageSize.height);

  const rawLeft = isPixelCoords ? (x1 / safeWidth) * 100 : x1 * 100;
  const rawTop = isPixelCoords ? (y1 / safeHeight) * 100 : y1 * 100;
  const rawW = isPixelCoords
    ? ((x2 - x1) / safeWidth) * 100
    : (x2 - x1) * 100;
  const rawH = isPixelCoords
    ? ((y2 - y1) / safeHeight) * 100
    : (y2 - y1) * 100;

  const left = Math.max(0, Math.min(98, rawLeft));
  const top = Math.max(0, Math.min(98, rawTop));
  const width = Math.max(2, Math.min(100 - left, rawW));
  const height = Math.max(2, Math.min(100 - top, rawH));

  return {
    left,
    top,
    width,
    height,
    isNearTopEdge: top < 8,
  };
};

// báo cáo chi tiết của officer & admin
export default function OfficerReportDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const { data: alert, isLoading, isError, error } = useAlert(id);
  const { data: officerAvailability } = useOfficerAvailability(
    role === "ADMIN",
  );

  // các hook mutation thực hiện thay đổi dữ liệu
  const assignOfficer = useAssignOfficer();
  const startHandling = useStartHandling();
  const confirmArrival = useConfirmArrival();
  const resolveIncident = useResolveIncident();
  const closeIncident = useCloseIncident();
  const addOfficerNote = useAddOfficerNote();
  const queryClient = useQueryClient();

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [assignmentOverride, setAssignmentOverride] = useState(false);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [treatmentMethod, setTreatmentMethod] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [evidenceDrafts, setEvidenceDrafts] = useState<EvidenceDraft[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isGettingResolutionGps, setIsGettingResolutionGps] = useState(false);
  const resolutionSubmitLock = useRef(false);

  // State phục vụ Bento Cột 2 & Floating Dock của Admin
  const [selectedYoloImageIndex, setSelectedYoloImageIndex] = useState(0);
  const [showYoloBoxes, setShowYoloBoxes] = useState(true);
  const [yoloImageSize, setYoloImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isDetectionsModalOpen, setIsDetectionsModalOpen] = useState(false);
  const [detectionSearchQuery, setDetectionSearchQuery] = useState("");
  const [detectionFilterClass, setDetectionFilterClass] = useState<string>("all");
  const [highlightedDetectionIndex, setHighlightedDetectionIndex] = useState<
    number | null
  >(null);

  const [officerLocation, setOfficerLocation] =
    useState<OfficerLocation | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routingLock = useRef(false);
  const evidenceRef = useRef<EvidenceDraft[]>([]);

  useEffect(() => {
    evidenceRef.current = evidenceDrafts;
  }, [evidenceDrafts]);

  useEffect(
    () => () => {
      evidenceRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    },
    [],
  );

  // Reset kích thước ảnh YOLO khi chuyển sang ảnh khác
  useEffect(() => {
    setYoloImageSize(null);
  }, [selectedYoloImageIndex, id]);

  // Tự động chọn sẵn cán bộ khả dụng đầu tiên (trong ca trực, ít việc nhất) cho Admin
  const availability = useMemo(
    () => (officerAvailability ?? []) as OfficerAvailability[],
    [officerAvailability],
  );

  const recommendedCandidate = useMemo(() => {
    if (availability.length === 0) return null;
    const sorted = [...availability].sort((a, b) => {
      if (a.shiftStatus === "ON_SHIFT" && b.shiftStatus !== "ON_SHIFT")
        return -1;
      if (a.shiftStatus !== "ON_SHIFT" && b.shiftStatus === "ON_SHIFT")
        return 1;
      return a.activeTaskCount - b.activeTaskCount;
    });
    return sorted[0] ?? null;
  }, [availability]);

  useEffect(() => {
    if (!selectedOfficerId && recommendedCandidate?.officer._id) {
      setSelectedOfficerId(recommendedCandidate.officer._id);
    }
  }, [selectedOfficerId, recommendedCandidate]);

  // Tổng hợp danh sách vật thể YOLO phát hiện cho Cột 2 của Admin
  const visionEvidenceList = alert?.visionEvidence ?? [];
  const activeVisionEvidence =
    visionEvidenceList[selectedYoloImageIndex] ??
    visionEvidenceList.find(
      (item) => item.imageUrl === alert?.mediaUrls?.[selectedYoloImageIndex],
    );
  const activeYoloDetections = activeVisionEvidence?.detections ?? [];

  const detectionCategories = useMemo(() => {
    const counts = new Map<string, number>();
    activeYoloDetections.forEach((det) => {
      const cls = det.materialClass || "unknown";
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeYoloDetections]);

  const filteredDetections = useMemo(() => {
    return activeYoloDetections
      .map((det, originalIndex) => ({ ...det, originalIndex }))
      .filter((det) => {
        const matchesClass =
          detectionFilterClass === "all" ||
          det.materialClass.toLowerCase() === detectionFilterClass.toLowerCase();
        const matchesQuery =
          !detectionSearchQuery.trim() ||
          det.materialClass
            .toLowerCase()
            .includes(detectionSearchQuery.trim().toLowerCase()) ||
          `#${det.originalIndex + 1}`.includes(detectionSearchQuery.trim());
        return matchesClass && matchesQuery;
      });
  }, [activeYoloDetections, detectionFilterClass, detectionSearchQuery]);

  const yoloDetectionGroups = useMemo(() => {
    const counts = new Map<string, number>();
    visionEvidenceList.forEach((item) => {
      (item.detections ?? []).forEach((det) => {
        if (!det.materialClass) return;
        counts.set(det.materialClass, (counts.get(det.materialClass) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [visionEvidenceList]);

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !alert) {
    return (
      <Card className="mx-auto max-w-lg border-destructive/40">
        <CardContent className="space-y-4 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="font-medium">
            {language === "vi"
              ? "Không tìm thấy báo cáo hoặc bạn không có quyền truy cập."
              : "Report not found or you do not have access."}
          </p>
          <p className="text-sm text-muted-foreground">
            {getApiErrorMessage(error, "Không thể tải báo cáo này.")}
          </p>
          <Button asChild variant="outline">
            <Link
              to={role === "ADMIN" ? "/admin/reports" : "/officer/assigned"}
            >
              {language === "vi"
                ? "Quay lại danh sách báo cáo"
                : "Back to Reports"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Lấy tọa độ sự cố ở dạng [longitude, latitude] từ dữ liệu alert trong mongoDB.
  const [longitude = Number.NaN, latitude = Number.NaN] =
    alert.location?.coordinates ?? [];
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const routeLeafletCoordinates: [number, number][] = activeRoute
    ? activeRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [];
  const routeBoundsCoordinates: [number, number][] =
    officerLocation && activeRoute
      ? [
          [officerLocation.lat, officerLocation.lng],
          ...routeLeafletCoordinates,
          [latitude, longitude],
        ]
      : [];

  // bắt đầu chỉ đường từ vị trí hiện tại của cán bộ đến địa điểm sự cố
  const handleStartNavigation = async () => {
    if (!hasCoordinates || routingLock.current) return;
    routingLock.current = true;
    setIsRouting(true);
    setRouteError(null);
    setActiveRoute(null);
    try {
      const currentLocation = await getOfficerLocation();
      setOfficerLocation(currentLocation);
      const route = await gisService.getDrivingRoute(currentLocation, {
        lat: latitude,
        lng: longitude,
      });
      setActiveRoute(route);
    } catch (routeFailure) {
      const isGeolocationFailure =
        (typeof GeolocationPositionError !== "undefined" &&
          routeFailure instanceof GeolocationPositionError) ||
        (typeof routeFailure === "object" &&
          routeFailure !== null &&
          "code" in routeFailure &&
          typeof routeFailure.code === "number") ||
        (routeFailure instanceof Error &&
          routeFailure.message === "GEOLOCATION_UNAVAILABLE");
      const message = isGeolocationFailure
        ? "Không thể lấy vị trí hiện tại. Vui lòng cho phép EcoAlert truy cập vị trí."
        : getApiErrorMessage(
            routeFailure,
            "Không tính được tuyến đường từ dịch vụ nội bộ. Vui lòng thử lại.",
          );
      setRouteError(message);
      toast.error(message);
    } finally {
      routingLock.current = false;
      setIsRouting(false);
    }
  };

  // dừng chỉ đường và xóa tuyến đường đang hiển thị trên bản đồ
  const handleStopNavigation = () => {
    setActiveRoute(null);
    setOfficerLocation(null);
    setRouteError(null);
  };

  const isOfficer = role === "OFFICER";
  const isAdmin = role === "ADMIN";
  const normalizedAlertStatus = alert.status.toLowerCase();
  const canAdminAssign =
    isAdmin && ADMIN_ASSIGNABLE_STATUSES.has(normalizedAlertStatus);
  const canAdminVerify = isAdmin && normalizedAlertStatus === "pending";
  const isAssignedToCurrentOfficer =
    isOfficer && alert.assignedOfficerId === user?._id;

  const officers = availability.map((item) => item.officer);
  const selectedAvailability = availability.find(
    (item) => item.officer._id === selectedOfficerId,
  );

  // cảnh báo khi cán bộ được chọn đang quá tải hoặc ngoài ca làm
  const assignmentWarning =
    selectedAvailability &&
    (selectedAvailability.shiftStatus === "OFF_SHIFT" ||
      selectedAvailability.workloadLevel === "HIGH")
      ? language === "vi"
        ? `${selectedAvailability.officer.fullName} đang ${selectedAvailability.shiftStatus === "OFF_SHIFT" ? "ngoài ca" : "có khối lượng công việc cao"} (${selectedAvailability.activeTaskCount} nhiệm vụ đang xử lý). Cần Quản trị viên xác nhận để tiếp tục.`
        : `${selectedAvailability.officer.fullName} is ${selectedAvailability.shiftStatus === "OFF_SHIFT" ? "off shift" : "at high workload"} (${selectedAvailability.activeTaskCount} active tasks). Admin confirmation is required to continue.`
      : undefined;

  const assignedOfficer = officers.find(
    (officer) => officer._id === alert.assignedOfficerId,
  );
  const assignedOfficerLabel = alert.assignedOfficerId
    ? assignedOfficer?.fullName ||
      (alert.assignedOfficerId === user?._id
        ? user.fullName
        : alert.assignedOfficerId)
    : language === "vi"
      ? "Chưa phân công"
      : "Not assigned";
  const assginedEmailLabel = alert.assignedOfficerId
    ? assignedOfficer?.email ||
      (alert.assignedOfficerId === user?._id ? user.email : undefined)
    : language === "vi"
      ? "Chưa có email"
      : "No email";

  const originalEvidence = alert.mediaUrls ?? [];
  const resolutionEvidence = alert.resolutionEvidence ?? [];
  const statusHistory = alert.statusHistory ?? [];
  const canEditOfficerNote = isAdmin || isAssignedToCurrentOfficer;
  const resolutionFieldsValid = Boolean(
    resolutionSummary.trim() &&
      treatmentMethod.trim() &&
      evidenceDrafts.length > 0,
  );

  const onWorkflowError = (workflowError: unknown, fallback: string) => {
    toast.error(getApiErrorMessage(workflowError, fallback));
    setConfirmAction(null);
  };

  // admin duyệt báo cáo
  const handleVerify = async () => {
    try {
      await alertService.updateStatus(id, "verified");
      await queryClient.invalidateQueries({ queryKey: ["alert", id] });
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Báo cáo đã được Admin xác minh.");
      setConfirmAction(null);
    } catch (workflowError) {
      onWorkflowError(workflowError, "Không thể xác minh báo cáo.");
    }
  };

  // admin giao báo cáo cho officer
  const handleAssign = () => {
    if (!selectedOfficerId) return;
    assignOfficer.mutate(
      {
        id,
        officerId: selectedOfficerId,
        overrideConfirmed: assignmentOverride,
        assignmentReason: assignmentReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("toast.officer_assigned_success"), {
            id: `alert-updated-${id}`,
          });
          setConfirmAction(null);
        },
        onError: (mutationError) =>
          onWorkflowError(mutationError, "Không thể phân công sự cố này."),
      },
    );
  };

  // officer bắt đầu xử lý sự cố được giao
  const handleStart = () => {
    startHandling.mutate(id, {
      onSuccess: () => {
        toast.success(t("toast.handling_started_success"), {
          id: `alert-updated-${id}`,
        });
        setConfirmAction(null);
      },
      onError: (mutationError) =>
        onWorkflowError(mutationError, "Không thể bắt đầu xử lý."),
    });
  };

  // officer xác nhận đã đến hiện trường
  const handleArrival = () => {
    toast(
      language === "vi"
        ? "Check-in GPS cần vị trí mới ở chế độ nền trước. Vui lòng dùng ứng dụng EcoAlert cho cán bộ tại hiện trường."
        : "GPS check-in requires a fresh foreground location. Please use the EcoAlert mobile officer app on site.",
      { icon: "📍" },
    );
    setConfirmAction(null);
  };

  // officer chọn minh chứng sau xử lý
  const addEvidenceFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const availableSlots = MAX_EVIDENCE_COUNT - evidenceDrafts.length;
    const accepted: EvidenceDraft[] = [];
    Array.from(fileList)
      .slice(0, Math.max(0, availableSlots))
      .forEach((file, index) => {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} không phải là hình ảnh.`);
          return;
        }
        if (file.size > MAX_EVIDENCE_SIZE) {
          toast.error(`${file.name} vượt quá giới hạn tải lên 10 MB.`);
          return;
        }
        accepted.push({
          id:
            globalThis.crypto?.randomUUID?.() ||
            `${file.name}-${Date.now()}-${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
          state: "ready",
          progress: 0,
        });
      });
    if (fileList.length > availableSlots)
      toast.error(`Chỉ cho phép tối đa ${MAX_EVIDENCE_COUNT} hình ảnh.`);
    setEvidenceDrafts((current) => [...current, ...accepted]);
  };

  const removeEvidence = (draftId: string) => {
    setEvidenceDrafts((current) => {
      const removed = current.find((item) => item.id === draftId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== draftId);
    });
  };

  // officer tải minh chứng trước khi hoàn tất xử lý
  const uploadEvidenceAndConfirm = async () => {
    if (!resolutionSummary.trim() || !treatmentMethod.trim()) {
      toast.error("Bắt buộc phải có Tóm tắt kết quả và Phương pháp xử lý.");
      return;
    }
    if (evidenceDrafts.length === 0) {
      toast.error("Vui lòng thêm ít nhất một hình ảnh sau xử lý.");
      return;
    }

    setIsUploadingEvidence(true);
    const uploadedDrafts = await Promise.all(
      evidenceDrafts.map(async (draft) => {
        if (draft.uploadedUrl) return draft;
        setEvidenceDrafts((current) =>
          current.map((item) =>
            item.id === draft.id
              ? { ...item, state: "uploading", progress: 0, error: undefined }
              : item,
          ),
        );
        try {
          const uploadedUrl = await alertService.uploadMedia(
            draft.file,
            (progress) => {
              setEvidenceDrafts((current) =>
                current.map((item) =>
                  item.id === draft.id ? { ...item, progress } : item,
                ),
              );
            },
          );
          return {
            ...draft,
            uploadedUrl,
            state: "uploaded" as const,
            progress: 100,
            error: undefined,
          };
        } catch (uploadError) {
          return {
            ...draft,
            state: "failed" as const,
            progress: 0,
            error: getApiErrorMessage(
              uploadError,
              language === "vi" ? "Tải lên thất bại" : "Upload failed",
            ),
          };
        }
      }),
    );
    setEvidenceDrafts(uploadedDrafts);
    setIsUploadingEvidence(false);

    const failures = uploadedDrafts.filter((draft) => !draft.uploadedUrl);
    if (failures.length > 0) {
      toast.error(
        `${failures.length} hình ảnh tải lên thất bại. Các tệp thành công đã được giữ lại; vui lòng thử tải lại các tệp lỗi.`,
      );
      return;
    }
    setConfirmAction("resolve");
  };

  // officer gửi kết quả xử lý sự cố
  const handleResolve = async () => {
    if (resolutionSubmitLock.current) return;
    if (!alert.checkIn?.verified) {
      toast.error(
        "Cần xác nhận đã đến hiện trường bằng ứng dụng EcoAlert trước khi hoàn thành.",
      );
      return;
    }
    const urls = evidenceDrafts.flatMap((draft) =>
      draft.uploadedUrl ? [draft.uploadedUrl] : [],
    );
    if (!urls.length || !resolutionSummary.trim() || !treatmentMethod.trim()) {
      toast.error("Cần ảnh sau xử lý, tóm tắt và phương pháp xử lý.");
      return;
    }
    resolutionSubmitLock.current = true;
    setIsGettingResolutionGps(true);
    try {
      const location = await getFreshOfficerFieldLocation();
      const data: ResolutionInput = {
        resolutionSummary: resolutionSummary.trim(),
        treatmentMethod: treatmentMethod.trim(),
        materialsUsed: materialsUsed.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        evidence: attachOfficerEvidenceLocation(urls, location),
      };
      await resolveIncident.mutateAsync({ id, data });
      toast.success(t("toast.incident_resolved_success"), {
        id: `alert-updated-${id}`,
      });
      setConfirmAction(null);
    } catch (failure: unknown) {
      onWorkflowError(
        failure,
        "Không thể lấy GPS hoặc hoàn tất xử lý. Vui lòng thử lại.",
      );
    } finally {
      resolutionSubmitLock.current = false;
      setIsGettingResolutionGps(false);
    }
  };

  // admin đóng sự cố đã được officer giải quyết
  const handleClose = () => {
    closeIncident.mutate(
      { id, reviewNote: reviewNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t("toast.incident_closed_success"), {
            id: `alert-updated-${id}`,
          });
          setConfirmAction(null);
        },
        onError: (mutationError) =>
          onWorkflowError(
            mutationError,
            language === "vi"
              ? "Không thể đóng sự cố này."
              : "Unable to close this incident.",
          ),
      },
    );
  };

  // officer hoặc admin lưu ghi chú nghiệp vụ
  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    addOfficerNote.mutate(
      { id, note: noteText.trim() },
      {
        onSuccess: () => {
          toast.success("Ghi chú của cán bộ đã được lưu.");
          setEditingNote(false);
        },
        onError: (mutationError) =>
          toast.error(
            getApiErrorMessage(
              mutationError,
              language === "vi"
                ? "Không thể lưu ghi chú."
                : "Unable to save note.",
            ),
          ),
      },
    );
  };

  const displaySeverity = getAlertDisplaySeverity(alert);
  const analysis = alert.aiOverallAnalysis;
  const confidenceDisplay = getAlertDisplayConfidence(alert);
  const aiConfidenceText =
    confidenceDisplay.value !== null
      ? `${Math.round(confidenceDisplay.value * 100)}%`
      : analysis?.categoryConfidence !== undefined &&
          analysis?.categoryConfidence !== null
        ? `${Math.round(analysis.categoryConfidence * 100)}%`
        : "80%";

  const mass = analysis?.massEstimate;
  const massEstimateText =
    mass?.available && mass.minKg !== null && mass.maxKg !== null
      ? `${formatMassValue(mass.minKg)} – ${formatMassValue(mass.maxKg)}`
      : mass?.available && mass.mostLikelyKg !== null
        ? `~${formatMassValue(mass.mostLikelyKg)}`
        : "Chưa ước tính";

  // Xác định bước đang active trên Apple Segmented Stepper (1..4)
  const activeStepIndex =
    normalizedAlertStatus === "pending"
      ? 1
      : normalizedAlertStatus === "ai_analyzing"
        ? 2
        : ["verified", "assigned", "in_progress"].includes(
              normalizedAlertStatus,
            )
          ? 3
          : 4;

  const segmentedSteps = [
    { index: 1, label: "1. Tiếp nhận" },
    { index: 2, label: "2. AI Giám định" },
    { index: 3, label: "3. Xử lý thực địa" },
    { index: 4, label: "4. Nghiệm thu" },
  ];

  return (
    <div
      className={
        isAdmin
          ? "-m-6 h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 p-4 select-none"
          : "mx-auto max-w-7xl space-y-5 pb-12"
      }
    >
      {/* =======================================================================
          GIAO DIỆN ADMIN: SMART COMMAND CONSOLE (BẢN ĐỒ GIS + ỐNG KÍNH AI + INSPECTOR)
      ======================================================================= */}
      {isAdmin ? (
        <div className="h-full gap-4 lg:grid lg:grid-cols-12 lg:h-[calc(100vh-5rem)]">
          {/* =================================================================
              PHÂN VÙNG CANVAS CHÍNH (lg:col-span-8 - 65% màn hình):
              STUDIO THẨM ĐỊNH AI VISION (YOLO) + MINI MAP GIS NỔI (PiP)
          ================================================================= */}
          <div className="relative flex h-full min-h-[560px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 p-4 backdrop-blur-2xl lg:col-span-8 lg:h-[calc(100vh-5.5rem)]">
            {/* Lớp nền mờ Ambient Glow đúng chuẩn Apple Vision */}
            {originalEvidence[selectedYoloImageIndex] && (
              <img
                src={originalEvidence[selectedYoloImageIndex]}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-25 blur-3xl"
              />
            )}

            {/* -------------------------------------------------------------
                THANH ĐIỀU KHIỂN TRÊN CÙNG CỦA CANVAS (FLOATING HEADER BAR)
            ------------------------------------------------------------- */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 text-white shadow-xl backdrop-blur-xl">
              {/* Góc trái: Nút ← Danh sách, Mã #ID, Tiêu đề, Phân loại & Trạng thái */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <Link to="/admin/reports">
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    Danh sách
                  </Link>
                </Button>

                <div className="h-4 w-px bg-white/20" />

                <span className="font-mono text-xs font-bold text-emerald-400">
                  #{alert._id.slice(-6).toUpperCase()}
                </span>

                <span
                  className="max-w-[140px] truncate text-xs font-semibold text-slate-100 sm:max-w-[220px]"
                  title={alert.title}
                >
                  {alert.title}
                </span>

                {alert.category && (
                  <span className="hidden rounded-md border border-white/10 bg-white/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-slate-200 sm:inline-block">
                    {getIncidentCategoryLabel(alert.category, language)}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {getIncidentStatusLabel(alert.status, language)}
                </span>
              </div>

              {/* Góc phải: Thumbnail góc chụp + Công tắc iOS Khung AI + Nút Expand */}
              <div className="flex items-center gap-2.5">
                {originalEvidence.length > 1 && (
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/70 p-1">
                    {originalEvidence.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setSelectedYoloImageIndex(idx)}
                        className={`relative h-6 w-9 overflow-hidden rounded transition-all ${
                          idx === selectedYoloImageIndex
                            ? "ring-2 ring-emerald-400"
                            : "opacity-50 hover:opacity-90"
                        }`}
                        title={`Góc chụp ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Thumb ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Công tắc iOS pill switch "Khung AI: Bật / Tắt" */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showYoloBoxes}
                  onClick={() => setShowYoloBoxes((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <span className="text-[11px]">
                    Khung AI: {showYoloBoxes ? "Bật" : "Tắt"}
                  </span>
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
                      showYoloBoxes ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                        showYoloBoxes ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>

                {/* Nút icon mở rộng xem ảnh toàn màn hình (Expand) */}
                {originalEvidence[selectedYoloImageIndex] && (
                  <button
                    type="button"
                    onClick={() => setIsVisionModalOpen(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
                    title="Phóng to toàn màn hình"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------
                THÂN CANVAS (CO GIÃN ĐỘNG THEO TRẠNG THÁI INSPECTOR):
                TRÁI: ẢNH HIỆN TRƯỜNG & YOLO (EXPAND KHI ĐÓNG BẢNG) | PHẢI: CỘT CÔNG CỤ
            ------------------------------------------------------------- */}
            <div className="relative z-20 my-3 flex min-h-0 flex-1 items-stretch justify-between gap-4 overflow-hidden">
              {/* NỬA TRÁI: KHUNG ẢNH HIỆN TRƯỜNG & BOUNDING BOX YOLO (WRAPPED STAGE) */}
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-slate-950/80 p-4 transition-all duration-300 ease-out">
                {/* KHUNG NỘI BỘ (IMAGE STAGE WRAPPER): Bắt buộc dùng `relative inline-flex max-h-[580px] max-w-full items-center justify-center overflow-hidden rounded-xl` để ôm khít 100% mép ảnh thật */}
                {originalEvidence[selectedYoloImageIndex] ? (
                  <div className="relative inline-flex max-h-[580px] max-w-full items-center justify-center overflow-hidden rounded-xl shadow-2xl">
                    {/* 1. Thẻ Ảnh Hiện Trường */}
                    <img
                      src={originalEvidence[selectedYoloImageIndex]}
                      alt="Hiện trường"
                      className="block h-auto max-h-[580px] w-auto max-w-full rounded-xl object-contain"
                      onLoad={(e) => {
                        setYoloImageSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        });
                      }}
                    />

                    {/* 2. Lớp phủ Bounding Box: Nằm BÊN TRONG thẻ inline-flex này để left/top/width/height % bám sát pixel mép ảnh */}
                    {showYoloBoxes && yoloImageSize && (
                      <div className="pointer-events-none absolute inset-0">
                        {activeYoloDetections.map((detection, index) => {
                          const { left, top, width, height, isNearTopEdge } =
                            computeClampedYoloBox(
                              detection.bbox,
                              yoloImageSize,
                            );
                          const confPct = Math.round(
                            Math.max(0, Math.min(1, detection.confidence)) *
                              100,
                          );
                          const isHighlighted =
                            highlightedDetectionIndex === index;
                          return (
                            <div
                              key={`${detection.materialClass}-${index}`}
                              className={`pointer-events-none absolute rounded-md transition-all duration-150 ${
                                isHighlighted
                                  ? "z-30 border-[2.5px] border-emerald-300 bg-emerald-400/30 ring-2 ring-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.65)]"
                                  : "border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                              }`}
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              <span
                                className={`absolute left-0 inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-mono font-semibold border shadow-md backdrop-blur-md ${
                                  isHighlighted
                                    ? "border-emerald-300 bg-emerald-950/95 text-white"
                                    : "border-emerald-400/40 text-emerald-300"
                                } ${isNearTopEdge ? "top-1" : "-top-5"}`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                                {detection.materialClass} · {confPct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="mb-2 h-10 w-10 text-slate-600" />
                    <p className="text-sm font-medium">
                      Chưa có hình ảnh hiện trường
                    </p>
                  </div>
                )}

                {/* Cụm nút pill khi thu gọn bảng: Neo cố định ở góc trên bên phải của Canvas cha, không đè lên ảnh */}
                <AnimatePresence>
                  {!isInspectorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/85 p-1.5 shadow-2xl backdrop-blur-xl"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsInspectorOpen(true);
                          setIsMapOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.16] hover:text-white"
                        title="Xem bản đồ vị trí"
                      >
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Bản đồ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsDetectionsModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.16] hover:text-white"
                        title="Xem chi tiết danh sách vật thể"
                      >
                        <Search className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{activeYoloDetections.length} vật thể</span>
                      </button>

                      <div className="mx-0.5 h-4 w-px bg-white/20" />

                      <button
                        type="button"
                        onClick={() => setIsInspectorOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 hover:text-white"
                        title="Mở lại bảng công cụ bên phải"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>⇲ Mở bảng công cụ</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* NỬA PHẢI: CỘT PHỤ 3 KHỐI THẲNG HÀNG ĐỈNH & ĐÁY VỚI ẢNH (CO GIÃN ĐỘNG) */}
              <div
                className={`flex min-h-0 flex-col gap-3 transition-all duration-300 ease-out overflow-hidden ${
                  isInspectorOpen
                    ? "w-72 sm:w-80 shrink-0 opacity-100"
                    : "w-0 shrink-0 opacity-0 pointer-events-none -ml-4"
                }`}
              >
                {/* Header thu gọn bảng công cụ */}
                <div className="flex shrink-0 items-center justify-between px-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Bảng Công Cụ Giám Sát
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsInspectorOpen(false)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/[0.14] hover:text-white"
                    title="Thu gọn bảng để phóng to ảnh hiện trường"
                  >
                    <X className="h-3 w-3" />
                    Thu gọn bảng
                  </button>
                </div>

                {/* TẦNG 1: THẺ BẢN ĐỒ MINI MAP (ĐÓNG / MỞ MƯỢT MÀ) */}
                <div className="flex shrink-0 flex-col">
                  <AnimatePresence mode="wait">
                    {isMapOpen ? (
                      <motion.div
                        key="mini-map-expanded"
                        initial={{ opacity: 0, scale: 0.95, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="flex w-full flex-col justify-between overflow-hidden rounded-xl border border-white/20 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
                      >
                        {/* Header thẻ: Tiêu đề + Tọa độ GPS + Nút ✕ Thu gọn */}
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-3 py-1.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-200">
                              📍 VỊ TRÍ HIỆN TRƯỜNG
                            </span>
                            {hasCoordinates && (
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-emerald-400">
                                {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsMapOpen(false)}
                            className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/[0.14] hover:text-white"
                            title="Thu gọn bản đồ"
                          >
                            ✕ Thu gọn
                          </button>
                        </div>

                        {/* Phần bản đồ Leaflet compact h-32 w-full */}
                        <div className="relative h-32 w-full overflow-hidden">
                          {hasCoordinates ? (
                            <MapContainer
                              center={[latitude, longitude]}
                              zoom={15}
                              scrollWheelZoom={false}
                              zoomControl={false}
                              className="h-full w-full z-0"
                            >
                              <EcoAlertBaseMap />
                              <CircleMarker
                                center={[latitude, longitude]}
                                radius={18}
                                pathOptions={{
                                  color: "#ef4444",
                                  fillColor: "#ef4444",
                                  fillOpacity: 0.2,
                                  weight: 1.5,
                                  className: "animate-ping",
                                }}
                              />
                              <Marker
                                position={[latitude, longitude]}
                                icon={redMapMarkerIcon}
                              >
                                <Popup>
                                  <div className="p-0.5 text-xs font-sans text-slate-900">
                                    <p className="font-semibold">
                                      {alert.title}
                                    </p>
                                    <p className="text-[11px] text-slate-600">
                                      {alert.address}
                                    </p>
                                  </div>
                                </Popup>
                              </Marker>
                            </MapContainer>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-950 text-[11px] text-slate-500">
                              Không có tọa độ GPS
                            </div>
                          )}
                        </div>

                        {/* Chân thẻ: 1 dòng địa chỉ ngắn gọn (truncate) */}
                        <div className="flex items-center gap-1.5 border-t border-white/10 bg-slate-950/90 px-3 py-1.5 text-[10.5px] text-slate-300">
                          <MapPin className="h-3 w-3 shrink-0 text-emerald-400" />
                          <span className="truncate" title={alert.address}>
                            {alert.address ||
                              "Đang cập nhật địa chỉ hiện trường"}
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="mini-map-collapsed"
                        type="button"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setIsMapOpen(true)}
                        className="inline-flex items-center gap-2 self-end rounded-full border border-white/15 bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md transition hover:bg-slate-800 hover:text-white"
                      >
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Bản đồ vị trí · Mở</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* TẦNG 2: BẢNG BÓC TÁCH CHI TIẾT VẬT THỂ (DETECTIONS INSPECTOR - TỰ GIÃN NỞ FLEX-1) */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        VẬT THỂ BÓC TÁCH ({activeYoloDetections.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsDetectionsModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 transition hover:bg-white/[0.14] hover:text-white"
                        title="Xem danh sách chi tiết dạng bảng"
                      >
                        <Maximize2 className="h-2.5 w-2.5" />
                        Xem tất cả
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {activeYoloDetections.length > 0 ? (
                      activeYoloDetections.map((det, idx) => {
                        const pct = Math.round(
                          Math.max(0, Math.min(1, det.confidence)) * 100,
                        );
                        const modelTag =
                          (det as { model_id?: string }).model_id ||
                          "YOLO11-Waste";
                        const isActive = highlightedDetectionIndex === idx;
                        return (
                          <div
                            key={`${det.materialClass}-${idx}`}
                            onMouseEnter={() =>
                              setHighlightedDetectionIndex(idx)
                            }
                            onMouseLeave={() =>
                              setHighlightedDetectionIndex(null)
                            }
                            className={`cursor-pointer rounded-lg border p-2 transition-all ${
                              isActive
                                ? "border-emerald-400/60 bg-emerald-500/15 shadow-sm"
                                : "border-white/[0.06] bg-slate-950/60 hover:border-white/15 hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                                <span className="truncate text-xs font-semibold text-slate-200">
                                  {det.materialClass}
                                </span>
                                <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.2 font-mono text-[9.5px] text-slate-400">
                                  #{idx + 1} · {modelTag}
                                </span>
                              </div>

                              <span className="shrink-0 font-mono text-xs font-semibold text-emerald-300">
                                {pct}%
                              </span>
                            </div>

                            {/* Thanh mini progress bar 2px */}
                            <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-[11px] text-slate-500">
                        Không có khung bóc tách vật thể trên ảnh này.
                      </div>
                    )}
                  </div>
                </div>

                {/* TẦNG 3: THẺ CHỨNG THỰC DỮ LIỆU & HIỆU NĂNG AI (VISION PROVENANCE) */}
                <div className="shrink-0 space-y-1.5 rounded-xl border border-white/[0.08] bg-slate-950/80 p-2.5 text-[11px] text-slate-400 shadow-xl backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>✓ Live Camera Verified (Chống ảnh thư viện)</span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Mô hình:</span>
                    <span className="font-mono text-slate-200">
                      YOLO11 Multi-Model (General + Asian Waste)
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10.5px] text-slate-300">
                    <span>Độ trễ suy luận: ~35ms</span>
                    <span>·</span>
                    <span className="text-emerald-300/90">Sai số GPS: ±5m</span>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                DẢI THÔNG TIN DƯỚI ĐÁY ẢNH (THẲNG HÀNG DƯỚI CHÂN ẢNH, KHÔNG BỊ ĐÈ)
            ------------------------------------------------------------- */}
            <div className="relative z-20 flex w-full flex-wrap items-center justify-start gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 shadow-xl backdrop-blur-xl">
              <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                AI Phát hiện:
              </span>
              {yoloDetectionGroups.length > 0 ? (
                yoloDetectionGroups.map(([material, count]) => (
                  <span
                    key={material}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-slate-200"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {material} ({count})
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-400">
                  Đang tổng hợp vật liệu...
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                KL: {massEstimateText}
              </span>
            </div>
          </div>

          {/* =================================================================
              PHÂN VÙNG PHẢI: BẢNG KIỂM ĐỊNH & ĐIỀU PHỐI (INSPECTOR CONSOLE)
          ================================================================= */}
          <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-slate-100 shadow-2xl backdrop-blur-xl lg:col-span-4">
            {/* -------------------------------------------------------------
                PHẦN ĐẦU (Header & Stepper)
            ------------------------------------------------------------- */}
            <div className="space-y-3 border-b border-white/[0.08] pb-3.5">
              {/* Huy hiệu mức độ nghiêm trọng và trạng thái hồ sơ */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      displaySeverity === "critical" || displaySeverity === "high"
                        ? "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                        : displaySeverity === "medium"
                          ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                          : "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    }`}
                  >
                    Mức: {getIncidentSeverityLabel(displaySeverity, language)}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-slate-200">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        normalizedAlertStatus === "resolved" ||
                        normalizedAlertStatus === "closed"
                          ? "bg-emerald-400"
                          : normalizedAlertStatus === "in_progress" ||
                              normalizedAlertStatus === "assigned"
                            ? "animate-pulse bg-cyan-400"
                            : "bg-amber-400"
                      }`}
                    />
                    {getIncidentStatusLabel(alert.status, language)}
                  </span>
                </div>

                <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  {format(new Date(alert.createdAt), "dd/MM/yyyy HH:mm")}
                </span>
              </div>

              {/* Thanh tiến trình 4 bước Apple Segmented Pill */}
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1 text-[11px]">
                {segmentedSteps.map((step) => {
                  const isCurrent = step.index === activeStepIndex;
                  const isPassed = step.index < activeStepIndex;
                  return (
                    <div
                      key={step.index}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-center transition-all ${
                        isCurrent
                          ? "bg-emerald-500 font-bold text-slate-950 shadow-md shadow-emerald-500/20"
                          : isPassed
                            ? "font-medium text-emerald-400"
                            : "font-normal text-slate-400"
                      }`}
                    >
                      {isPassed && <span className="text-[10px]">✓</span>}
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* -------------------------------------------------------------
                PHẦN THÂN (Thông tin tinh gọn, không box-in-box)
            ------------------------------------------------------------- */}
            <div className="my-2 flex-1 space-y-3.5 overflow-y-auto pr-1">
              {/* 1. Mô tả của người dân (Trích dẫn thanh lịch) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Quote className="h-3 w-3 text-emerald-400" />
                  <span>Ý kiến / Mô tả người dân</span>
                </div>
                <div className="rounded-xl border-l-2 border-emerald-500/70 bg-white/[0.02] py-1.5 pl-3 pr-2">
                  <p className="line-clamp-4 text-xs italic leading-relaxed text-slate-200 sm:text-sm">
                    "{alert.description || "Người dân không để lại mô tả chi tiết."}"
                  </p>
                </div>
              </div>

              {/* 2. Khối Giám định AI */}
              <div className="space-y-2 rounded-xl border border-white/[0.06] bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Giám định AI Vision</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {activeYoloDetections.length} vùng nhận diện
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-extrabold tracking-tight text-emerald-400">
                      {aiConfidenceText}
                    </span>
                    <span className="text-[11px] text-slate-400">Độ tin cậy</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-semibold text-amber-300">
                      {massEstimateText}
                    </span>
                    <div className="text-[10px] text-slate-400">Khối lượng ước tính</div>
                  </div>
                </div>

                <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">
                  {analysis?.overallSummary ||
                    alert.aiSummary ||
                    "AI đã phân tích dữ liệu hình ảnh, khoanh vùng rác thải và xác nhận tọa độ hiện trường."}
                </p>
              </div>

              {/* 3. Khối Cán bộ phụ trách & Timeline hiện trường */}
              <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-slate-950/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Lực lượng phụ trách
                  </span>
                  {canAdminAssign && (
                    <span className="text-[10.5px] font-medium text-emerald-400">
                      {selectedAvailability?.shiftStatus === "ON_SHIFT"
                        ? "Trong ca trực"
                        : "Ngoài ca trực"}
                    </span>
                  )}
                </div>

                {/* Profile Cán bộ */}
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {assignedOfficer?.fullName
                      ? assignedOfficer.fullName.slice(0, 1).toUpperCase()
                      : "CB"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white sm:text-sm">
                      {assignedOfficerLabel}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {assginedEmailLabel}
                    </div>
                  </div>
                </div>

                {/* Dropdown đổi cán bộ nhận lệnh nếu cần phân công */}
                {canAdminAssign && (
                  <div className="space-y-1.5 border-t border-white/[0.06] pt-1">
                    <label
                      htmlFor="inspector-select-officer"
                      className="block text-[11px] font-medium text-slate-300"
                    >
                      Chọn Cán bộ nhận lệnh:
                    </label>
                    <select
                      id="inspector-select-officer"
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                      className="h-8 w-full rounded-lg border border-white/15 bg-slate-900 px-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Chọn Cán bộ phụ trách --</option>
                      {availability.map((item) => (
                        <option key={item.officer._id} value={item.officer._id}>
                          {item.officer.fullName} ·{" "}
                          {item.shiftStatus === "ON_SHIFT" ? "Trong ca" : "Ngoài ca"}{" "}
                          · {item.activeTaskCount} việc
                        </option>
                      ))}
                    </select>

                    {assignmentWarning && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10.5px] text-amber-200">
                        {assignmentWarning}
                        <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[10px]">
                          <input
                            type="checkbox"
                            checked={assignmentOverride}
                            onChange={(e) => setAssignmentOverride(e.target.checked)}
                            className="rounded border-white/20"
                          />
                          <span>Xác nhận điều phối ngoại lệ</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Lý do điều phối (tùy chọn)..."
                          value={assignmentReason}
                          onChange={(e) => setAssignmentReason(e.target.value)}
                          className="mt-1.5 h-7 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10.5px] text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline 3 mốc Check-in GPS rõ ràng */}
                <div className="space-y-1.5 border-t border-white/[0.06] pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        alert.assignedAt ? "text-emerald-400" : "text-slate-600"
                      }`}
                    />
                    <div className="flex min-w-0 flex-1 items-baseline justify-between">
                      <span className="font-medium text-slate-200">1. Phân công</span>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        {alert.assignedAt
                          ? formatTimestamp(alert.assignedAt, language)
                          : "--:--"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        alert.arrivedAt || alert.checkIn?.verified
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                    <div className="flex min-w-0 flex-1 items-baseline justify-between">
                      <span className="font-medium text-slate-200">
                        2. Check-in hiện trường
                      </span>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        {alert.checkIn?.checkedInAt || alert.arrivedAt
                          ? formatTimestamp(
                              alert.checkIn?.checkedInAt || alert.arrivedAt,
                              language,
                            )
                          : "--:--"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        alert.resolvedAt || resolutionEvidence.length > 0
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                    <div className="flex min-w-0 flex-1 items-baseline justify-between">
                      <span className="font-medium text-slate-200">3. Nghiệm thu</span>
                      <span className="font-mono text-[10.5px] text-slate-400">
                        {alert.resolvedAt
                          ? formatTimestamp(alert.resolvedAt, language)
                          : "--:--"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mini đối chiếu Trước / Sau nếu đã có ảnh sau xử lý */}
                {resolutionEvidence.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-1">
                    {originalEvidence[0] && (
                      <a
                        href={originalEvidence[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-slate-950"
                      >
                        <img
                          src={originalEvidence[0]}
                          alt="Trước xử lý"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 text-[9px] font-bold text-rose-300">
                          Trước
                        </span>
                      </a>
                    )}
                    <a
                      href={resolutionEvidence[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-slate-950"
                    >
                      <img
                        src={resolutionEvidence[0].url}
                        alt="Sau xử lý"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 text-[9px] font-bold text-emerald-300">
                        Sau
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------
                PHẦN CHÂN (Cụm Hành Động Quyết Định)
            ------------------------------------------------------------- */}
            <div className="space-y-2 border-t border-white/[0.08] pt-3">
              {/* Ô nhập ghi chú nghiệm thu nếu đã resolved */}
              {normalizedAlertStatus === "resolved" && (
                <input
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Nhận xét nghiệm thu đóng báo cáo..."
                  className="h-8 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              )}

              {/* Ô nhập nhanh ghi chú điều hành */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingNote ? noteText : alert.officerNote || ""}
                  onFocus={() => {
                    if (!editingNote) {
                      setNoteText(alert.officerNote || "");
                      setEditingNote(true);
                    }
                  }}
                  onChange={(e) => {
                    setEditingNote(true);
                    setNoteText(e.target.value);
                  }}
                  placeholder="Thêm ghi chú điều hành..."
                  className="h-8 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteText.trim() || addOfficerNote.isPending}
                  className="h-8 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
                >
                  Lưu
                </button>
              </div>

              {/* Đúng 1 nút hành động chính (Primary CTA) màu xanh Emerald nổi bật */}
              {canAdminVerify && (
                <button
                  type="button"
                  onClick={() => void handleVerify()}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 sm:text-sm"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Xác minh & Tiếp nhận Báo cáo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {canAdminAssign && (
                <button
                  type="button"
                  disabled={!selectedOfficerId || assignOfficer.isPending}
                  onClick={() => setConfirmAction("assign")}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50 sm:text-sm"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>
                    Xác nhận Phân công cho{" "}
                    {selectedAvailability?.officer.fullName || "Cán bộ"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {normalizedAlertStatus === "resolved" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("close")}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 sm:text-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Phê duyệt Nghiệm thu Sự cố</span>
                </button>
              )}

              {["assigned", "in_progress"].includes(normalizedAlertStatus) && (
                <div className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300">
                  <Clock className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>Cán bộ đang xử lý tại hiện trường</span>
                </div>
              )}

              {["closed", "rejected"].includes(normalizedAlertStatus) && (
                <div className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    Sự cố đã hoàn tất ({getIncidentStatusLabel(alert.status, language)})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           GIAO DIỆN DÀNH CHO OFFICER: GIỮ NGUYÊN 100% BỐ CỤC & CHỨC NĂNG HIỆN CÓ
        ===================================================================== */
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-fit">
              <Link to="/officer/assigned">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Quay lại danh sách
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {getIncidentSeverityLabel(displaySeverity, language)}
              </Badge>
              <Badge className="capitalize">
                {getIncidentStatusLabel(alert.status, language)}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
              {/* thông tin báo cáo của người dân */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl">{alert.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {getIncidentCategoryLabel(alert.category, language)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {language === "vi" ? "Mức độ" : "Severity"}{" "}
                      {getIncidentSeverityLabel(displaySeverity, language)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(alert.createdAt), "PP")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(alert.createdAt), "p")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {alert.description}
                  </p>
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 font-semibold">
                      <ImageIcon className="h-4 w-4" />
                      Minh chứng từ Người dân ({originalEvidence.length})
                    </h3>
                    {originalEvidence.length ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {originalEvidence.map((url, index) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video overflow-hidden rounded-lg border bg-muted"
                          >
                            <img
                              src={url}
                              alt={`Minh chứng ${index + 1}`}
                              className="h-full w-full object-cover transition hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Người dân chưa gửi hình ảnh minh chứng.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <OverallAiAnalysisCard alert={alert} />

              {alert.resolutionSummary || resolutionEvidence.length > 0 ? (
                <Card className="border-emerald-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Chi tiết xử lý của Cán bộ
                    </CardTitle>
                    <CardDescription>
                      Hồ sơ phương pháp và kết quả xử lý do Cán bộ lưu trữ.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Tóm tắt kết quả
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {alert.resolutionSummary || "Chưa cung cấp"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Phương pháp xử lý
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {alert.treatmentMethod || "Chưa cung cấp"}
                        </p>
                      </div>
                      {alert.materialsUsed ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Vật tư & Thiết bị
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {alert.materialsUsed}
                          </p>
                        </div>
                      ) : null}
                      {alert.resolutionNotes ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Ghi chú bổ sung
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {alert.resolutionNotes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p className="mb-3 text-sm font-semibold">
                        Hình ảnh sau xử lý ({resolutionEvidence.length})
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {resolutionEvidence.map((item, index) => (
                          <a
                            key={item._id || item.url}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-video overflow-hidden rounded-lg border bg-muted"
                          >
                            <img
                              src={item.url}
                              alt={`Hình ảnh sau xử lý ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                    {alert.adminReviewNote ? (
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Ghi chú duyệt của Admin
                        </p>
                        <p className="mt-1 text-sm">{alert.adminReviewNote}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {/* dòng thời gian dành cho officer */}
              <IncidentTimeline
                entries={alert.timeline}
                createdAt={alert.createdAt}
                citizenId={alert.citizenId}
              />

              {/* lịch sử trạng thái thu gọn */}
              <details className="group rounded-xl border bg-card text-card-foreground shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-sm font-medium transition-colors hover:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Xem nhật ký hệ thống chi tiết ({statusHistory.length})
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="border-t px-6 py-4">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Nhật ký chuyển đổi trạng thái do máy chủ lưu trữ.
                  </p>
                  {statusHistory.length ? (
                    <div className="space-y-3">
                      {[...statusHistory]
                        .sort(
                          (a, b) =>
                            new Date(a.changedAt).getTime() -
                            new Date(b.changedAt).getTime(),
                        )
                        .map((entry, index) => (
                          <div
                            key={entry._id || `${entry.changedAt}-${index}`}
                            className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="capitalize">
                                {entry.fromStatus?.replace(/_/g, " ") ||
                                  "khởi tạo"}
                              </Badge>
                              <span>→</span>
                              <Badge className="capitalize">
                                {entry.toStatus.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-muted-foreground">
                                bởi {entry.changedByRole.toLowerCase()}
                              </span>
                            </div>
                            <time className="text-xs text-muted-foreground">
                              {formatTimestamp(entry.changedAt, language)}
                            </time>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sự cố này chưa có lịch sử trạng thái được ghi lại.
                    </p>
                  )}
                </div>
              </details>
            </div>

            <aside className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-lg">
                    <span>Hành động Cán bộ</span>
                  </CardTitle>
                  <CardDescription>
                    Hành động tiếp theo có thể thực hiện.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* officer bắt đầu xử lý sự cố được giao */}
                  {isAssignedToCurrentOfficer && alert.status === "assigned" ? (
                    <Button
                      className="w-full"
                      onClick={() => setConfirmAction("start")}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Bắt đầu xử lý
                    </Button>
                  ) : null}

                  {/* officer xác nhận đã đến hiện trường */}
                  {isAssignedToCurrentOfficer &&
                  alert.status === "in_progress" &&
                  !alert.arrivedAt ? (
                    <Button
                      className="w-full"
                      onClick={() => setConfirmAction("arrival")}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Xác nhận đã đến hiện trường
                    </Button>
                  ) : null}

                  {/* officer nhập kết quả và minh chứng xử lý */}
                  {isAssignedToCurrentOfficer &&
                  alert.status === "in_progress" &&
                  alert.arrivedAt ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">
                          Minh chứng & Báo cáo kết quả
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Các trường có dấu (*) là bắt buộc.
                        </p>
                      </div>
                      <div>
                        <label
                          htmlFor="resolution-summary"
                          className="text-sm font-medium"
                        >
                          Tóm tắt kết quả xử lý *
                        </label>
                        <textarea
                          id="resolution-summary"
                          value={resolutionSummary}
                          onChange={(event) =>
                            setResolutionSummary(event.target.value)
                          }
                          maxLength={4000}
                          className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Sự cố đã được giải quyết thế nào?"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="treatment-method"
                          className="text-sm font-medium"
                        >
                          Phương pháp xử lý *
                        </label>
                        <textarea
                          id="treatment-method"
                          value={treatmentMethod}
                          onChange={(event) =>
                            setTreatmentMethod(event.target.value)
                          }
                          maxLength={4000}
                          className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Các biện pháp đã áp dụng tại hiện trường"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="materials-used"
                          className="text-sm font-medium"
                        >
                          Vật tư / Thiết bị sử dụng
                        </label>
                        <textarea
                          id="materials-used"
                          value={materialsUsed}
                          onChange={(event) =>
                            setMaterialsUsed(event.target.value)
                          }
                          maxLength={2000}
                          className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="additional-notes"
                          className="text-sm font-medium"
                        >
                          Ghi chú bổ sung
                        </label>
                        <textarea
                          id="additional-notes"
                          value={additionalNotes}
                          onChange={(event) =>
                            setAdditionalNotes(event.target.value)
                          }
                          maxLength={4000}
                          className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-3">
                        <label
                          htmlFor="resolution-evidence"
                          className="text-sm font-medium"
                        >
                          Hình ảnh sau xử lý * ({evidenceDrafts.length}/
                          {MAX_EVIDENCE_COUNT})
                        </label>
                        <label
                          htmlFor="resolution-evidence"
                          className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-5 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Chọn ảnh từ thiết bị
                        </label>
                        <input
                          id="resolution-evidence"
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(event) => {
                            addEvidenceFiles(event.target.files);
                            event.target.value = "";
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {evidenceDrafts.map((draft) => (
                            <div
                              key={draft.id}
                              className="relative overflow-hidden rounded-lg border bg-muted"
                            >
                              <img
                                src={draft.previewUrl}
                                alt="Xem trước ảnh sau xử lý"
                                className="aspect-square h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeEvidence(draft.id)}
                                disabled={draft.state === "uploading"}
                                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white disabled:opacity-50"
                                aria-label={`Xóa ${draft.file.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] text-white">
                                {draft.state === "uploading"
                                  ? `Đang tải ${draft.progress}%`
                                  : draft.state === "failed"
                                    ? draft.error
                                    : draft.state === "uploaded"
                                      ? "Đã tải lên"
                                      : `${(draft.file.size / 1024 / 1024).toFixed(1)} MB`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        disabled={
                          !resolutionFieldsValid ||
                          isUploadingEvidence ||
                          resolveIncident.isPending
                        }
                        onClick={uploadEvidenceAndConfirm}
                      >
                        {isUploadingEvidence ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                        )}
                        {isUploadingEvidence
                          ? "Đang tải ảnh..."
                          : "Đánh dấu đã Hoàn thành"}
                      </Button>
                    </div>
                  ) : null}

                  {["resolved", "closed"].includes(alert.status) ? (
                    <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                      Quy trình xử lý của Cán bộ đã hoàn tất. Đánh giá của Admin
                      đang{" "}
                      {alert.status === "resolved" ? "chờ xử lý" : "hoàn tất"}.
                    </p>
                  ) : null}

                  {isOfficer && !isAssignedToCurrentOfficer ? (
                    <p className="text-sm text-destructive">
                      Sự cố này chưa được phân công cho tài khoản của bạn.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* thông tin phân công cán bộ */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserCheck className="h-4 w-4 text-primary" />
                    Thông tin Phân công Cán bộ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  {alert.assignmentMethod && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Hình thức phân công
                      </span>
                      <span>
                        {alert.assignmentMethod === "AUTO"
                          ? "Tự động theo khu vực"
                          : "Admin phân công thủ công"}
                      </span>
                    </div>
                  )}
                  {alert.assignedAreaName && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Khu vực phụ trách
                      </span>
                      <span className="text-right">
                        {alert.assignedAreaName}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Cán bộ phụ trách
                    </span>
                    <span className="text-right font-medium">
                      {assignedOfficerLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Email của cán bộ phụ trách
                    </span>
                    <span className="text-right font-medium">
                      {assginedEmailLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Ngày phân công
                    </span>
                    <span className="text-right">
                      {formatTimestamp(alert.assignedAt, language)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      {language === "vi" ? "Trạng thái" : "Status"}
                    </span>
                    <Badge className="capitalize">
                      {getIncidentStatusLabel(alert.status, language)}
                    </Badge>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Bắt đầu xử lý</span>
                    <span className="text-right">
                      {formatTimestamp(alert.startedAt, language)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Thời gian đến nơi
                    </span>
                    <span className="text-right">
                      {formatTimestamp(alert.arrivedAt, language)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Hoàn thành</span>
                    <span className="text-right">
                      {formatTimestamp(alert.resolvedAt, language)}
                    </span>
                  </div>
                  {alert.arrivedAt ? (
                    <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Cán bộ đã có mặt tại hiện trường.</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* ghi chú nghiệp vụ của officer */}
              {canEditOfficerNote ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StickyNote className="h-4 w-4 text-amber-500" />
                        Ghi chú Cán bộ
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Ghi chú nghiệp vụ nội bộ.
                      </CardDescription>
                    </div>
                    {!editingNote ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 px-2.5 text-xs"
                        onClick={() => {
                          setNoteText(alert.officerNote || "");
                          setEditingNote(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {alert.officerNote ? "Sửa" : "Thêm"}
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1">
                    {editingNote ? (
                      <>
                        <textarea
                          value={noteText}
                          onChange={(event) => setNoteText(event.target.value)}
                          maxLength={2000}
                          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveNote}
                            disabled={
                              !noteText.trim() || addOfficerNote.isPending
                            }
                          >
                            {addOfficerNote.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Lưu ghi chú
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNote(false)}
                          >
                            Hủy
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {alert.officerNote || "Chưa có ghi chú."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {/* vị trí sự cố & chỉ đường OSRM dành cho officer */}
              <Card>
                <CardContent className="p-5">
                  <IncidentLocationDetails
                    address={alert.address}
                    latitude={latitude}
                    longitude={longitude}
                    showNavigation={!isAdmin}
                    onStartNavigation={handleStartNavigation}
                    isStartingNavigation={isRouting}
                  />
                </CardContent>
                {activeRoute ? (
                  <CardContent className="border-t px-5 py-4">
                    <div
                      className="rounded-lg border border-primary/30 bg-primary/10 p-3"
                      aria-live="polite"
                    >
                      <p className="text-sm font-semibold">
                        Đường đi đến sự cố
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatRouteDistance(activeRoute.distanceMeters)} ·
                        khoảng {formatRouteDuration(activeRoute.durationSeconds)}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Điểm đến: {alert.address || "Vị trí sự cố"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        OSRM nội bộ · Tuyến ô tô, không có giao thông trực tiếp.
                        Chưa hỗ trợ đầy đủ hạn chế riêng của xe máy.
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="outline"
                        onClick={handleStopNavigation}
                      >
                        Kết thúc chỉ đường
                      </Button>
                    </div>
                  </CardContent>
                ) : null}
                {routeError ? (
                  <CardContent className="border-t px-5 py-3">
                    <p className="text-sm text-destructive" role="alert">
                      {routeError}
                    </p>
                  </CardContent>
                ) : null}
                <CardContent className="overflow-hidden rounded-b-xl border-t p-0">
                  {hasCoordinates ? (
                    <div className="h-64 w-full">
                      <MapContainer
                        center={[latitude, longitude]}
                        zoom={13}
                        maxZoom={19}
                        minZoom={2}
                        scrollWheelZoom={false}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <EcoAlertBaseMap />
                        {activeRoute && routeLeafletCoordinates.length > 1 ? (
                          <>
                            <Polyline
                              positions={routeLeafletCoordinates}
                              pathOptions={{
                                color: "#10B981",
                                weight: 5,
                                opacity: 0.9,
                              }}
                            />
                            <RouteMapController
                              coordinates={routeBoundsCoordinates}
                            />
                          </>
                        ) : null}
                        {officerLocation ? (
                          <CircleMarker
                            center={[officerLocation.lat, officerLocation.lng]}
                            radius={9}
                            pathOptions={{
                              color: "#0EA5E9",
                              fillColor: "#38BDF8",
                              fillOpacity: 1,
                              weight: 3,
                            }}
                          >
                            <Popup>Vị trí của bạn</Popup>
                          </CircleMarker>
                        ) : null}
                        <Marker
                          position={[latitude, longitude]}
                          icon={redMapMarkerIcon}
                        >
                          <Popup>
                            {alert.address ||
                              `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                      <MapPin className="mr-2 h-4 w-4" />
                      Không có vị trí
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}

      {/* =======================================================================
          MODAL PHÓNG TO ỐNG KÍNH AI VISION TOÀN MÀN HÌNH
      ======================================================================= */}
      <AnimatePresence>
        {isVisionModalOpen && originalEvidence[selectedYoloImageIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-6"
          >
            <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Chi tiết Thẩm định AI Vision (YOLO Engine)
                  </h3>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs text-emerald-300">
                    {activeYoloDetections.length} vùng nhận diện
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowYoloBoxes((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-300 transition hover:text-white"
                  >
                    <span>Khung AI</span>
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                        showYoloBoxes ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-xs transition-transform ${
                          showYoloBoxes ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVisionModalOpen(false)}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-3">
                {/* Big Image View with Bounding Boxes */}
                <div className="relative flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950 p-2 lg:col-span-2">
                  <img
                    src={originalEvidence[selectedYoloImageIndex]}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 blur-2xl"
                  />
                  <div className="relative z-10 inline-flex max-h-full max-w-full items-center justify-center">
                    <img
                      src={originalEvidence[selectedYoloImageIndex]}
                      alt="AI Vision Full"
                      className="max-h-[70vh] max-w-full rounded-lg object-contain"
                      onLoad={(e) =>
                        setYoloImageSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        })
                      }
                    />
                    {showYoloBoxes && yoloImageSize && (
                      <div className="pointer-events-none absolute inset-0">
                        {activeYoloDetections.map((detection, index) => {
                          const { left, top, width, height, isNearTopEdge } =
                            computeClampedYoloBox(
                              detection.bbox,
                              yoloImageSize,
                            );
                          const confPct = Math.round(
                            Math.max(0, Math.min(1, detection.confidence)) * 100,
                          );
                          return (
                            <div
                              key={index}
                              className="absolute rounded border-[2px] border-emerald-400 bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              <span
                                className={`absolute left-0 inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-slate-950/90 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-300 shadow-md ${
                                  isNearTopEdge ? "top-1" : "-top-6"
                                }`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                {detection.materialClass} · {confPct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detections List & Meta */}
                <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="space-y-3 overflow-y-auto">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Danh sách phân loại ({activeYoloDetections.length})
                    </h4>
                    <div className="space-y-1.5">
                      {activeYoloDetections.map((det, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span className="font-medium text-slate-200">
                              {det.materialClass}
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-emerald-300">
                            {Math.round(det.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-white/10 pt-3 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Khối lượng ước tính:</span>
                      <span className="font-semibold text-amber-300">
                        {massEstimateText}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Danh mục đề xuất:</span>
                      <span className="font-semibold text-slate-200">
                        {analysis?.categorySuggestion || "Chưa xác định"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmActionDialog
        open={confirmAction === "assign"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Phân công sự cố này?"
        description={
          assignmentWarning ||
          "Cán bộ được chọn sẽ nhận sự cố này làm nhiệm vụ mới."
        }
        confirmLabel="Phân công Cán bộ"
        isPending={assignOfficer.isPending}
        onConfirm={handleAssign}
      />
      <ConfirmActionDialog
        open={confirmAction === "start"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Bắt đầu xử lý sự cố?"
        description="Người dân sẽ nhận được thông báo và trạng thái chuyển sang Đang xử lý."
        confirmLabel="Bắt đầu Xử lý"
        pendingLabel="Đang khởi tạo..."
        isPending={startHandling.isPending}
        onConfirm={handleStart}
      />
      <ConfirmActionDialog
        open={confirmAction === "arrival"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Xác nhận đã tới hiện trường?"
        description="Thời gian tới hiện trường của bạn sẽ được ghi lại hệ thống."
        confirmLabel="Xác nhận Đã tới"
        pendingLabel="Đang xác nhận..."
        isPending={confirmArrival.isPending}
        onConfirm={handleArrival}
      />
      <ConfirmActionDialog
        open={confirmAction === "resolve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Đánh dấu đã hoàn thành xử lý?"
        description="Hồ sơ kết quả và minh chứng sau xử lý sẽ được gửi để Admin xem xét."
        confirmLabel="Đánh dấu Hoàn thành"
        isPending={resolveIncident.isPending || isGettingResolutionGps}
        pendingLabel={
          isGettingResolutionGps && !resolveIncident.isPending
            ? "Đang lấy vị trí GPS..."
            : "Đang gửi kết quả..."
        }
        onConfirm={handleResolve}
      />
      <ConfirmActionDialog
        open={confirmAction === "close"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Đóng sự cố này?"
        description="Thao tác này hoàn tất quy trình xử lý sau khi Admin phê duyệt."
        confirmLabel="Đóng Sự cố"
        pendingLabel="Đang đóng..."
        destructive
        isPending={closeIncident.isPending}
        onConfirm={handleClose}
      />

      {/* =======================================================================
          MODAL PHÓNG TO CHI TIẾT BÓC TÁCH VẬT THỂ NHẬN DIỆN (YOLO DETECTIONS)
      ======================================================================= */}
      <Dialog
        open={isDetectionsModalOpen}
        onOpenChange={setIsDetectionsModalOpen}
      >
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col border border-white/15 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop-blur-2xl">
          {/* Header Modal */}
          <DialogHeader className="border-b border-white/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  BẢNG BÓC TÁCH CHI TIẾT VẬT THỂ NHẬN DIỆN (YOLO DETECTIONS)
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400">
                  Ảnh #{selectedYoloImageIndex + 1} · Tổng cộng{" "}
                  <span className="font-semibold text-emerald-400">
                    {activeYoloDetections.length}
                  </span>{" "}
                  khung nhận diện · Mô hình:{" "}
                  <span className="font-mono text-slate-300">
                    YOLO11 Multi-Model (Waste Detection)
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Bộ lọc nhanh (Filter Toolbar) */}
          <div className="space-y-2.5 border-b border-white/10 bg-slate-900/70 px-6 py-3">
            <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={detectionSearchQuery}
                  onChange={(e) => setDetectionSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên vật thể hoặc #STT (vd: cardboard, #1)..."
                  className="w-full rounded-lg border border-white/10 bg-slate-950/80 py-1.5 pr-8 pl-8 text-xs text-white placeholder-slate-500 transition focus:border-emerald-500 focus:outline-hidden"
                />
                {detectionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDetectionSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Tóm tắt số lượng */}
              <div className="shrink-0 text-right text-[11px] text-slate-400">
                Hiển thị{" "}
                <span className="font-mono font-semibold text-emerald-400">
                  {filteredDetections.length}
                </span>{" "}
                / {activeYoloDetections.length} vật thể
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setDetectionFilterClass("all")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  detectionFilterClass === "all"
                    ? "bg-emerald-500 font-semibold text-slate-950"
                    : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                Tất cả ({activeYoloDetections.length})
              </button>
              {detectionCategories.map(([category, count]) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setDetectionFilterClass(category)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    detectionFilterClass.toLowerCase() ===
                    category.toLowerCase()
                      ? "bg-emerald-500 font-semibold text-slate-950"
                      : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  <span>{category}</span>
                  <span className="rounded bg-black/30 px-1 py-0.2 font-mono text-[9.5px]">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Bảng dữ liệu cuộn (Scrollable Table) */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {filteredDetections.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="w-12 py-2.5 pr-2"># STT</th>
                    <th className="py-2.5 px-3">Vật thể (Class)</th>
                    <th className="py-2.5 px-3">
                      Tọa độ Bounding Box [x1, y1, x2, y2]
                    </th>
                    <th className="w-44 py-2.5 px-3">Độ tin cậy</th>
                    <th className="w-32 py-2.5 pl-3 text-right">Mô hình</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredDetections.map((det) => {
                    const pct = Math.round(
                      Math.max(0, Math.min(1, det.confidence)) * 100,
                    );
                    const modelTag =
                      (det as { model_id?: string }).model_id ||
                      "YOLO11-Waste";
                    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = det.bbox ?? [];
                    const isPixel = x1 > 1 || y1 > 1 || x2 > 1 || y2 > 1;
                    const formattedBbox = isPixel
                      ? `[${Math.round(x1)}, ${Math.round(y1)}, ${Math.round(x2)}, ${Math.round(y2)}] px`
                      : `[${(x1 * 100).toFixed(1)}%, ${(y1 * 100).toFixed(1)}%, ${(x2 * 100).toFixed(1)}%, ${(y2 * 100).toFixed(1)}%]`;

                    return (
                      <tr
                        key={`${det.materialClass}-${det.originalIndex}`}
                        className="transition hover:bg-white/[0.04]"
                      >
                        <td className="py-2.5 pr-2 font-mono text-slate-400">
                          #{det.originalIndex + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-100">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {det.materialClass}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                          {formattedBbox}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 text-right font-mono text-xs font-semibold text-emerald-300">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            {modelTag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Search className="mb-2 h-8 w-8 text-slate-600" />
                <p className="text-sm font-medium">
                  Không tìm thấy vật thể phù hợp.
                </p>
                <p className="text-xs text-slate-600">
                  Thử thay đổi từ khóa hoặc bộ lọc danh mục.
                </p>
              </div>
            )}
          </div>

          {/* Footer Modal */}
          <DialogFooter className="border-t border-white/10 bg-slate-950 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDetectionsModalOpen(false)}
              className="border-white/15 bg-white/[0.06] text-xs text-slate-200 hover:bg-white/[0.12] hover:text-white"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
