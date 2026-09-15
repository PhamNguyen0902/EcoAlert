import axios from "axios";

// xác định đường dẫn gốc cho các yêu cầu mạng
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // tự động trỏ về cổng backend khi chạy trong môi trường phát triển
    if (port === "5173" || port === "4173") {
      return `${protocol}//${hostname}:3000/api`;
    }
    // nhận diện tên miền và cổng khi chạy trên hệ thống thực tế
    return `${protocol}//${hostname}${port ? `:${port}` : ""}/api`;
  }
  return "http://localhost:3000/api";
};

// khởi tạo đối tượng gọi mạng dùng chung
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

// bộ chặn yêu cầu gửi đi để gắn mã xác thực
api.interceptors.request.use(
  (config) => {
    // lấy mã truy cập từ bộ nhớ cục bộ
    const token = localStorage.getItem("token");

    // ghi log kiểm tra mã gửi đi
    console.log("🔑 Gắn Token vào REQUEST:", config.url);

    // gắn mã vào phần đầu nếu tồn tại
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// trạng thái đang làm mới mã xác thực
let isRefreshing = false;
// hàng đợi lưu các yêu cầu trong lúc chờ cấp mã mới
let refreshQueue: {
  resolve: (token: string) => void;
  reject: (err: any) => void;
}[] = [];

// xử lý giải phóng các yêu cầu đang chờ trong hàng đợi
const processQueue = (error: any, token: string | null = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  refreshQueue = [];
};

// bộ chặn phản hồi xử lý tự động làm mới mã xác thực khi hết hạn
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // kiểm tra khi gặp lỗi hết phiên đăng nhập và chưa từng thử lại
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // đưa yêu cầu vào hàng đợi nếu đang trong quá trình làm mới
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

      // đánh dấu yêu cầu đã thử lại để tránh lặp vô hạn
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // lấy mã làm mới từ bộ nhớ cục bộ
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("Không tìm thấy refresh token");

        // gọi máy chủ cấp lại mã truy cập mới
        const res = await axios.post(
          `${api.defaults.baseURL}/v1/auth/refresh-token`,
          { refreshToken }
        );
        
        const { accessToken: newToken, refreshToken: newRefreshToken } = res.data.data;

        if (!newToken) throw new Error("Response không chứa accessToken mới");

        // lưu mã truy cập mới vào bộ nhớ cục bộ
        localStorage.setItem("token", newToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        // gắn mã mới vào yêu cầu ban đầu và gọi lại
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        
        return api(originalRequest);
      } catch (err) {
        // xóa sạch dữ liệu phiên đăng nhập khi việc cấp mới thất bại
        processQueue(err, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        
        // phát sự kiện để chuyển hướng người dùng về trang đăng nhập
        window.dispatchEvent(new Event("auth:unauthorized"));
        
        return Promise.reject(err);
      } finally {
        // đặt lại trạng thái kết thúc làm mới
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);