import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});

// 1. Chỉ sử dụng MỘT Request Interceptor duy nhất
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // Debug log (Bạn có thể comment lại khi deploy lên production)
    console.log("🔑 Gắn Token vào REQUEST:", config.url);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Logic xử lý hàng đợi (Queue) khi Token hết hạn
let isRefreshing = false;
let refreshQueue: {
  resolve: (token: string) => void;
  reject: (err: any) => void;
}[] = [];

const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
};

// 3. Response Interceptor xử lý Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 (Unauthorized) và request này chưa từng được retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Nếu đang có 1 tiến trình refresh chạy rồi, đưa request vào hàng đợi
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      // Đánh dấu request này đã được retry để tránh loop vô hạn
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("Không tìm thấy refresh token");

        // Gọi API cấp lại token mới
        const res = await axios.post(
          `${api.defaults.baseURL}/v1/auth/refresh-token`,
          { refreshToken }
        );
        
        const { accessToken: newToken, refreshToken: newRefreshToken } = res.data.data;

        if (!newToken) throw new Error("Response không chứa accessToken mới");

        // Lưu token mới vào Local Storage
        localStorage.setItem("token", newToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        // Gắn token mới vào request bị lỗi ban đầu và gọi lại
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        
        return api(originalRequest);
      } catch (err) {
        // Nếu refresh token cũng lỗi (hết hạn nốt), xóa hết data và đẩy ra ngoài
        processQueue(err, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        
        // Bắn sự kiện để phía UI (React) bắt được và chuyển hướng về trang /login
        window.dispatchEvent(new Event("auth:unauthorized"));
        
        return Promise.reject(err);
      } finally {
        // Dọn dẹp trạng thái
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);