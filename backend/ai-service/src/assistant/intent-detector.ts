import { AssistantIntent, AssistantRole } from './types';

const containsAny = (message: string, words: string[]) =>
  words.some((word) => message.includes(word));

export const detectAssistantIntent = (
  message: string,
  role: AssistantRole,
): AssistantIntent => {
  const normalized = message.toLocaleLowerCase();

  if (
    containsAny(normalized, [
      'what should i do next', 'next step', 'how do i proceed', 'what do i do now',
      'tôi cần làm gì tiếp', 'bước tiếp theo', 'cần làm gì tiếp', 'tiếp theo làm gì',
      'incident density', 'heatmap', 'workload', 'shift availability',
    ])
  ) {
    return 'OPERATIONAL_GUIDANCE';
  }

  if (
    containsAny(normalized, [
      'create', 'submit', 'update', 'edit', 'delete', 'assign', 'close', 'resolve',
      'start handling', 'confirm arrival', 'change status', 'tạo', 'gửi', 'cập nhật',
      'chỉnh sửa', 'xóa', 'phân công', 'đóng', 'giải quyết',
    ])
  ) {
    return 'WRITE_REQUEST';
  }

  if (role === 'OFFICER' && containsAny(normalized, ['assigned', 'task', 'workload', 'nhiệm vụ', 'được giao'])) {
    return 'ASSIGNED_TASKS';
  }

  if (role === 'ADMIN' && containsAny(normalized, ['dashboard', 'queue', 'trend', 'analytics', 'overview', 'thống kê', 'tổng quan'])) {
    return 'SYSTEM_OVERVIEW';
  }

  if (
    containsAny(normalized, [
      'status',
      'my report',
      'my incident',
      'tracking',
      'latest report',
      'being processed',
      'other user',
      'trạng thái',
      'báo cáo của tôi',
      'báo cáo gần nhất',
      'đang được xử lý',
      'đang xử lý',
      'người dùng khác',
    ])
  ) {
    return 'REPORT_STATUS';
  }

  if (containsAny(normalized, ['how to report', 'report an incident', 'how do i report', 'báo cáo', 'tạo báo'])) {
    return 'HOW_TO_REPORT';
  }

  return 'GENERAL';
};
