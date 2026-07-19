import { useState } from 'react';
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
import { MapPin, Image as ImageIcon, FileText, CheckCircle, UploadCloud } from 'lucide-react';
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

function LocationPicker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
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
  const [position, setPosition] = useState<[number, number]>([10.8231, 106.6297]); // default HCMC
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const createAlertMutation = useCreateAlert();

  const { register, trigger, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched'
  });

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['title', 'description', 'address']);
      if (!isValid) return;
    }
    if (currentStep === 3 && !file) {
      toast.error('Please upload at least one image as evidence.');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, 4));
  };

  const handlePrev = () => {
    setCurrentStep(s => Math.max(s - 1, 1));
  };

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
      toast.loading('Uploading media...', { id: 'submit' });
      
      let mediaUrls: string[] = [];
      if (file) {
        const url = await alertService.uploadMedia(file);
        mediaUrls = [url];
      }

      toast.loading('Submitting report...', { id: 'submit' });
      
      await createAlertMutation.mutateAsync({
        ...formData,
        location: {
          type: 'Point',
          coordinates: [position[1], position[0]] // GeoJSON [lng, lat]
        },
        mediaUrls
      });

      toast.success('Report submitted successfully!', { id: 'submit' });
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit report', { id: 'submit' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Report an Incident</h2>
        <p className="text-muted-foreground mt-1">Provide details about the environmental hazard to help us take action.</p>
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
              <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-50 px-2 sm:bg-transparent">
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
        <CardContent className="p-6 sm:p-8 min-h-[400px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Incident Title</Label>
                        <Input id="title" placeholder="e.g., Illegal waste dumping near river" className="mt-1.5" {...register('title')} />
                        {errors.title && <p className="text-red-500 text-xs mt-1">{String(errors.title.message)}</p>}
                      </div>
                      <div>
                        <Label htmlFor="address">Approximate Address</Label>
                        <Input id="address" placeholder="e.g., 123 River Road, District 1" className="mt-1.5" {...register('address')} />
                        {errors.address && <p className="text-red-500 text-xs mt-1">{String(errors.address.message)}</p>}
                      </div>
                      <div>
                        <Label htmlFor="description">Detailed Description</Label>
                        <Textarea id="description" placeholder="Describe what you saw in detail..." className="mt-1.5 h-32" {...register('description')} />
                        {errors.description && <p className="text-red-500 text-xs mt-1">{String(errors.description.message)}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">Pin Location</h3>
                    <p className="text-sm text-muted-foreground mb-4">Click on the map to set the exact coordinates of the incident.</p>
                    
                    <div className="h-[350px] w-full rounded-xl overflow-hidden border shadow-inner relative z-0">
                      <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationPicker position={position} setPosition={setPosition} />
                      </MapContainer>
                    </div>
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Selected Coordinates:</span>
                      <span className="font-mono font-medium">{position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">Upload Evidence</h3>
                    <p className="text-sm text-muted-foreground mb-4">Our AI will automatically analyze the image to categorize the incident.</p>
                    
                    {!previewUrl ? (
                      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/30 bg-muted/10">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                          <p className="mb-2 text-sm text-muted-foreground font-semibold">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (Max 10MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border bg-muted">
                        <img src={previewUrl} alt="Preview" className="w-full max-h-[350px] object-contain" />
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => { setFile(null); setPreviewUrl(null); }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Review & Submit</h3>
                    
                    <div className="bg-muted/30 p-6 rounded-xl space-y-6 border">
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Title</h4>
                          <p className="font-medium">{getValues('title')}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Location</h4>
                          <p className="font-medium text-sm">{getValues('address')}</p>
                          <p className="text-xs font-mono mt-0.5 text-muted-foreground">{position[0].toFixed(4)}, {position[1].toFixed(4)}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                        <p className="text-sm">{getValues('description')}</p>
                      </div>

                      {previewUrl && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Evidence Preview</h4>
                          <div className="w-24 h-24 rounded-lg overflow-hidden border">
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

          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handlePrev}
              disabled={currentStep === 1 || createAlertMutation.isPending}
            >
              Back
            </Button>
            
            {currentStep < 4 ? (
              <Button onClick={handleNext}>Next Step</Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={createAlertMutation.isPending}
              >
                {createAlertMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
