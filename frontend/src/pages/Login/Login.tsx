import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function Login() {
    const [email, setEmail] = useState('admin@demo.com');
    const [password, setPassword] = useState('Admin@123');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isWarmingUp, setIsWarmingUp] = useState(false);
    const [serverReady, setServerReady] = useState(false);
    const { login } = useAuthStore();
    const navigate = useNavigate();

    // Pre-warm backend and database as soon as login page loads
    useEffect(() => {
        const warmTimer = setTimeout(() => {
            setIsWarmingUp(true);
        }, 1200);

        api.get('/health')
            .then((res) => {
                clearTimeout(warmTimer);
                setIsWarmingUp(false);
                setServerReady(true);
                if (res.data?.database === 'disconnected') {
                    toast.error('Database connection is down. Please verify database status in Supabase.', {
                        id: 'db-status',
                        duration: 8000
                    });
                }
            })
            .catch(() => {
                setIsWarmingUp(true);
            });

        return () => clearTimeout(warmTimer);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            const { user, accessToken, refreshToken } = res.data.data;
            login(user, accessToken, refreshToken);
            toast.success(`Welcome back, ${user.name}!`);
            navigate('/dashboard');
        } catch (err: any) {
            const errorMessage = err.response?.data?.error || '';
            if (err.code === 'ECONNABORTED' || (!err.response && isWarmingUp)) {
                toast.error('Server is still waking up. Please wait 10-20 seconds and click Sign In again.', { duration: 6000 });
            } else if (err.response?.status === 503 || errorMessage.toLowerCase().includes('tenant') || errorMessage.toLowerCase().includes('database')) {
                toast.error('Database is paused or disconnected on Supabase. Please resume the project.', { duration: 8000 });
            } else {
                toast.error(errorMessage || 'Login failed. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0">
                <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md mx-4">
                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Asset Management</h1>
                        <p className="text-slate-400 mt-1 text-sm">Sign in to manage your assets</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white 
                  placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white 
                    placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all pr-12"
                                    placeholder="Enter password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {isWarmingUp && !serverReady && (
                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <span className="font-semibold block text-amber-300">Waking up cloud server...</span>
                                    <p className="text-slate-300/80 leading-relaxed text-[11px]">
                                        Render free-tier server is spinning up after inactivity (~30-45 seconds). Please wait a moment.
                                    </p>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl 
                font-semibold hover:opacity-90 transition-all shadow-lg shadow-indigo-500/30 
                disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* Demo credentials */}
                    <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs text-slate-400 font-medium mb-2">Demo Credentials:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                            <button onClick={() => { setEmail('admin@demo.com'); setPassword('Admin@123'); }}
                                className="text-left hover:text-indigo-400 transition-colors">
                                <span className="text-indigo-400">Admin:</span> admin@demo.com
                            </button>
                            <button onClick={() => { setEmail('manager@demo.com'); setPassword('Manager@123'); }}
                                className="text-left hover:text-indigo-400 transition-colors">
                                <span className="text-indigo-400">Manager:</span> manager@demo.com
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
