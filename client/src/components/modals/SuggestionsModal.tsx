import { motion } from "framer-motion";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Loader2,
    Sparkles,
    Lightbulb,
    ArrowUpRight,
} from "lucide-react";
import { type AISuggestion, type HRManager } from "@/lib/api";

function getCategoryColor(category: string) {
    if (category === "Excellent") return "text-emerald-400";
    if (category === "Good") return "text-blue-400";
    if (category === "Average") return "text-amber-400";
    return "text-red-400";
}

function getCategoryBg(cat: string) {
    if (cat === "Excellent") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (cat === "Good") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (cat === "Average") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
}

interface SuggestionsModalProps {
    manager: HRManager | null;
    open: boolean;
    onClose: () => void;
    suggestions: AISuggestion[];
    loading: boolean;
    onGenerate: (managerId: string) => void;
}

const SuggestionsModal = ({
    manager,
    open,
    onClose,
    suggestions,
    loading,
    onGenerate,
}: SuggestionsModalProps) => {
    if (!manager) return null;

    const categoryIcon: Record<string, string> = {
        communication: "💬",
        leadership: "👑",
        delegation: "🤝",
        growth: "📈",
        culture: "🌟",
    };

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto"
            >
                <SheetHeader className="pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        AI Suggestions
                    </SheetTitle>
                    <SheetDescription>
                        AI-powered improvement suggestions for {manager.name}
                    </SheetDescription>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
                                {manager.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">{manager.name}</p>
                                <p className="text-[10px] text-muted-foreground">{manager.department}</p>
                            </div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <span className={`text-sm font-bold ${getCategoryColor(manager.category)}`}>
                                {manager.effectivenessScore}%
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold ${getCategoryBg(manager.category)}`}>
                                {manager.category}
                            </span>
                        </div>
                    </div>
                </SheetHeader>

                <div className="pt-4">
                    <button
                        onClick={() => onGenerate(manager._id)}
                        disabled={loading}
                        className="w-full mb-4 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        {loading ? "Generating..." : "Generate Suggestions"}
                    </button>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Analyzing manager data...</p>
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-3">
                            {suggestions.map((sug, i) => {
                                const priorityColor =
                                    sug.priority === "high"
                                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                                        : sug.priority === "medium"
                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                        className="p-4 rounded-xl bg-secondary/30 border border-border/50"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{categoryIcon[sug.category] || "💡"}</span>
                                                <h4 className="font-medium text-foreground text-sm">{sug.title}</h4>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium capitalize ${priorityColor}`}>
                                                    {sug.priority}
                                                </span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground font-medium capitalize">
                                                    {sug.category}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                                            {sug.description}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                                            <span className="text-[10px] text-muted-foreground">Predicted:</span>
                                            <span className="text-xs font-bold text-emerald-400">
                                                {sug.predictedScore}%
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                (+{sug.predictedScore - manager.effectivenessScore})
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Lightbulb className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Click "Generate Suggestions" to get AI-powered recommendations.
                            </p>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default SuggestionsModal;
