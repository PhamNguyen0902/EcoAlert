import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateAlert } from '../hooks/hooks';
import { alertService } from '../services/services';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Image as ImageIcon, FileText, CheckCircle, UploadCloud, Search, Loader2, LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';

// Fix leaflet icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
});

function LocationPicker({ position, setPosition, onLocationSelect }: { 
  position: [number, number], 
  setPosition: (pos: [number, number]) => void,
  onLocationSelect: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return <Marker position={position} />;
}

const steps = [
  { id: 1, name: 'Information', icon: FileText },
  { id: 2, name: 'Location', icon: MapPin },
  { id: 3, name: 'Media', icon: ImageIcon },
  { id: 4, name: 'Review', icon: CheckCircle },
];

export default function CreateAlert() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [position, setPosition] = useState<[number, number]>([10.8494, 106.7537]); // Mặc định ở khu vực Thủ Đức
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Geocoding States
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const mapRef = useRef<any>(null);

  const createAlertMutation = useCreateAlert();
  
  const { register, trigger, getValues, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched'
  });

  // Gõ để tìm kiếm địa chỉ (Debounced)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (addressQuery && showSuggestions) {
        searchAddress(addressQuery);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [addressQuery, showSuggestions]);

  // Forward Geocoding: Text -> Tọa độ
  const searchAddress = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn`);
      const data = await res.json();
      setSuggestions(data);
    } catch (error) {
      console.error("Search address error", error);
    }
    setIsSearching(false);
  };

  // Reverse Geocoding: Tọa độ -> Text
  const fetchAddressFromCoords = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        setValue('address', data.display_name, { shouldValidate: true });
        setAddressQuery(data.display_name);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Reverse geocode error", error);
    }
  };

  // Lựa chọn địa chỉ từ gợi ý
  const handleSelectSuggestion = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setPosition([lat, lon]);
    setValue('address', item.display_name, { shouldValidate: true });
    setAddressQuery(item.display_name);
    setShowSuggestions(false);
    
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lon], 16);
    }
  };

  // Lấy vị trí hiện tại của thiết bị
  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      toast.loading('Đang lấy vị trí...', { id: 'geo' });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          if (mapRef.current) {
            mapRef.current.flyTo([latitude, longitude], 16);
          }
          await fetchAddressFromCoords(latitude, longitude);
          toast.success('Đã cập nhật vị trí hiện tại!', { id: 'geo' });
        },
        (err) => {
          toast.error('Không thể định vị. Vui lòng kiểm tra quyền truy cập vị trí.', { id: 'geo' });
        }
      );
    } else {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị.');
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['title', 'description']);
      if (!isValid) return;
    }
    if (currentStep === 2) {
      const isValid = await trigger(['address']);
      if (!isValid) {
        toast.error('Vui lòng cung cấp địa chỉ hợp lệ.');
        return;
      }
    }
    if (currentStep === 3 && !file) {
      toast.error('Vui lòng tải lên ít nhất 1 hình ảnh minh chứng.');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, 4));
  };

  const handlePrev = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async () => {
    try {
      const formData = getValues();
      toast.loading('Đang tải lên dữ liệu...', { id: 'submit' });
      
      let mediaUrls: string[] = [];
      if (file) {
        const url = await alertService.uploadMedia(file);
        mediaUrls = [url];
      }
      toast.loading('Đang gửi báo cáo...', { id: 'submit' });
      
      await createAlertMutation.mutateAsync({
        title: formData.title,
        description: formData.description,
        address: formData.address,
        location: {
          type: 'Point',
          coordinates: [position[1], position[0]] 
        },
        mediaUrls
      });
      
      toast.success('Gửi báo cáo thành công!', { id: 'submit' });
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gửi báo cáo thất bại', { id: 'submit' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Báo Cáo Sự Cố</h2>
        <p className="text-muted-foreground mt-1">Cung cấp thông tin chi tiết để chúng tôi xử lý kịp thời.</p>
      </div>

      {/* Stepper */}
      <div className="mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full hidden sm:block"></div>
        <div className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full hidden sm:block transition-all duration-300" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
        
        <div className="relative flex justify-between">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-background px-2 sm:bg-transparent">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors z-10 
                  ${isActive ? 'border-primary bg-primary text-white' : 
                    isCompleted ? 'border-primary bg-primary/10 text-primary' : 'border-muted bg-card text-muted-foreground'}`}>
                  <Icon size={18} />
                </div>
                <span className={`text-xs font-medium hidden sm:block ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8 min-h-[450px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* BƯỚC 1: Tiêu đề & Mô tả */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Thông tin cơ bản</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Tiêu đề sự cố</Label>
                        <Input id="title" placeholder="Ví dụ: Rác thải đổ trộm bờ sông..." className="mt-1.5" {...register('title')} />
                        {errors.title && <p className="text-red-500 text-xs mt-1">{String(errors.title.message)}</p>}
                      </div>
                      <div>
                        <Label htmlFor="description">Mô tả chi tiết</Label>
                        <Textarea id="description" placeholder="Mô tả chi tiết những gì bạn quan sát được..." className="mt-1.5 h-32" {...register('description')} />
                        {errors.description && <p className="text-red-500 text-xs mt-1">{String(errors.description.message)}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BƯỚC 2: Vị trí */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">Xác nhận vị trí</h3>
                    <p className="text-sm text-muted-foreground mb-4">Tìm kiếm địa chỉ, chọn vị trí hiện tại hoặc ghim trực tiếp trên bản đồ.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 mb-4 relative z-[1000]">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Nhập địa chỉ để tìm kiếm..." 
                          className="pl-10 h-10" 
                          value={addressQuery}
                          onChange={(e) => {
                            setAddressQuery(e.target.value);
                            setShowSuggestions(true);
                            setValue('address', e.target.value);
                          }}
                        />
                        {isSearching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                        
                        {/* Dropdown Gợi Ý (Fix UI trong Light/Dark Mode) */}
                        {showSuggestions && suggestions.length > 0 && (
                          <ul className="absolute top-full left-0 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {suggestions.map((item, index) => (
                              <li 
                                key={index} 
                                className="px-4 py-2 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-b-0"
                                onClick={() => handleSelectSuggestion(item)}
                              >
                                {item.display_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Lấy vị trí hiện tại */}
                      <Button type="button" variant="secondary" className="h-10 shrink-0" onClick={handleGetCurrentLocation}>
                        <LocateFixed className="w-4 h-4 mr-2" /> Vị trí của tôi
                      </Button>
                    </div>
                    {errors.address && <p className="text-red-500 text-xs mt-1 mb-2">{String(errors.address.message)}</p>}

                    {/* Bản Đồ */}
                    <div className="h-[350px] sm:h-[400px] w-full rounded-xl overflow-hidden border shadow-sm relative z-0">
                      <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationPicker 
                          position={position} 
                          setPosition={setPosition} 
                          onLocationSelect={fetchAddressFromCoords}
                        />
                      </MapContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* BƯỚC 3: Hình Ảnh */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">Tải lên minh chứng</h3>
                    <p className="text-sm text-muted-foreground mb-4">Hệ thống AI sẽ tự động phân loại sự cố dựa trên hình ảnh này.</p>
                    
                    {!previewUrl ? (
                      <label className="flex flex-col items-center justify-center w-full h-[300px] border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/30 bg-muted/10">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="mb-2 text-sm text-muted-foreground font-semibold">Bấm để tải lên hoặc kéo thả vào đây</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (Tối đa 10MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border bg-muted">
                        <img src={previewUrl} alt="Preview" className="w-full max-h-[400px] object-contain" />
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="absolute top-2 right-2 shadow-md"
                          onClick={() => { setFile(null); setPreviewUrl(null); }}
                        >
                          Xóa ảnh
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BƯỚC 4: Kiểm tra & Gửi */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Xem lại & Xác nhận</h3>
                    
                    <div className="bg-muted/30 p-6 rounded-xl space-y-6 border">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tiêu đề</h4>
                          <p className="font-medium">{getValues('title')}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Địa điểm</h4>
                          <p className="font-medium text-sm line-clamp-2">{getValues('address')}</p>
                          <p className="text-xs font-mono mt-1 text-muted-foreground bg-background inline-block px-2 py-1 rounded">
                            {position[0].toFixed(5)}, {position[1].toFixed(5)}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mô tả</h4>
                        <p className="text-sm whitespace-pre-wrap">{getValues('description')}</p>
                      </div>

                      {previewUrl && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ảnh minh chứng</h4>
                          <div className="w-32 h-32 rounded-lg overflow-hidden border shadow-sm">
                            <img src={previewUrl} alt="Thumb" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Điều hướng */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handlePrev}
              disabled={currentStep === 1 || createAlertMutation.isPending}
            >
              Quay lại
            </Button>
            
            {currentStep < 4 ? (
              <Button onClick={handleNext} className="min-w-[100px]">Tiếp tục</Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={createAlertMutation.isPending}
                className="min-w-[140px]"
              >
                {createAlertMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {createAlertMutation.isPending ? 'Đang gửi...' : 'Gửi Báo Cáo'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}