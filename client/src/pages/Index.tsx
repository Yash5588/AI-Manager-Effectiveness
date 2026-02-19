import { useState, useEffect } from "react";
import { Brain, LayoutDashboard, Users, Lightbulb, UserCheck, Loader2, ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "@/components/tabs/OverviewTab";
import EmployeesTab from "@/components/tabs/EmployeesTab";
import SuggestionsTab from "@/components/tabs/SuggestionsTab";
import EmployeeSuggestionsTab from "@/components/tabs/EmployeeSuggestionsTab";
import {
  fetchManagers,
  fetchManager,
  fetchEmployees,
  fetchFeedbacks,
  fetchAISuggestions,
  fetchEmployeeSuggestions,
  type Manager,
  type Employee,
  type Feedback,
  type AISuggestion,
  type EmployeeSuggestion,
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [manager, setManager] = useState<Manager | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [empSugLoading, setEmpSugLoading] = useState(false);

  // 1. Load list of managers
  useEffect(() => {
    async function loadManagers() {
      try {
        const list = await fetchManagers();
        setManagers(list);
        if (list.length > 0) {
          handleManagerChange(list[0].id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to load managers:", e);
        setLoading(false);
      }
    }
    loadManagers();
  }, []);

  const handleManagerChange = async (managerId: string) => {
    setLoading(true);
    setEmployeeSuggestions([]);
    try {
      const mgr = await fetchManager(managerId);
      setManager(mgr);
      const [emps, fbs, sugs] = await Promise.all([
        fetchEmployees(mgr.id),
        fetchFeedbacks(mgr.id),
        fetchAISuggestions(mgr.id),
      ]);
      setEmployees(emps);
      setFeedbacks(fbs);
      setSuggestions(sugs);
    } catch (e) {
      console.error("Failed to load manager details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmployeeSuggestions = async () => {
    if (!manager) return;
    setEmpSugLoading(true);
    try {
      const result = await fetchEmployeeSuggestions(manager.id);
      setEmployeeSuggestions(result.employeeSuggestions);
    } catch (e) {
      console.error("Failed to generate employee suggestions:", e);
    } finally {
      setEmpSugLoading(false);
    }
  };

  if (loading && !manager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "employees", label: "Employees", icon: Users },
    { id: "suggestions", label: "AI Suggestions", icon: Lightbulb },
    { id: "employee-suggestions", label: "Employee Coaching", icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-foreground leading-none">
                Manager Effectiveness
              </h1>
              <p className="text-xs text-muted-foreground">AI-Powered Analytics Dashboard</p>
            </div>
          </div>

          {/* Manager Selector */}
          <div className="flex items-center gap-3">
            {manager && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">
                      {manager.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="text-left hidden sm:block">
                      <span className="block text-sm font-medium leading-none">{manager.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {managers.map((m) => (
                    <DropdownMenuItem key={m.id} onClick={() => handleManagerChange(m.id)}>
                      <div className="flex items-center gap-2 w-full">
                        <div className="h-5 w-5 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-[8px]">
                          {m.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.department}</span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-6 max-w-7xl">
        {manager ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab manager={manager} feedbacks={feedbacks} />
            </TabsContent>
            <TabsContent value="employees">
              <EmployeesTab employees={employees} />
            </TabsContent>
            <TabsContent value="suggestions">
              <SuggestionsTab suggestions={suggestions} currentScore={manager.effectivenessScore} />
            </TabsContent>
            <TabsContent value="employee-suggestions">
              <EmployeeSuggestionsTab
                employeeSuggestions={employeeSuggestions}
                currentScore={manager.effectivenessScore}
                loading={empSugLoading}
                onGenerate={handleGenerateEmployeeSuggestions}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-muted-foreground">Select a manager to view analytics.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
