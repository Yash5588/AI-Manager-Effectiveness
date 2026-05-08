import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Sparkles, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AttritionRiskTab from "@/components/tabs/AttritionRiskTab";
import { type AttritionPrediction, type HRManager } from "@/lib/api";

interface AttritionModalProps {
    manager: HRManager | null;
    open: boolean;
    onClose: () => void;
    predictions: AttritionPrediction[];
    loading: boolean;
    onGenerate: (managerId: string) => void;
}

const AttritionModal = ({
    manager,
    open,
    onClose,
    predictions,
    loading,
    onGenerate,
}: AttritionModalProps) => {
    if (!manager) return null;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto"
            >
                <SheetHeader className="pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                        <UserMinus className="h-5 w-5 text-destructive" />
                        Attrition Risk Analysis
                    </SheetTitle>
                    <SheetDescription>
                        Identify flight risks in {manager.name}'s team
                    </SheetDescription>
                </SheetHeader>

                <div className="pt-4 space-y-4">
                    <Button
                        onClick={() => onGenerate(manager._id)}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        {loading ? "Analyzing..." : "Run Prediction"}
                    </Button>

                    <AttritionRiskTab
                        predictions={predictions}
                        loading={loading}
                        onGenerate={() => onGenerate(manager._id)}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default AttritionModal;
