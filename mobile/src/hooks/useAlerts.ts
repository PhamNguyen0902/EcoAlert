import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertService } from "../api/alertService";
import { CreateAlertData } from "../types";

export const useAlerts = (
  page = 1,
  limit = 20,
  filters: Record<string, string> = {}
) => {
  return useQuery({
    queryKey: ["alerts", page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
    refetchInterval: 15000, // standard refetching for live updates
  });
};

export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: () => alertService.getAlert(id),
    enabled: Boolean(id),
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAlertData) => alertService.createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
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

