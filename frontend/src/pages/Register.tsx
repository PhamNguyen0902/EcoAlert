import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useConfirmOtp, useRegister, useResendOtp } from '../hooks/hooks';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api-error';

import { ThemeToggle } from '../components/ui/theme-toggle';
import { useLanguage } from '../contexts/LanguageContext';
// trang đăng ký
export default function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const confirmOtpMutation = useConfirmOtp();
  const resendOtpMutation = useResendOtp();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  //xử lý đăng ký
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    const trimmedEmail = formData.email.trim();
    registerMutation.mutate(
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: trimmedEmail,
        password: formData.password
      },
      {
        onSuccess: (data: any) => {
          const payload = data?.data ?? data;
          const message =
            payload?.message ||
            data?.message ||
            "Mã OTP 6 số đã được gửi tới email của bạn. Vui lòng nhập mã để kích hoạt tài khoản.";
          toast.success(message, { duration: 6000 });
          if (payload?.requiresOtp === false) {
            navigate('/login');
            return;
          }
          setPendingEmail(payload?.email || trimmedEmail);
          setOtpCode('');
          setResendCooldown(30);
          setStep('otp');
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, t('toast.register_failed')));
        }
      }
    );
  };

  const handleConfirmOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otpCode.trim();
    if (!cleanedOtp) {
      toast.error('Vui lòng nhập mã OTP.');
      return;
    }
    confirmOtpMutation.mutate(
      { email: pendingEmail, code: cleanedOtp },
      {
        onSuccess: (data: any) => {
          toast.success(
            data?.message || data?.data?.message || 'Kích hoạt tài khoản thành công! Vui lòng đăng nhập.',
            { duration: 4000 },
          );
          navigate('/login');
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, 'Xác thực mã OTP thất bại.'));
        },
      },
    );
  };

  const handleResendOtp = () => {
    if (!pendingEmail || resendCooldown > 0 || resendOtpMutation.isPending) return;
    resendOtpMutation.mutate(
      { email: pendingEmail },
      {
        onSuccess: (data: any) => {
          toast.success(
            data?.message || data?.data?.message || 'Đã gửi lại mã OTP tới email của bạn.',
          );
          setResendCooldown(30);
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, 'Không thể gửi lại mã OTP.'));
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm lg:w-96"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-2xl text-primary">
                <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                  <Leaf size={24} />
                </div>
                EcoAlert
              </div>
              <ThemeToggle />
            </div>
            <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-foreground">
              Tạo tài khoản
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-semibold text-primary hover:text-primary/80">
                Đăng nhập
              </Link>
            </p>
          </div>

          <div className="mt-10">
            {step === 'otp' ? (
              <form onSubmit={handleConfirmOtp} className="space-y-6">
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Mã xác thực 6 chữ số đã được gửi tới{' '}
                  <span className="font-semibold text-foreground">{pendingEmail}</span>.
                </div>

                <div>
                  <Label htmlFor="otpCode">Mã xác thực OTP</Label>
                  <div className="mt-2">
                    <Input
                      id="otpCode"
                      name="otpCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="Nhập 6 chữ số OTP"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={confirmOtpMutation.isPending || otpCode.trim().length < 4}
                  >
                    {confirmOtpMutation.isPending ? 'Đang xác thực...' : 'Xác nhận mã OTP'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={resendCooldown > 0 || resendOtpMutation.isPending}
                    onClick={handleResendOtp}
                  >
                    {resendOtpMutation.isPending
                      ? 'Đang gửi lại...'
                      : resendCooldown > 0
                        ? `Gửi lại mã OTP (${resendCooldown}s)`
                        : 'Gửi lại mã OTP'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setStep('register')}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    Quay lại sửa thông tin đăng ký
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Họ</Label>
                  <div className="mt-2">
                    <Input id="firstName" name="firstName" placeholder="" required value={formData.firstName} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="lastName">Tên</Label>
                  <div className="mt-2">
                    <Input id="lastName" name="lastName" placeholder="" required value={formData.lastName} onChange={handleChange} />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="email">Địa chỉ email</Label>
                <div className="mt-2">
                  <Input id="email" name="email" type="email" placeholder="example@gmail.com" required value={formData.email} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="mt-2 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                <div className="mt-2 relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </Button>
              </div>
            </form>
            )}
          </div>
        </motion.div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block bg-green-900">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-multiply"
          src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=2013&auto=format&fit=crop"
          alt="Hình nền thiên nhiên"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
          <motion.h1 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl font-bold max-w-2xl"
          >
            Tham gia phong trào.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6 text-xl max-w-xl text-green-50"
          >
            Bằng việc báo cáo các mối nguy hại môi trường, bạn đang tích cực đóng góp vào một cộng đồng sạch hơn, an toàn hơn và xanh hơn.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
