import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authService,
  alertService,
  gisService,
  categoryService,
} from "../services/services";
import { CreateAlertData, Category, ResolutionInput } from "@/types";

// ========================
// AUTH
// ========================

export const useLogin = () => {
  return useMutation({
    mutationFn: authService.login,
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: authService.register,
  });
};

// ========================
// ALERT
// ========================

export const useAlerts = (
  page = 1,
  limit = 10,
  filters: Record<string, string> = {},
) => {
  return useQuery({
    queryKey: ["alerts", page, limit, filters],
    queryFn: () => alertService.getAlerts(page, limit, filters),
  });
};

export const useAlert = (id: string) => {
  return useQuery({
    queryKey: ["alert", id],
    queryFn: () => alertService.getAlert(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const alert = query.state.data;
      const analysisPending =
        alert &&
        (alert.status === 'pending' || alert.status === 'ai_analyzing') &&
        alert.category === 'UNCLASSIFIED' &&
        alert.aiConfidence === undefined;
      return analysisPending ? 3000 : false;
    },
  });
};

export const useOfficerTasks = (page = 1, limit = 10, status?: string) => {
  return useQuery({
    queryKey: ['officer-tasks', page, limit, status || 'all'],
    queryFn: () => alertService.getOfficerTasks(page, limit, status),
  });
};

const invalidateAlertWorkflow = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) => {
  queryClient.invalidateQueries({ queryKey: ['alert', id] });
  queryClient.invalidateQueries({ queryKey: ['alerts'] });
  queryClient.invalidateQueries({ queryKey: ['officer-tasks'] });
};

export const useAssignOfficer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, officerId }: { id: string; officerId: string }) =>
      alertService.assignOfficer(id, officerId),
    onSuccess: (_, variables) => invalidateAlertWorkflow(queryClient, variables.id),
  });
};

export const useOfficerAvailability = (enabled = true) => useQuery({
  queryKey: ['officer-availability'],
  queryFn: () => alertService.getOfficerAvailability(),
  enabled,
  staleTime: 30_000,
});

export const useStartHandling = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alertService.startHandling,
    onSuccess: (_, id) => invalidateAlertWorkflow(queryClient, id),
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
      location?: { latitude?: number; longitude?: number; accuracy?: number };
    }) => alertService.confirmArrival(id, location),
    onSuccess: (_, variables) => invalidateAlertWorkflow(queryClient, variables.id),
  });
};

export const useResolveIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResolutionInput }) =>
      alertService.resolveIncident(id, data),
    onSuccess: (_, variables) => invalidateAlertWorkflow(queryClient, variables.id),
  });
};

export const useCloseIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      alertService.closeIncident(id, reviewNote),
    onSuccess: (_, variables) => invalidateAlertWorkflow(queryClient, variables.id),
  });
};

export const useCreateAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.createAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

export const useUpdateAlertStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      alertService.updateStatus(id, status),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["alert", variables.id],
      });

      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

export const useDeleteAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.deleteAlert,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};

export const useRestoreAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alertService.restoreAlert,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["alerts"],
      });
    },
  });
};
export const useUpdateAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateAlertData>;
    }) => alertService.updateAlert(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
};

export const useAddOfficerNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      alertService.addOfficerNote(id, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alert", variables.id] });
    },
  });
};

// ========================
// GIS
// ========================

export const useNearbyIncidents = (
  lng: number,
  lat: number,
  maxDistance = 5000,
) => {
  return useQuery({
    queryKey: ["gis", "nearby", lng, lat, maxDistance],
    queryFn: () => gisService.getNearby(lng, lat, maxDistance),
    enabled: Boolean(lng && lat),
  });
};

// ========================
// CATEGORIES
// ========================

export const useCategories = (includeInactive = false) => {
  return useQuery({
    queryKey: ["categories", includeInactive],
    queryFn: () => categoryService.getCategories(includeInactive),
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Category>) => categoryService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoryService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
};

