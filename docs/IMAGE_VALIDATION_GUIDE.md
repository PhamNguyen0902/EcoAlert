# Hướng Dẫn Nhanh: Khởi Chạy & Test Image Validation

Hướng dẫn ngắn gọn các bước để cài đặt và chạy tính năng nhận diện rác thải qua ảnh (**Media Service** & **Vision Service**).

---

## 1. Chuẩn Bị (Bắt buộc)

1. **File Model AI (`best.pt`):**
   - Tải file `best.pt` từ Google Drive.
   - Đặt vào thư mục: `backend/vision-service/model/best.pt`.

2. **File Cấu Hình (`.env`):**
   - Thêm vào  `.env` tại thư mục `backend/media-service/.env`:
     ```env
     VISION_SERVICE_URL=http://localhost:8001
     ```

---

## 2. Cài Đặt & Khởi Chạy

### Bước 1: Chạy Vision Service (Cổng 8001)
Mở một Terminal và chạy:

```bash
cd backend/vision-service

# Tạo và kích hoạt môi trường ảo
python -m venv venv
.\venv\Scripts\activate      # Trên Windows
# source venv/bin/activate  # Trên macOS/Linux

# Cài đặt thư viện & chạy service
pip install -r requirements.txt
python -m uvicorn main:app --port 8001 --reload
```

---

### Bước 2: Chạy Media Service (Cổng 3003)
Mở một Terminal **mới** và chạy:

```bash
cd backend/media-service
npm install
npm run dev
```

---

## 3. Cách Kiểm Thử (Test API)


### Cách 1: Bằng Postman
1. Method: `POST`  
2. URL: `http://localhost:3003/upload`  
3. Tab **Headers**: Thêm `x-user-id` = `test-user-123`  
4. Tab **Body**: Chọn **form-data**:
   - Key: `image` (chuyển sang dạng **File**)
   - Value: Chọn 1 ảnh rác bất kỳ (lấy trong `Garbage detection.v4i.yolo26/test/images/`)
5. Bấm **Send**.

### Cách 2: Bằng cURL trong Terminal
*(Trên Windows PowerShell lưu ý dùng `curl.exe`)*:

```powershell
curl.exe -X POST http://localhost:3003/upload -H "x-user-id: 123" -F "image=@D:\duong_dan_anh.jpg"
```

---

## 4. Kết Quả Mong Đợi (200 OK)

```json
{
  "success": true,
  "message": "Image uploaded and analyzed successfully",
  "data": {
    "url": "https://ecoalert-storage-bucket.s3.../alerts/...jpg",
    "aiAnalysis": {
      "status": "ok",
      "detections": [
        {
          "materialClass": "paper",
          "suggestedCategory": "illegal_dumping",
          "confidence": 0.58,
          "bbox": [115.34, 293.11, 539.73, 551.05]
        }
      ],
      "requiresManualReview": false
    }
  }
}
```
