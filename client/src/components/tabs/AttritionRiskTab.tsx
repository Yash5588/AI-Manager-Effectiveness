import { useState } from "react";
import {
    AlertTriangle,
    TrendingUp,
    UserMinus,
    ShieldCheck,
    Info,
    Zap,
    ArrowRight,
    RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AttritionPrediction } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AttritionRiskTabProps {
    predictions: AttritionPrediction[];
    loading: boolean;
    onGenerate: () => void;
}

const AttritionRiskTab = ({ predictions, loading, onGenerate }: AttritionRiskTabProps) => {
    const [hoveredEmp, setHoveredEmp] = useState<string | null>(null);

    const getRiskColor = (level: string) => {
        switch (level) {
            case "High": return "text-destructive bg-destructive/10 border-destructive/20";
            case "Medium": return "text-warning bg-warning/10 border-warning/20";
            default: return "text-success bg-success/10 border-success/20";
        }
    };

    const getImpactColor = (level: string) => {
        switch (level) {
            case "High": return "text-primary bg-primary/10 border-primary/20";
            case "Medium": return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
            default: return "text-slate-500 bg-slate-500/10 border-slate-500/20";
        }
    };

    if (predictions.length === 0 && !loading) {
        return (
            <Card className="border-dashed border-2 bg-secondary/30">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl mb-2">Attrition Risk & Impact Analysis</CardTitle>
                    <CardDescription className="max-w-md mb-8">
                        Identify high-risk employees and understand the operational impact if they leave.
                        Receive AI-powered recommendations for retention or transition planning.
                    </CardDescription>
                    <Button onClick={onGenerate} size="lg" className="gradient-primary">
                        Run Analysis
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Team Health & Retention</h2>
                    <p className="text-muted-foreground italic">Predictive insights to manage flight risk and team stability.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onGenerate}
                    disabled={loading}
                    className="bg-card hover:bg-secondary border-border"
                >
                    {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh Analysis
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risk Breakdown Table */}
                <Card className="lg:col-span-2 overflow-hidden border-border bg-card/50 backdrop-blur-sm">
                    <CardHeader className="bg-secondary/20 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Employee Risk Priority
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border bg-secondary/10">
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flight Risk</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Impact Score</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {predictions.map((pred) => (
                                        <tr
                                            key={pred.employeeName}
                                            className={cn(
                                                "hover:bg-secondary/30 transition-colors cursor-pointer",
                                                hoveredEmp === pred.employeeName ? "bg-secondary/50" : ""
                                            )}
                                            onMouseEnter={() => setHoveredEmp(pred.employeeName)}
                                        >
                                            <td className="px-6 py-4">
                                                <span className="font-medium">{pred.employeeName}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 w-24 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-1000",
                                                                pred.flightRisk > 70 ? "bg-destructive" : pred.flightRisk > 40 ? "bg-warning" : "bg-success"
                                                            )}
                                                            style={{ width: `${pred.flightRisk}%` }}
                                                        />
                                                    </div>
                                                    <Badge variant="outline" className={cn("text-[10px] py-0", getRiskColor(pred.riskLevel))}>
                                                        {pred.flightRisk}%
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 w-24 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full"
                                                            style={{ width: `${pred.impactScore}%` }}
                                                        />
                                                    </div>
                                                    <Badge variant="outline" className={cn("text-[10px] py-0", getImpactColor(pred.impactLevel))}>
                                                        {pred.impactScore}%
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {(pred.riskLevel === 'High' && pred.impactLevel === 'High') ? (
                                                    <Badge className="bg-destructive text-destructive-foreground animate-pulse border-none">
                                                        Immediate Action
                                                    </Badge>
                                                ) : pred.riskLevel === 'High' ? (
                                                    <Badge className="bg-warning text-warning-foreground border-none">
                                                        Proactive Retention
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground border-border">
                                                        Stable
                                                    </Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Selected Highlight / AI Insights */}
                <div className="space-y-6">
                    {hoveredEmp ? (
                        <Card className="highlight-card relative overflow-hidden h-full border-primary/20">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle className="h-16 w-16" />
                            </div>
                            <CardHeader>
                                <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-primary">Insight Focus</CardDescription>
                                <CardTitle>{hoveredEmp}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-tighter">
                                        <Info className="h-3 w-3" /> AI Analysis
                                    </h4>
                                    <p className="text-sm leading-relaxed italic">
                                        {predictions.find(p => p.employeeName === hoveredEmp)?.rationale}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                                    <h4 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5 uppercase tracking-tight">
                                        <Zap className="h-3 w-3" /> Recommended Action
                                    </h4>
                                    <p className="text-sm font-medium">
                                        {predictions.find(p => p.employeeName === hoveredEmp)?.recommendation}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Flight Risk</p>
                                            <p className={cn(
                                                "text-xl font-bold",
                                                predictions.find(p => p.employeeName === hoveredEmp)?.flightRisk! > 60 ? "text-destructive" : "text-foreground"
                                            )}>
                                                {predictions.find(p => p.employeeName === hoveredEmp)?.flightRisk}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase">Impact Score</p>
                                            <p className="text-xl font-bold text-primary">
                                                {predictions.find(p => p.employeeName === hoveredEmp)?.impactScore}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="h-full border-dashed flex flex-col items-center justify-center text-center p-8 bg-secondary/10">
                            <UserMinus className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="text-sm text-muted-foreground">Hover over an employee to see specific AI insights and recommendations.</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* Strategic Recommendation */}
            <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
                <CardContent className="p-6 flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="font-bold mb-1">Team Stability Strategic Guidance</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Based on the current analysis, focus on employees in the <b>High Risk / High Impact</b> quadrant first.
                            Small interventions like scheduled 1-on-1s and visible career pathing can reduce flight risk by up to 40% for high-potential talent.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AttritionRiskTab;
