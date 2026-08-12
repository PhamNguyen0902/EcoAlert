import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegister } from '../hooks/hooks';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import { ThemeToggle } from '../components/ui/theme-toggle';
import { useLanguage } from '../contexts/LanguageContext';

export default function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      },
      {
        onSuccess: () => {
          toast.success(t('toast.register_success'));
          navigate('/login');
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || t('toast.register_failed'));
        }
      }
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
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Tên</Label>
                  <div className="mt-2">
                    <Input id="firstName" name="firstName" placeholder="" required value={formData.firstName} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="lastName">Họ</Label>
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
                    placeholder="Tối thiểu 6 ký tự"
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
                <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </Button>
              </div>
            </form>
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
