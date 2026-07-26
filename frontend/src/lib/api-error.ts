import axios from 'axios';

interface ApiErrorBody {
  message?: unknown;
}

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};
