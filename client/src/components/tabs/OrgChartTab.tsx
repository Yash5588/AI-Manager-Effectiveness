import { motion } from "framer-motion";
import { BarChart3, Zap, Users, Building2 } from "lucide-react";
import type { Manager, Employee, EmployeeCoachingProfile, AttritionPrediction } from "@/lib/api";

interface OrgChartTabProps {
    manager: Manager;
    employees: Employee[];
    coachingProfiles?: EmployeeCoachingProfile[];
    attritionPredictions?: AttritionPrediction[];
}

function getCategoryFromScore(score: number): string {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    return "Needs Improvement";
}

function getCategoryColor(category: string) {
    switch (category) {
        case "Excellent": return "text-emerald-400";
        case "Good": return "text-blue-400";
        case "Average": return "text-amber-400";
        default: return "text-red-400";
    }
}

function getCategoryBg(cat: string) {
    switch (cat) {
        case "Excellent": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        case "Good": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        case "Average": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        default: return "bg-red-500/10 text-red-400 border-red-500/20";
    }
}

function getScoreColor(score: number) {
    if (score >= 75) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
}

function getBarColor(score: number) {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
}

function computeEES(profile: EmployeeCoachingProfile, flightRiskOverride?: number): number {
    const achievement = profile.achievementScore;
    const runRate = profile.runRate;
    const retention = 100 - (flightRiskOverride ?? profile.attritionRisk);
    const sentiment = profile.feedbackSentiment * 100;
    const rating = (profile.performanceRating / 5) * 100;
    const engagement = Math.min(100, profile.feedbackCount * 20);
    return Math.round(
        achievement * 0.25 +
        runRate * 0.20 +
        retention * 0.15 +
        sentiment * 0.15 +
        rating * 0.15 +
        engagement * 0.10
    );
}

const OrgChartTab = ({ manager, employees, coachingProfiles = [], attritionPredictions = [] }: OrgChartTabProps) => {
    const category = getCategoryFromScore(manager.effectivenessScore);

    const getEmployeeEES = (emp: Employee): number => {
        const profile = coachingProfiles.find(p => p._id === emp._id || p.name === emp.name);
        if (!profile) return 0;
        const attrition = attritionPredictions.find(a => a.employeeName === emp.name);
        return computeEES(profile, attrition?.flightRisk);
    };

    return (
        <div className="space-y-6">
            {/* Manager (root) Node */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
            >
                <div
                    className={`glass-card rounded-xl p-5 border-2 text-center w-72 ${manager.effectivenessScore >= 70
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : manager.effectivenessScore >= 50
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-red-500/30 bg-red-500/5"
                        }`}
                >
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
                        {manager.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <p className="font-display font-bold text-foreground">{manager.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {manager.department}
                    </p>
                    {manager.email && (
                        <p className="text-[10px] text-blue-400 mt-1">{manager.email}</p>
                    )}

                    {/* Score + Sentiment */}
                    <div className="flex justify-center gap-4 mt-4 mb-3">
                        <div className="text-center">
                            <div className="flex items-center gap-1 justify-center">
                                <BarChart3 className="h-3 w-3 text-primary" />
                                <p className={`text-lg font-bold ${getCategoryColor(category)}`}>
                                    {manager.effectivenessScore}%
                                </p>
                            </div>
                            <p className="text-[9px] text-muted-foreground">Score</p>
                        </div>
                        <div className="w-px bg-border" />
                        <div className="text-center">
                            <p className="text-lg font-bold text-foreground">
                                {Math.round(manager.sentimentScore * 100)}%
                            </p>
                            <p className="text-[9px] text-muted-foreground">Sentiment</p>
                        </div>
                    </div>

                    <span className={`inline-block text-[10px] px-3 py-1 rounded-lg border font-bold ${getCategoryBg(category)}`}>
                        {category}
                    </span>
                </div>

                {/* Connector line from manager to split point */}
                <div className="w-px h-8 bg-border" />
                <div className="w-3 h-3 rounded-full border-2 border-border bg-card" />
                <div className="w-px h-4 bg-border" />
            </motion.div>

            {/* Employees */}
            {employees.length > 0 ? (
                <div className="flex justify-center">
                    <div className="relative">
                        {/* Horizontal connector bar */}
                        {employees.length > 1 && (
                            <div
                                className="absolute top-0 h-px bg-border"
                                style={{
                                    left: `${100 / (employees.length * 2)}%`,
                                    right: `${100 / (employees.length * 2)}%`,
                                }}
                            />
                        )}
                        <div
                            className="grid gap-6"
                            style={{
                                gridTemplateColumns: `repeat(${Math.min(employees.length, 5)}, minmax(180px, 1fr))`,
                            }}
                        >
                            {employees.map((emp, i) => (
                                <motion.div
                                    key={emp._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 + i * 0.08 }}
                                    className="flex flex-col items-center"
                                >
                                    {/* Vertical connector to employee card */}
                                    <div className="w-px h-4 bg-border" />

                                    <div className="glass-card rounded-xl p-4 border border-border/60 w-full text-center hover:border-blue-500/30 transition-colors">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-xs font-bold mx-auto mb-2">
                                            {emp.name.split(" ").map(n => n[0]).join("")}
                                        </div>
                                        <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{emp.role}</p>

                                        {/* EES */}
                                        {(() => {
                                            const ees = getEmployeeEES(emp);
                                            return (
                                                <>
                                                    <div className="flex items-center justify-center gap-1 mt-2">
                                                        <Zap className={`h-3.5 w-3.5 ${getScoreColor(ees)}`} />
                                                        <span className={`text-sm font-bold ${getScoreColor(ees)}`}>
                                                            {ees}%
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-muted-foreground mt-0.5">EES</p>

                                                    {/* EES bar */}
                                                    <div className="mt-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${ees}%` }}
                                                            transition={{ duration: 0.7, delay: 0.3 + i * 0.08 }}
                                                            className={`h-full rounded-full ${getBarColor(ees)}`}
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* If more than 5, show overflow in a second row */}
                        {employees.length > 5 && (
                            <div className="mt-6 text-center">
                                <p className="text-xs text-muted-foreground">
                                    Showing all {employees.length} team members
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12">
                    <Users className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No employees assigned</p>
                </div>
            )}

            {/* Team Summary Footer */}
            {employees.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex justify-center gap-4 pt-2"
                >
                    <span className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {employees.length} Team Member{employees.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-muted-foreground">
                        <Zap className="h-3 w-3 inline mr-1" />
                        Avg EES: {Math.round(employees.reduce((s, e) => s + getEmployeeEES(e), 0) / employees.length)}%
                    </span>
                </motion.div>
            )}
        </div>
    );
};

export default OrgChartTab;
