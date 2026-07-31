import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileText, Image as ImageIcon, Loader2, MapPin, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateAlert } from '@/hooks/hooks';
import { alertService } from '@/services/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EvidenceUploader } from '@/components/reports/EvidenceUploader';
import { ReportFormStepper, type ReportStep } from '@/components/reports/ReportFormStepper';
import { ReportPageHeader } from '@/components/reports/ReportPageHeader';
import { SelectedLocationCard } from '@/components/reports/SelectedLocationCard';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PickedLocation } from '@/components/location/LocationPickerModal';
import { reverseGeocoder } from '@/services/reverseGeocoder';

const LocationPickerModal = lazy(() =>
  import('@/components/location/LocationPickerModal').then(({ LocationPickerModal: Picker }) => ({ default: Picker })),
);

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
});

type ReportFormValues = z.infer<typeof schema>;

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

const DEFAULT_MAP_POSITION: [number, number] = [10.8494, 106.7537];
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
};

export default function CreateAlert() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const createAlertMutation = useCreateAlert();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLocation, setSelectedLocation] = useState<PickedLocation | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const submissionInProgressRef = useRef(false);

  const { register, trigger, getValues, setValue, watch, formState: { errors } } = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { title: '', description: '', address: '' },
  });

  const title = watch('title') ?? '';
  const description = watch('description') ?? '';
  const address = watch('address') ?? '';
  
  // Trạng thái isSubmitting được tính toán chung, không cần dùng useState
  const isSubmitting = createAlertMutation.isPending || isUploadingEvidence;
  
  const steps: ReportStep[] = [
    { id: 1, label: t('report_create.step1'), icon: FileText },
    { id: 2, label: t('report_create.step2'), icon: MapPin },
    { id: 3, label: t('report_create.step3'), icon: ImageIcon },
    { id: 4, label: t('report_create.step4'), icon: CheckCircle2 },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (addressQuery.trim() && showSuggestions) {
        void searchAddress(addressQuery);
      } else {
        setSuggestions([]);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [addressQuery, showSuggestions]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const searchAddress = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn`);
      if (!response.ok) throw new Error('Unable to search address');
      const results: unknown = await response.json();
      setSuggestions(Array.isArray(results) ? results.filter((item): item is AddressSuggestion => (
        typeof item?.display_name === 'string' && typeof item?.lat === 'string' && typeof item?.lon === 'string'
      )) : []);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getAddressForCoordinates = async (latitude: number, longitude: number) => {
    const resolvedAddress = await reverseGeocoder.reverseGeocode(latitude, longitude);
    return resolvedAddress || `Location at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };

  const confirmLocation = (location: PickedLocation) => {
    setSelectedLocation(location);
    setValue('address', location.address, { shouldValidate: true, shouldDirty: true });
    setAddressQuery(location.address);
    setSuggestions([]);
    setShowSuggestions(false);
    setIsLocationPickerOpen(false);
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const latitude = Number.parseFloat(suggestion.lat);
    const longitude = Number.parseFloat(suggestion.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      toast.error('This address does not include a valid location. Please choose another result.');
      return;
    }
    confirmLocation({ latitude, longitude, address: suggestion.display_name });
  };

  const handleGetCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Your browser does not support location services.');
      return;
    }

    setIsLocating(true);
    toast.loading('Finding your current location…', { id: 'geo' });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const locationAddress = await getAddressForCoordinates(coords.latitude, coords.longitude);
          confirmLocation({ latitude: coords.latitude, longitude: coords.longitude, address: locationAddress });
          toast.success('Current location selected.', { id: 'geo' });
        } catch {
          toast.error('We could not confirm your current location. Please try again.', { id: 'geo' });
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        toast.error('Location access was unavailable. Check your browser permission and try again.', { id: 'geo' });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select a JPG, PNG, or WEBP image.');
      return;
    }
    if (selectedFile.size > MAX_EVIDENCE_SIZE) {
      toast.error('The evidence image must be 10 MB or smaller.');
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    previewUrlRef.current = nextPreviewUrl;
    setFile(selectedFile);
    setPreviewUrl(nextPreviewUrl);
  };

  const handleRemoveFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setFile(null);
    setPreviewUrl(null);
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!await trigger(['title', 'description'])) return;
    }
    if (currentStep === 2) {
      const isAddressValid = await trigger('address');
      if (!isAddressValid || !selectedLocation) {
        toast.error('Select and confirm the incident location before continuing.');
        return;
      }
    }
    if (currentStep === 3 && !file) {
      toast.error('Please add one image as evidence before continuing.');
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  };

  const handleSubmit = async () => {
    if (isSubmitting || submissionInProgressRef.current || !file || !selectedLocation) return;

    try {
      submissionInProgressRef.current = true;
      const formData = getValues();
      
      setIsUploadingEvidence(true);
      toast.loading('Uploading evidence…', { id: 'submit' });
      
      const mediaUrl = await alertService.uploadMedia(file);
      toast.loading(t('report_create.submitting'), { id: 'submit' });

      await createAlertMutation.mutateAsync({
        title: formData.title,
        description: formData.description,
        address: formData.address,
        location: {
          type: 'Point',
          coordinates: [selectedLocation.longitude, selectedLocation.latitude],
        },
        mediaUrls: [mediaUrl],
      });

      toast.success('Report submitted successfully.', { id: 'submit' });
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Unable to submit the report. Please try again.'), { id: 'submit' });
    } finally {
      submissionInProgressRef.current = false;
      setIsUploadingEvidence(false);
    }
  };

  const nextActionLabel = currentStep === 1
    ? 'Continue to Location'
    : currentStep === 2
      ? 'Continue to Evidence'
      : 'Review Report';

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <ReportPageHeader
        title={t('report_create.title')}
        description="Provide accurate details so the appropriate authority can review and respond to the issue quickly."
        privacyNote="Your report, location, and evidence are used only to handle this environmental incident."
      />

      <div className="mt-6">
        <ReportFormStepper currentStep={currentStep} steps={steps} />
      </div>

      <Card className="mt-6 overflow-visible shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <form onSubmit={(event) => event.preventDefault()}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {currentStep === 1 ? (
                  <section aria-labelledby="incident-information-heading" className="mx-auto max-w-2xl space-y-7">
                    <div>
                      <p className="text-sm font-semibold text-primary">Step 1</p>
                      <h2 id="incident-information-heading" className="mt-1 text-2xl font-semibold tracking-tight">What happened?</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Describe what you observed so the response team can understand the issue before arriving.</p>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <Label htmlFor="title" className="font-semibold">{t('report_create.field_title')} <span className="text-destructive">*</span></Label>
                          <span className="text-xs text-muted-foreground">{title.length} characters</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Use a short, recognizable summary of the environmental issue.</p>
                        <Input id="title" className="mt-2 h-11" aria-invalid={Boolean(errors.title)} aria-describedby="title-help title-error" placeholder={t('report_create.field_title_placeholder')} {...register('title')} />
                        {errors.title ? <p id="title-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.title.message}</p> : null}
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between gap-3">
                          <Label htmlFor="description" className="font-semibold">{t('report_create.field_description')} <span className="text-destructive">*</span></Label>
                          <span className="text-xs text-muted-foreground">{description.length} characters</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Include what you saw, the scale of the issue, and any immediate risks to people or the environment.</p>
                        <Textarea id="description" className="mt-2 min-h-44 resize-y" aria-invalid={Boolean(errors.description)} aria-describedby="description-error" placeholder={t('report_create.field_description_placeholder')} {...register('description')} />
                        {errors.description ? <p id="description-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.description.message}</p> : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                {currentStep === 2 ? (
                  <section aria-labelledby="location-heading" className="mx-auto max-w-2xl space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-primary">Step 2</p>
                      <h2 id="location-heading" className="mt-1 text-2xl font-semibold tracking-tight">Where is the incident?</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the most accurate location available. The map picker lets you refine the pin before confirming it.</p>
                    </div>

                    <div className="relative">
                      <Label htmlFor="address-search" className="font-semibold">{t('report_create.field_address')} <span className="text-destructive">*</span></Label>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Search for an address, then select a result to confirm it.</p>
                      <div className="relative mt-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="address-search"
                          value={addressQuery}
                          className="h-11 pl-10 pr-10"
                          placeholder={t('report_create.field_address_placeholder')}
                          aria-invalid={Boolean(errors.address)}
                          aria-controls="location-search-results"
                          aria-expanded={showSuggestions && suggestions.length > 0}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAddressQuery(value);
                            setValue('address', value, { shouldValidate: false, shouldDirty: true });
                            setSelectedLocation(null);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                        />
                        {isSearching ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching addresses" /> : null}
                      </div>
                      {showSuggestions && suggestions.length > 0 ? (
                        <ul id="location-search-results" role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                          {suggestions.map((suggestion) => (
                            <li key={`${suggestion.lat}-${suggestion.lon}`} role="option">
                              <button type="button" className="w-full rounded-md px-3 py-2.5 text-left text-sm leading-5 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => handleSelectSuggestion(suggestion)}>
                                {suggestion.display_name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {errors.address ? <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.address.message}</p> : null}
                    </div>

                    <SelectedLocationCard
                      location={selectedLocation}
                      onChooseOnMap={() => setIsLocationPickerOpen(true)}
                      onUseCurrentLocation={handleGetCurrentLocation}
                      isLocating={isLocating}
                      disabled={isSubmitting}
                    />
                  </section>
                ) : null}

                {currentStep === 3 ? (
                  <section aria-labelledby="evidence-heading" className="mx-auto max-w-2xl space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-primary">Step 3</p>
                      <h2 id="evidence-heading" className="mt-1 text-2xl font-semibold tracking-tight">Add evidence <span className="text-destructive">*</span></h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">A clear image helps the team understand the report and supports automated triage. You can replace it before submitting.</p>
                    </div>
                    <EvidenceUploader file={file} previewUrl={previewUrl} onSelect={handleFileSelect} onRemove={handleRemoveFile} disabled={isSubmitting} isProcessing={isUploadingEvidence} />
                  </section>
                ) : null}

                {currentStep === 4 ? (
                  <section aria-labelledby="review-heading" className="mx-auto max-w-3xl space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-primary">Step 4</p>
                      <h2 id="review-heading" className="mt-1 text-2xl font-semibold tracking-tight">Review your report</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Please verify the information before submitting. You can track the report status after submission.</p>
                    </div>

                    <div className="overflow-hidden rounded-xl border divide-y">
                      <section className="p-4 sm:p-5" aria-labelledby="review-information-heading">
                        <div className="flex items-center justify-between gap-3">
                          <h3 id="review-information-heading" className="font-semibold">Incident information</h3>
                          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setCurrentStep(1)} disabled={isSubmitting}>Edit information</Button>
                        </div>
                        <p className="mt-4 font-medium">{title}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{description}</p>
                      </section>

                      <section className="p-4 sm:p-5" aria-labelledby="review-location-heading">
                        <div className="flex items-center justify-between gap-3">
                          <h3 id="review-location-heading" className="font-semibold">Selected location</h3>
                          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setCurrentStep(2)} disabled={isSubmitting}>Edit location</Button>
                        </div>
                        <p className="mt-4 text-sm leading-6">{address}</p>
                        {selectedLocation ? <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">Latitude</dt><dd className="mt-1 font-mono font-medium tabular-nums">{selectedLocation.latitude.toFixed(6)}</dd></div><div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">Longitude</dt><dd className="mt-1 font-mono font-medium tabular-nums">{selectedLocation.longitude.toFixed(6)}</dd></div></dl> : null}
                      </section>

                      <section className="p-4 sm:p-5" aria-labelledby="review-evidence-heading">
                        <div className="flex items-center justify-between gap-3">
                          <h3 id="review-evidence-heading" className="font-semibold">Evidence</h3>
                          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setCurrentStep(3)} disabled={isSubmitting}>Change image</Button>
                        </div>
                        {previewUrl && file ? <div className="mt-4 flex items-center gap-4"><img src={previewUrl} alt={`Evidence preview: ${file.name}`} className="h-20 w-24 rounded-lg border object-cover" /><div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB · Uploads on submission</p></div></div> : null}
                      </section>
                    </div>
                  </section>
                ) : null}
              </motion.div>
            </AnimatePresence>

            {/* Điều hướng */}
            <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
                disabled={currentStep === 1 || isSubmitting}
              >
                {t('btn.back')}
              </Button>

              {currentStep < steps.length ? (
                <Button type="button" onClick={() => void handleNext()} disabled={isSubmitting} className="min-w-[100px]">
                  {nextActionLabel}
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={() => void handleSubmit()} 
                  disabled={isSubmitting}
                  className="min-w-[140px]"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {isSubmitting ? t('report_create.submitting') : t('report_create.submit_confirm')}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isLocationPickerOpen ? (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
          <LocationPickerModal
            open={isLocationPickerOpen}
            initialPosition={selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : DEFAULT_MAP_POSITION}
            initialAddress={selectedLocation?.address || addressQuery || getValues('address')}
            onOpenChange={setIsLocationPickerOpen}
            onConfirm={confirmLocation}
          />
        </Suspense>
      ) : null}
    </div>
  );
}