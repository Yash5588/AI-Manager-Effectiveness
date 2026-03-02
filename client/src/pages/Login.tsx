import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, LogIn, CheckCircle2, Shield, User, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ROLE_CONFIG = {
    hr: { label: "HR", icon: Building2, color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/30" },
    manager: { label: "Manager", icon: Shield, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
    employee: { label: "Employee", icon: User, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
};

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [detectedRole, setDetectedRole] = useState<"manager" | "employee" | "hr" | null>(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        setDetectedRole(null);

        try {
            await login(email, password);

            // Read back the user from localStorage to get the auto-detected role
            const storedUser = localStorage.getItem("auth_user");
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                setDetectedRole(userData.role);

                // Short delay to show the detected role before navigating
                setTimeout(() => {
                    if (userData.role === "manager") {
                        navigate("/");
                    } else if (userData.role === "hr") {
                        navigate("/hr");
                    } else {
                        navigate("/employee/feedback");
                    }
                }, 1200);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || "Login failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="inline-flex items-center justify-center h-64 w-auto mb-10"
                    >
                        <img
                            src="/darwinbox-logo-clean.png"
                            alt="Darwinbox"
                            className="h-64 w-auto object-contain"
                            style={{ mixBlendMode: 'multiply' }}
                        />
                    </motion.div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        Manager Effectiveness
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        AI-Powered Analytics Dashboard
                    </p>
                </div>

                {/* Login Card */}
                <div className="glass-card rounded-xl p-8 border border-border">
                    {/* Detected Role Banner */}
                    <AnimatePresence mode="wait">
                        {detectedRole && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                className="mb-6"
                            >
                                <div className={`flex items-center gap-3 p-4 rounded-xl border ${ROLE_CONFIG[detectedRole].bg}`}>
                                    <CheckCircle2 className={`h-5 w-5 ${ROLE_CONFIG[detectedRole].color}`} />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-foreground">
                                            Authenticated as {ROLE_CONFIG[detectedRole].label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
                                    </div>
                                    {(() => {
                                        const Icon = ROLE_CONFIG[detectedRole].icon;
                                        return <Icon className={`h-5 w-5 ${ROLE_CONFIG[detectedRole].color}`} />;
                                    })()}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                required
                                disabled={!!detectedRole}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                required
                                disabled={!!detectedRole}
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !!detectedRole}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg gradient-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {loading && !detectedRole ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : detectedRole ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <LogIn className="h-4 w-4" />
                            )}
                            {loading && !detectedRole
                                ? "Authenticating..."
                                : detectedRole
                                    ? `Signed in as ${ROLE_CONFIG[detectedRole].label}`
                                    : "Sign In"}
                        </button>
                    </form>


                </div>
            </motion.div>
        </div>
    );
};

export default Login;
