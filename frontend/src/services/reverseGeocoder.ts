const GOONG_REVERSE_URL = "https://rsapi.goong.io/geocode";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;
// giới hạn số lượng địa chỉ lưu trong bộ nhớ tạm
const CACHE_LIMIT = 50;
// thời gian tối đa chờ phản hồi mạng
const REQUEST_TIMEOUT_MS = 8_000;
// khoảng cách tối thiểu giữa hai lần gửi yêu cầu liên tiếp
const MIN_REQUEST_INTERVAL_MS = 1_000;

// giao diện chuẩn cho dịch vụ chuyển đổi tọa độ thành địa chỉ
export interface ReverseGeocoder {
  reverseGeocode(latitude: number, longitude: number): Promise<string | null>;
}

// kiểu dữ liệu địa chỉ trả về từ máy chủ
type NominatimAddress = Record<string, unknown>;

// kiểm tra giá trị có phải là một đối tượng hợp lệ
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// kiểm tra và chuẩn hóa chuỗi không rỗng
const nonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

// nối các phần của địa chỉ và loại bỏ các phần trùng nhau
const joinAddressParts = (parts: Array<string | null>): string | null => {
  const address = Array.from(
    new Set(parts.filter((part): part is string => Boolean(part))),
  ).join(", ");
  return address || null;
};

// định dạng các trường địa chỉ chi tiết thành chuỗi hoàn chỉnh
const formatNominatimAddress = (address: NominatimAddress): string | null => {
  // ghép số nhà và tên đường
  const street = [
    nonEmptyString(address.house_number),
    nonEmptyString(address.road),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  // ghép đầy đủ từ cấp đường, phường xã đến quận huyện và tỉnh thành
  return joinAddressParts([
    street || null,
    nonEmptyString(address.neighbourhood),
    nonEmptyString(address.suburb),
    nonEmptyString(address.city_district),
    nonEmptyString(address.city),
    nonEmptyString(address.town),
    nonEmptyString(address.village),
    nonEmptyString(address.state),
    nonEmptyString(address.country),
  ]);
};

// tạo khóa nhận diện từ tọa độ được làm tròn
const coordinateKey = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

// kiểm tra tính hợp lệ của tọa độ vĩ độ và kinh độ
const hasValidCoordinates = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

// lớp trực tiếp gửi yêu cầu lấy địa chỉ từ máy chủ openstreetmap
export class NominatimReverseGeocoder implements ReverseGeocoder {
  // hàng đợi điều tiết các yêu cầu gửi đi
  private requestQueue: Promise<void> = Promise.resolve();
  // mốc thời gian cho phép gửi yêu cầu tiếp theo
  private nextRequestAt = 0;

  // hàm thực hiện chuyển đổi tọa độ thành địa chỉ chữ
   // hàm thực hiện chuyển đổi tọa độ thành địa chỉ chữ bằng Goong API
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    if (!hasValidCoordinates(latitude, longitude)) {
      return null;
    }
    try {
      // chờ đến lượt để đảm bảo không vi phạm giới hạn tần suất
      await this.waitForRequestSlot();
      
      // bộ điều khiển tự động hủy yêu cầu khi quá thời gian chờ
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        const response = await fetch(
          GOONG_API_KEY
            ? `${GOONG_REVERSE_URL}?latlng=${latitude},${longitude}&api_key=${GOONG_API_KEY}`
            : `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=vi`,
          { signal: controller.signal, headers: GOONG_API_KEY ? undefined : { Accept: "application/json" } },
        );
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
          return data.results[0].formatted_address || null;
        }
        return formatNominatimAddress(isRecord(data.address) ? data.address : {}) || nonEmptyString(data.display_name);
      } finally {
        // xóa bộ đếm thời gian khi nhận được phản hồi
        clearTimeout(timeoutId);
      }
    } catch {
      // trả về rỗng khi xảy ra lỗi mạng hoặc quá giờ
      return null;
    }
  }

  // đảm bảo khoảng cách giữa các lần gọi mạng tối thiểu một giây
  private waitForRequestSlot(): Promise<void> {
    const scheduledRequest = this.requestQueue.then(async () => {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now());
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      this.nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    });

    this.requestQueue = scheduledRequest.catch(() => undefined);
    return scheduledRequest;
  }
}

// lớp bọc bổ sung tính năng lưu đệm và chống gọi trùng lặp
export class CachedReverseGeocoder implements ReverseGeocoder {
  // bảng lưu trữ địa chỉ theo tọa độ
  private readonly cache = new Map<string, string>();
  // bảng quản lý các yêu cầu đang trong quá trình tải
  private readonly inFlightRequests = new Map<string, Promise<string | null>>();

  constructor(private readonly geocoder: ReverseGeocoder) {}

  // lấy địa chỉ có ưu tiên kiểm tra bộ nhớ tạm
  reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    const key = coordinateKey(latitude, longitude);
    const cachedAddress = this.cache.get(key);

    // nếu đã có trong bộ nhớ tạm thì làm mới vị trí và trả về ngay
    if (cachedAddress) {
      this.cache.delete(key);
      this.cache.set(key, cachedAddress);
      return Promise.resolve(cachedAddress);
    }

    // nếu đang có một yêu cầu cùng tọa độ đang chạy thì dùng chung kết quả
    const inFlightRequest = this.inFlightRequests.get(key);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    // gửi yêu cầu xuống lớp dịch vụ mạng bên dưới
    const request = this.geocoder
      .reverseGeocode(latitude, longitude)
      .then((address) => {
        if (address) {
          this.cache.set(key, address);
          // xóa bớt mục cũ nhất khi vượt quá giới hạn lưu trữ
          if (this.cache.size > CACHE_LIMIT) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
              this.cache.delete(oldestKey);
            }
          }
        }
        return address;
      })
      .catch(() => null)
      .finally(() => {
        // dọn dẹp danh sách yêu cầu đang chạy khi hoàn tất
        this.inFlightRequests.delete(key);
      });

    this.inFlightRequests.set(key, request);
    return request;
  }
}

// khởi tạo đối tượng dịch vụ dùng chung cho toàn ứng dụng
export const reverseGeocoder: ReverseGeocoder = new CachedReverseGeocoder(
  new NominatimReverseGeocoder(),
);
