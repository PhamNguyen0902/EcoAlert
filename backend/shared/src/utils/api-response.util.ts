import { ApiResponse, PaginatedResult } from '../dtos';

export const successResponse = <T>(
  data: T,
  message = 'Success'
): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
    errors: [],
  };
};

export const errorResponse = (
  message = 'Error',
  errors: string[] = []
): ApiResponse<null> => {
  return {
    success: false,
    message,
    data: null,
    errors,
  };
};

export const paginatedResponse = <T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success'
): ApiResponse<PaginatedResult<T>> => {
  return {
    success: true,
    message,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    errors: [],
  };
};
