import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertService } from "../api/alertService";
import { CreateAlertData, OfficerShift, ResolutionInput, ShiftLocationInput } from "../types";
import { AI_POLL_INTERVAL_MS, shouldPollAiAnalysis } from "../utils/aiAnalysis";

const EMPTY_FILTERS: Record<string, string> = {};

export const useAlerts = (
  page = 1,
  limit = 20,
  filters: Record<string, string> = EMPTY_FILTERS
) => {
  return useQuery({
    queryKey: ["alerts", page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
    staleTime: 1000 * 60 * 2, // 2 mins cache to avoid constant re-fetching
  });
};

export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: () => alertService.getAlert(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      shouldPollAiAnalysis(query.state.data) ? AI_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
};

export const useOfficerTasks = (page = 1, limit = 20, status?: string) => {
  return useQuery({
    queryKey: ["officer-tasks", page, limit, status],
    queryFn: () => alertService.getOfficerTasks(page, limit, status),
    staleTime: 1000 * 60 * 2,
  });
};

export const useCurrentShift = () => useQuery<OfficerShift | null>({
  queryKey: ['officer-shift', 'current'],
  queryFn: () => alertService.getCurrentShift(),
  staleTime: 30_000,
});

export const useStartShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (location: ShiftLocationInput) => alertService.startShift(location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['officer-shift'] }),
  });
};

export const useEndShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (location: ShiftLocationInput) => alertService.endShift(location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['officer-shift'] }),
  });
};


export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlertData) => alertService.createAlert(data),
    onSuccess: (createdAlert) => {
      queryClient.setQueryData(["alert", createdAlert._id], createdAlert);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useUpdateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAlertData> }) =>
      alertService.updateAlert(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

export const useDeleteAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => alertService.deleteAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
    },
  });
};

export const useRestoreAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => alertService.restoreAlert(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", id] });
    },
  });
};

export const useStartHandling = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => alertService.startHandling(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", id] });
      queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
    },
  });
};

export const useConfirmArrival = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      location,
    }: {
      id: string;
      location: { latitude: number; longitude: number; accuracyMeters: number };
    }) => alertService.confirmArrival(id, location),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
    },
  });
};

export const useResolveIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolutionInput }) =>
      alertService.resolveIncident(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
    },
  });
};

export const useCloseIncident = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      alertService.closeIncident(id, reviewNote),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

export const useUploadMedia = () => {
  return useMutation({
    mutationFn: ({
      fileUri,
      fileName,
      fileType,
    }: {
      fileUri: string;
      fileName?: string;
      fileType?: string;
    }) => alertService.uploadMedia(fileUri, fileName, fileType),
  });
};

export const useCategories = (includeInactive = false) => {
  return useQuery({
    queryKey: ["categories", includeInactive],
    queryFn: () => alertService.getCategories(includeInactive),
    staleTime: 10 * 60 * 1000, // 10 mins
  });
};

export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, officerNote }: { id: string; status: string; officerNote?: string }) =>
      alertService.updateAlertStatus(id, status, officerNote),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

export const useAddOfficerNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => alertService.addOfficerNote(id, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

export const useAssignOfficer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, officerId }: { id: string; officerId: string }) =>
      alertService.assignOfficer(id, officerId),
    onSuccess: (updatedAlert, variables) => {
      queryClient.setQueryData(["alert", variables.id], updatedAlert);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["officer-tasks"] });
    },
  });
};

export const useCheckNearbyAlerts = (lat?: number, lng?: number, radius = 200) => {
  const hasCoordinates = lat !== undefined && lng !== undefined;
  return useQuery({
    queryKey: ["nearby-alerts", lat, lng, radius],
    queryFn: () => (hasCoordinates ? alertService.checkNearbyAlerts(lat, lng, radius) : Promise.resolve([])),
    enabled: hasCoordinates,
  });
};

export const useConfirmAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => alertService.confirmAlert(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert", id] });
      queryClient.invalidateQueries({ queryKey: ["nearby-alerts"] });
    },
  });
};

