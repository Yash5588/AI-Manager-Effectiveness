import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, LogIn, Shield, User } from "lucide-react";
import { motion } from "framer-motion";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"manager" | "employee">("manager");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(email, password, role);
            if (role === "manager") {
                navigate("/");
            } else {
                navigate("/employee/feedback");
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || "Login failed. Please try again.");
        } finally {
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
                        className="inline-flex items-center justify-center h-16 w-auto mb-4"
                    >
                        <img src="/darwinbox-logo.png" alt="Darwinbox" className="h-16 w-auto object-contain" />
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
                    {/* Role Selector */}
                    <div className="flex gap-2 mb-6">
                        <button
                            type="button"
                            onClick={() => setRole("manager")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${role === "manager"
                                ? "gradient-primary text-primary-foreground shadow-lg"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Shield className="h-4 w-4" />
                            Manager
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole("employee")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${role === "employee"
                                ? "gradient-primary text-primary-foreground shadow-lg"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <User className="h-4 w-4" />
                            Employee
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={role === "manager" ? "jordan.lee@company.com" : "sam.wilson@company.com"}
                                className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                required
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
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg gradient-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <LogIn className="h-4 w-4" />
                            )}
                            {loading ? "Signing in..." : `Sign in as ${role === "manager" ? "Manager" : "Employee"}`}
                        </button>
                    </form>

                    {/* Demo credentials hint */}
                    <div className="mt-6 p-3 rounded-lg bg-secondary/80 border border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Demo Credentials:</p>
                        {role === "manager" ? (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                                <p><span className="text-foreground font-medium">jordan.lee@company.com</span> / password123</p>
                                <p><span className="text-foreground font-medium">alex.morgan@company.com</span> / password123</p>
                                <p><span className="text-foreground font-medium">diana.prince@company.com</span> / password123</p>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                                <p><span className="text-foreground font-medium">sam.wilson@company.com</span> / password123</p>
                                <p><span className="text-foreground font-medium">bruce.w@company.com</span> / password123</p>
                                <p><span className="text-foreground font-medium">riley.green@company.com</span> / password123</p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
