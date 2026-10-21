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
  Loader2,
  MapPin,
  Pencil,
  PlayCircle,
  Save,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  UserCheck,
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
import { AssignmentPreview } from "@/features/admin/components/AssignmentPreview";
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

const getStaggerTransition = (index: number) => ({
  type: "spring" as const,
  stiffness: 260,
  damping: 24,
  delay: index * 0.07,
});

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
  const [showAdvancedDockPanel, setShowAdvancedDockPanel] = useState(false);

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
          setShowAdvancedDockPanel(false);
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
    <div className="mx-auto max-w-7xl space-y-5 pb-12">
      {/* =======================================================================
          GIAO DIỆN ADMIN: APPLE macOS BENTO 3 CỘT + FLOATING ACTION DOCK
      ======================================================================= */}
      {isAdmin ? (
        <div className="space-y-5">
          {/* -------------------------------------------------------------------
              HEADER & APPLE SEGMENTED STEPPER (STAGGER INDEX 0)
          ------------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={getStaggerTransition(0)}
            className="rounded-2xl border border-slate-200/80 bg-slate-900/90 p-5 text-slate-100 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/60"
          >
            {/* Dòng trên: Nút Quay lại + Mã hồ sơ + Apple Segmented Pill Stepper */}
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                <Link
                  to="/admin/reports"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 font-medium text-slate-200 transition hover:bg-white/[0.12]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Danh sách</span>
                </Link>
                <span className="text-slate-600">/</span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  HỒ SƠ THẨM ĐỊNH #{alert._id.slice(-6).toUpperCase()}
                </span>
              </div>

              {/* Thanh tiến trình 4 bước dạng Apple Segmented Pill */}
              <div
                role="list"
                aria-label="Tiến trình thẩm định sự cố"
                className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/[0.08] bg-slate-950/60 p-1"
              >
                {segmentedSteps.map((step) => {
                  const isCurrent = step.index === activeStepIndex;
                  const isDone =
                    step.index < activeStepIndex ||
                    normalizedAlertStatus === "closed";

                  return (
                    <span
                      key={step.index}
                      role="listitem"
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                        isCurrent
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-xs"
                          : isDone
                            ? "border-transparent text-emerald-400/80"
                            : "border-transparent text-slate-500"
                      }`}
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          isCurrent || isDone
                            ? "text-emerald-400"
                            : "text-slate-600"
                        }`}
                      />
                      <span className="whitespace-nowrap">{step.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Dòng dưới: Tiêu đề báo cáo rõ ràng + Badge mức độ */}
            <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {alert.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Mức độ: {getIncidentSeverityLabel(displaySeverity, language)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-slate-300">
                  {getIncidentStatusLabel(alert.status, language)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* -------------------------------------------------------------------
              LƯỚI BENTO 3 CỘT CÂN ĐỐI (grid-cols-1 lg:grid-cols-12 gap-5)
          ------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* =================================================================
                CỘT 1 (lg:col-span-4): 01 · HIỆN TRƯỜNG & VỊ TRÍ
            ================================================================= */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getStaggerTransition(1)}
              className="flex flex-col justify-between space-y-5 rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 text-slate-100 backdrop-blur-xl lg:col-span-4"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    01 · HIỆN TRƯỜNG & VỊ TRÍ
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Báo cáo công dân
                  </span>
                </div>

                {/* Mô tả của người dân */}
                <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-100">
                  “
                  {alert.description ||
                    "Người dân phản ánh điểm tồn đọng rác thải đô thị cần thu dọn."}
                  ”
                </p>

                {/* Thời gian gửi */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    Ghi nhận: {format(new Date(alert.createdAt), "dd/MM/yyyy · HH:mm")}
                  </span>
                </div>
              </div>

              {/* Bản đồ Leaflet bo góc rounded-xl h-48 + dòng địa chỉ/tọa độ gọn bên dưới */}
              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                {hasCoordinates ? (
                  <div className="h-48 w-full overflow-hidden rounded-xl border border-white/[0.08]">
                    <MapContainer
                      center={[latitude, longitude]}
                      zoom={15}
                      maxZoom={19}
                      minZoom={2}
                      scrollWheelZoom={false}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <EcoAlertBaseMap />
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
                  <div className="flex h-48 items-center justify-center rounded-xl bg-slate-950/50 text-xs text-slate-400">
                    <MapPin className="mr-1.5 h-4 w-4" />
                    Không có tọa độ GPS
                  </div>
                )}

                <div className="hidden">
                  <IncidentLocationDetails
                    address={alert.address}
                    latitude={latitude}
                    longitude={longitude}
                    showNavigation={false}
                  />
                </div>

                <div className="flex items-start justify-between gap-2 text-xs text-slate-300">
                  <p className="leading-relaxed">
                    <strong className="text-slate-100">Vị trí:</strong>{" "}
                    {alert.address || "Đang cập nhật địa chỉ"}
                  </p>
                  {hasCoordinates && (
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">
                      {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* =================================================================
                CỘT 2 (lg:col-span-5): 02 · THẨM ĐỊNH AI VISION
            ================================================================= */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getStaggerTransition(2)}
              className="flex flex-col justify-between space-y-5 rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 text-slate-100 backdrop-blur-xl lg:col-span-5"
            >
              <div className="space-y-4">
                {/* Header + Công tắc iOS pill toggle "Khung AI: Bật/Tắt" */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    02 · THẨM ĐỊNH AI VISION
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={showYoloBoxes}
                    onClick={() => setShowYoloBoxes((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 transition hover:text-white"
                  >
                    <span>Khung AI: {showYoloBoxes ? "Bật" : "Tắt"}</span>
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        showYoloBoxes ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                          showYoloBoxes ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                </div>

                {/* Khung hiển thị ảnh (Stage) hỗ trợ ảnh dọc/ngang + Apple Preview Blurred Backdrop + Khung nội bộ ôm sát ảnh thật */}
                {originalEvidence[selectedYoloImageIndex] ? (
                  <div className="relative flex min-h-[360px] max-h-[460px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2">
                    {/* Lớp nền mờ Apple Preview phía sau để lấp khoảng trống ảnh dọc */}
                    <img
                      src={originalEvidence[selectedYoloImageIndex]}
                      alt=""
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-35 blur-2xl"
                    />

                    {/* Khung nội bộ ôm sát đúng kích thước hiển thị của ảnh (inline-flex) */}
                    <div className="relative z-10 inline-flex max-h-[440px] max-w-full items-center justify-center">
                      <img
                        src={originalEvidence[selectedYoloImageIndex]}
                        alt={`Ảnh thẩm định AI ${selectedYoloImageIndex + 1}`}
                        className="block h-auto max-h-[440px] w-auto max-w-full rounded-lg object-contain"
                        onLoad={(event) =>
                          setYoloImageSize({
                            width: event.currentTarget.naturalWidth,
                            height: event.currentTarget.naturalHeight,
                          })
                        }
                      />

                      {/* Lớp phủ Bounding Box nằm BÊN TRONG khung inline-flex để khớp 100% mép ảnh thật */}
                      <div className="pointer-events-none absolute inset-0">
                        <AnimatePresence>
                          {showYoloBoxes &&
                            yoloImageSize &&
                            activeYoloDetections.map((detection, index) => {
                              const {
                                left,
                                top,
                                width,
                                height,
                                isNearTopEdge,
                              } = computeClampedYoloBox(
                                detection.bbox,
                                yoloImageSize,
                              );
                              const confPct = Math.round(
                                Math.max(0, Math.min(1, detection.confidence)) *
                                  100,
                              );
                              return (
                                <motion.div
                                  key={`${detection.materialClass}-${index}`}
                                  initial={{ opacity: 0, scale: 0.96 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.96 }}
                                  transition={{ duration: 0.18 }}
                                  className="pointer-events-none absolute rounded-md border-2 border-emerald-400 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                                  style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                  }}
                                >
                                  <span
                                    className={`absolute left-0 inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md bg-emerald-600/95 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-md ${
                                      isNearTopEdge ? "top-1" : "-top-6"
                                    }`}
                                  >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                                    {detection.materialClass} · {confPct}%
                                  </span>
                                </motion.div>
                              );
                            })}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[360px] w-full items-center justify-center rounded-xl bg-slate-950/60 text-xs text-slate-400">
                    Chưa có ảnh hiện trường
                  </div>
                )}

                {/* Thumbnail chọn ảnh nếu có nhiều ảnh */}
                {originalEvidence.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {originalEvidence.map((url, idx) => (
                      <button
                        type="button"
                        key={url}
                        onClick={() => setSelectedYoloImageIndex(idx)}
                        className={`h-11 w-16 shrink-0 overflow-hidden rounded-lg border transition ${
                          idx === selectedYoloImageIndex
                            ? "border-emerald-400 ring-2 ring-emerald-400/30"
                            : "border-white/10 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Ảnh ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Hàng chip nhỏ gọn hiển thị các vật thể phát hiện và khối lượng ước tính */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {yoloDetectionGroups.map(([material, count]) => (
                    <span
                      key={material}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-xs font-medium text-slate-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {material} ({count})
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1 text-xs font-medium text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Khối lượng: {massEstimateText}
                  </span>
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4 text-xs text-slate-400">
                Phân loại tự động:{" "}
                <strong className="text-slate-200">
                  {getIncidentCategoryLabel(
                    analysis?.categorySuggestion ?? alert.category,
                    language,
                  )}
                </strong>
              </div>
            </motion.div>

            {/* =================================================================
                CỘT 3 (lg:col-span-3): 03 · KẾT QUẢ AI & CA TRỰC
            ================================================================= */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={getStaggerTransition(3)}
              className="flex flex-col justify-between space-y-5 rounded-2xl border border-white/[0.08] bg-slate-900/60 p-5 text-slate-100 backdrop-blur-xl lg:col-span-3"
            >
              {/* Nửa trên: Độ tin cậy AI lớn + Mức độ đề xuất + 2-3 dòng nhận định AI */}
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  03 · KẾT QUẢ AI & CA TRỰC
                </span>

                <div className="flex items-baseline justify-between gap-2 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-extrabold tracking-tight text-white">
                      {aiConfidenceText}
                    </span>
                    <span className="text-xs text-slate-400">
                      Độ tin cậy AI
                    </span>
                  </div>

                  <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    Mức:{" "}
                    {getIncidentSeverityLabel(
                      analysis?.severity ?? displaySeverity,
                      language,
                    )}
                  </span>
                </div>

                <p className="line-clamp-4 text-sm leading-relaxed text-slate-300">
                  {analysis?.overallSummary ||
                    alert.aiSummary ||
                    "AI đã phân tích hình ảnh hiện trường và sẵn sàng hỗ trợ điều phối lực lượng thu gom."}
                </p>
              </div>

              {/* Nửa dưới (ngăn cách bằng border-t border-white/[0.06]): Cán bộ & 3 mốc thời gian gọn */}
              <div className="space-y-3 border-t border-white/[0.06] pt-4 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Cán bộ phụ trách:</span>
                  <strong className="truncate font-semibold text-white">
                    {assignedOfficerLabel}
                  </strong>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        alert.assignedAt
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-slate-200">Nhận việc</p>
                      <p className="text-[11px] text-slate-400">
                        {formatTimestamp(alert.assignedAt, language)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        alert.arrivedAt || alert.checkIn?.verified
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-slate-200">
                        Check-in GPS
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatTimestamp(
                          alert.checkIn?.checkedInAt || alert.arrivedAt,
                          language,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        alert.resolvedAt || resolutionEvidence.length > 0
                          ? "text-emerald-400"
                          : "text-slate-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-slate-200">
                        Ảnh nghiệm thu
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatTimestamp(alert.resolvedAt, language)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nếu đã có ảnh sau xử lý: hiển thị ảnh đối chiếu Trước/Sau ngay tại đây */}
                {resolutionEvidence.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {originalEvidence[0] && (
                      <a
                        href={originalEvidence[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-video overflow-hidden rounded-lg bg-slate-950"
                      >
                        <img
                          src={originalEvidence[0]}
                          alt="Trước xử lý"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          Trước
                        </span>
                      </a>
                    )}
                    <a
                      href={resolutionEvidence[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-video overflow-hidden rounded-lg bg-slate-950"
                    >
                      <img
                        src={resolutionEvidence[0].url}
                        alt="Sau xử lý"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                        Sau
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* -------------------------------------------------------------------
              THANH QUYẾT ĐỊNH DƯỚI ĐÁY (04 · FLOATING ACTION DOCK - STAGGER INDEX 4)
          ------------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={getStaggerTransition(4)}
            className="space-y-4 rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-4 text-slate-100 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Bên trái: Trạng thái câu lệnh cần làm */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  04 · HÀNH ĐỘNG TIẾP THEO
                </span>

                {canAdminVerify && (
                  <p className="text-slate-200">
                    <strong className="text-white">
                      Bước tiếp theo: Xác minh báo cáo
                    </strong>{" "}
                    · Kiểm tra ảnh AI Vision và vị trí trước khi chuyển sang
                    điều phối.
                  </p>
                )}

                {canAdminAssign && (
                  <p className="text-slate-200">
                    <strong className="text-white">
                      Đề xuất điều phối tối ưu (OSRM):
                    </strong>{" "}
                    {selectedAvailability?.officer.fullName ||
                      recommendedCandidate?.officer.fullName ||
                      "Chọn cán bộ phụ trách"}{" "}
                    ·{" "}
                    <span className="text-emerald-400">
                      {selectedAvailability?.shiftStatus === "ON_SHIFT"
                        ? "Đang rảnh / Trong ca"
                        : "Sẵn sàng nhận lệnh"}
                    </span>
                  </p>
                )}

                {["assigned", "in_progress"].includes(
                  normalizedAlertStatus,
                ) && (
                  <p className="text-slate-200">
                    <strong className="text-white">
                      Đang xử lý tại hiện trường:
                    </strong>{" "}
                    Cán bộ <strong>{assignedOfficerLabel}</strong> đang thực
                    hiện nhiệm vụ.
                  </p>
                )}

                {normalizedAlertStatus === "resolved" && (
                  <p className="text-slate-200">
                    <strong className="text-white">
                      Bước tiếp theo: Nghiệm thu & Đóng hồ sơ
                    </strong>{" "}
                    · Cán bộ đã gửi ảnh minh chứng hoàn thành.
                  </p>
                )}

                {["closed", "rejected"].includes(normalizedAlertStatus) && (
                  <p className="text-slate-300">
                    Hồ sơ sự cố đã hoàn tất (
                    <strong>
                      {getIncidentStatusLabel(alert.status, language)}
                    </strong>
                    ).
                  </p>
                )}
              </div>

              {/* Bên phải: 1 nút phụ "Ghi chú / Tùy chọn nâng cao" + 1 Nút Hành Động Chính (Primary CTA) trên 1 dòng chữ ngang */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDockPanel((prev) => !prev)}
                  className="whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {canAdminAssign
                    ? "Đổi cán bộ / Ghi chú"
                    : "Ghi chú / Tùy chọn nâng cao"}
                </button>

                {canAdminVerify && (
                  <button
                    type="button"
                    onClick={() => void handleVerify()}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
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
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <span>
                      Giao việc cho{" "}
                      {selectedAvailability?.officer.fullName || "Cán bộ"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                {normalizedAlertStatus === "resolved" && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction("close")}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Phê duyệt Nghiệm thu & Đóng Sự cố</span>
                  </button>
                )}
              </div>
            </div>

            {/* Ngăn mở rộng của Floating Dock khi bấm "Ghi chú / Tùy chọn nâng cao" */}
            <AnimatePresence>
              {showAdvancedDockPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden border-t border-white/[0.08] pt-4"
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Cột trái ngăn mở rộng: Chọn cán bộ khác / AssignmentPreview / Ghi chú nghiệm thu */}
                    <div className="space-y-3">
                      {canAdminAssign && (
                        <>
                          <AssignmentPreview id={id} />
                          <div className="space-y-2 pt-2">
                            <label
                              htmlFor="assigned-officer"
                              className="block text-xs font-semibold text-slate-300"
                            >
                              Đổi cán bộ nhận lệnh điều phối
                            </label>
                            <select
                              id="assigned-officer"
                              value={selectedOfficerId}
                              onChange={(event) =>
                                setSelectedOfficerId(event.target.value)
                              }
                              className="h-10 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-sm text-white"
                            >
                              <option value="">Chọn Cán bộ</option>
                              {availability.map((item) => (
                                <option
                                  key={item.officer._id}
                                  value={item.officer._id}
                                >
                                  {item.officer.fullName} ·{" "}
                                  {item.shiftStatus === "ON_SHIFT"
                                    ? "Trong ca"
                                    : "Ngoài ca"}{" "}
                                  · {item.activeTaskCount} nhiệm vụ
                                </option>
                              ))}
                            </select>

                            {assignmentWarning && (
                              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                                {assignmentWarning}
                              </p>
                            )}

                            <label className="flex items-start gap-2 text-xs text-slate-300">
                              <input
                                type="checkbox"
                                checked={assignmentOverride}
                                onChange={(e) =>
                                  setAssignmentOverride(e.target.checked)
                                }
                              />
                              Xác nhận điều phối ngoại lệ (ngoài ca hoặc khác
                              khu vực).
                            </label>

                            <input
                              type="text"
                              placeholder="Lý do điều phối (tùy chọn)..."
                              value={assignmentReason}
                              onChange={(e) =>
                                setAssignmentReason(e.target.value)
                              }
                              className="h-9 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-xs text-white"
                            />
                          </div>
                        </>
                      )}

                      {normalizedAlertStatus === "resolved" && (
                        <div className="space-y-2">
                          <label
                            htmlFor="review-note"
                            className="block text-xs font-semibold text-slate-300"
                          >
                            Ghi chú nghiệm thu của Admin
                          </label>
                          <textarea
                            id="review-note"
                            value={reviewNote}
                            onChange={(event) =>
                              setReviewNote(event.target.value)
                            }
                            maxLength={4000}
                            placeholder="Nhập nhận xét nghiệm thu trước khi đóng sự cố..."
                            className="min-h-20 w-full rounded-xl border border-white/15 bg-slate-950 p-3 text-sm text-white"
                          />
                        </div>
                      )}
                    </div>

                    {/* Cột phải ngăn mở rộng: Ghi chú điều hành nội bộ & Nhật ký hệ thống */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Ghi chú điều hành nội bộ
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            editingNote ? noteText : alert.officerNote || ""
                          }
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
                          placeholder="Thêm ghi chú chỉ đạo cho hồ sơ này..."
                          className="h-9 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 text-xs text-white"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveNote}
                          disabled={
                            !noteText.trim() || addOfficerNote.isPending
                          }
                          className="whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Lưu ghi chú
                        </Button>
                      </div>

                      <details className="group rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-300">
                          <span>
                            Xem nhật ký hệ thống ({statusHistory.length} mốc)
                          </span>
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
                          {statusHistory.map((entry, idx) => (
                            <div
                              key={entry._id || idx}
                              className="flex items-center justify-between text-[11px] text-slate-400"
                            >
                              <span>
                                {entry.fromStatus || "khởi tạo"} ➔{" "}
                                <strong className="text-slate-200">
                                  {entry.toStatus}
                                </strong>
                              </span>
                              <span>
                                {formatTimestamp(entry.changedAt, language)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
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
    </div>
  );
}
