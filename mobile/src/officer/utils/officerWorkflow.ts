import type { Alert } from "../../shared/types";

export type OfficerTaskFilter = "ALL" | "NEW" | "ACTIVE" | "COMPLETED";
export const officerStatus = (alert: Pick<Alert, "status">) =>
  alert.status.toUpperCase();
// Preserve original categories; exclude explicitly non-waste legacy tasks from this workflow.
export const isWasteOfficerTask = (task: Pick<Alert, "category">) =>
  !task.category ||
  [
    "illegal_dumping",
    "illegal_construction_waste",
    "waste",
    "other",
    "unclassified",
  ].includes(task.category.toLowerCase());
export const filterOfficerTasks = (tasks: Alert[], filter: OfficerTaskFilter) =>
  tasks.filter((task) => {
    if (!isWasteOfficerTask(task)) return false;
    const status = officerStatus(task);
    if (filter === "NEW") return status === "ASSIGNED";
    if (filter === "ACTIVE") return status === "IN_PROGRESS";
    if (filter === "COMPLETED")
      return status === "RESOLVED" || status === "CLOSED";
    return ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status);
  });
export type OfficerWorkflowStepNumber = 1 | 2 | 3;

export interface OfficerWorkflowStepItem {
  step: OfficerWorkflowStepNumber;
  label: string;
  shortLabel: string;
  done: boolean;
  active: boolean;
}

export interface OfficerWorkflowProgress {
  currentStep: OfficerWorkflowStepNumber;
  allCompleted: boolean;
  steps: [
    OfficerWorkflowStepItem,
    OfficerWorkflowStepItem,
    OfficerWorkflowStepItem,
  ];
}

export const OFFICER_WORKFLOW_STEPS = [
  {
    step: 1 as const,
    label: "Check-in (Điểm danh)",
    shortLabel: "Check-in",
  },
  {
    step: 2 as const,
    label: "Xử lý sự cố",
    shortLabel: "Xử lý",
  },
  {
    step: 3 as const,
    label: "Check-out (Hoàn thành)",
    shortLabel: "Check-out",
  },
] as const;

export const getOfficerWorkflowStep = (
  task?: Pick<Alert, "status" | "checkIn"> | null,
  overrideStep?: OfficerWorkflowStepNumber,
): OfficerWorkflowProgress => {
  const status = task ? officerStatus(task) : "ASSIGNED";
  const allCompleted = status === "RESOLVED" || status === "CLOSED";
  const checkedIn = Boolean(task?.checkIn?.verified) || allCompleted;

  let currentStep: OfficerWorkflowStepNumber = 1;
  if (allCompleted) {
    currentStep = 3;
  } else if (overrideStep) {
    currentStep = overrideStep;
  } else if (status === "IN_PROGRESS" && checkedIn) {
    currentStep = 2;
  } else {
    currentStep = 1;
  }

  const steps = OFFICER_WORKFLOW_STEPS.map((item) => {
    const done =
      allCompleted ||
      (item.step === 1 && checkedIn && currentStep > 1) ||
      (item.step === 2 && currentStep === 3);
    const active = !allCompleted && item.step === currentStep;
    return {
      ...item,
      done,
      active,
    };
  }) as OfficerWorkflowProgress["steps"];

  return {
    currentStep,
    allCompleted,
    steps,
  };
};

export const getOfficerTaskState = (
  task: Pick<Alert, "status" | "checkIn">,
) => {
  const status = officerStatus(task);
  if (status === "ASSIGNED")
    return {
      action: "CHECK_IN",
      step: 1 as const,
      label: "CHỜ CHECK-IN",
      color: "#F59E0B",
    } as const;
  if (status === "IN_PROGRESS")
    return task.checkIn?.verified
      ? ({
          action: "RESOLVE",
          step: 2 as const,
          label: "ĐANG XỬ LÝ TẠI HIỆN TRƯỜNG",
          color: "#38BDF8",
        } as const)
      : ({
          action: "CHECK_IN",
          step: 1 as const,
          label: "CHỜ CHECK-IN",
          color: "#F59E0B",
        } as const);
  if (status === "RESOLVED")
    return {
      action: "NONE",
      step: 3 as const,
      label: "ĐÃ HOÀN THÀNH",
      color: "#22C55E",
    } as const;
  if (status === "CLOSED")
    return {
      action: "NONE",
      step: 3 as const,
      label: "ĐÃ NGHIỆM THU",
      color: "#22C55E",
    } as const;
  return {
    action: "NONE",
    step: 1 as const,
    label: "KHÔNG KHẢ DỤNG",
    color: "#94A3B8",
  } as const;
};

export function officerErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;
  return typeof message === "string" && /[à-ỹđĐ]/i.test(message)
    ? message
    : fallback;
}
