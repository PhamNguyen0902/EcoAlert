import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegister } from '../hooks/hooks';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Leaf } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [formData, setFormData] = useState({
    fullName: '',
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
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password
      },
      {
        onSuccess: () => {
          toast.success('Registration successful! Please log in.');
          navigate('/login');
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Registration failed');
        }
      }
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm lg:w-96"
        >
          <div>
            <div className="flex items-center gap-2 font-bold text-2xl text-primary">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                <Leaf size={24} />
              </div>
              EcoAlert
            </div>
            <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
              Create an account
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:text-primary/80">
                Log in
              </Link>
            </p>
          </div>

          <div className="mt-10">
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <div className="mt-2">
                  <Input id="fullName" name="fullName" required value={formData.fullName} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email address</Label>
                <div className="mt-2">
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="mt-2">
                  <Input id="password" name="password" type="password" required value={formData.password} onChange={handleChange} />
                </div>
              </div>

              <div>
                <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? 'Creating account...' : 'Create account'}
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
          alt="Nature background"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
          <motion.h1 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl font-bold max-w-2xl"
          >
            Join the movement.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6 text-xl max-w-xl text-green-50"
          >
            By reporting environmental hazards, you are actively contributing to a cleaner, safer, and greener community.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
