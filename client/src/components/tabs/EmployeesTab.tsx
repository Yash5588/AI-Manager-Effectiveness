import { motion } from "framer-motion";
import { Mail, CalendarDays, Star } from "lucide-react";
import type { Employee } from "@/lib/api";

interface EmployeesTabProps {
  employees: Employee[];
}

const statusStyles = {
  active: "bg-success/15 text-success",
  "on-leave": "bg-accent/15 text-accent",
  probation: "bg-destructive/15 text-destructive",
};

const EmployeesTab = ({ employees }: EmployeesTabProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Team Members ({employees.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map((emp, i) => (
          <motion.div
            key={emp.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {emp.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{emp.name}</p>
                  <p className="text-xs text-muted-foreground">{emp.role}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusStyles[emp.status]}`}>
                {emp.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{emp.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Joined {emp.joinDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5" />
                <span>Performance: </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full gradient-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${emp.performanceScore}%` }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.6 }}
                  />
                </div>
                <span className="font-medium text-foreground">{emp.performanceScore}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EmployeesTab;
