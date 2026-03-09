import { motion } from "framer-motion";

interface ScoreGaugeProps {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color?: "primary" | "accent" | "success" | "destructive";
  bare?: boolean;
}

const colorMap = {
  primary: "hsl(173, 58%, 39%)",
  accent: "hsl(38, 92%, 50%)",
  success: "hsl(152, 60%, 42%)",
  destructive: "hsl(0, 72%, 51%)",
};

const ScoreGauge = ({ label, value, max, suffix = "", color = "primary", bare = false }: ScoreGaugeProps) => {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;
  const strokeColor = colorMap[color];

  const Wrapper = bare ? "div" : motion.div;
  const wrapperProps = bare
    ? { className: "flex flex-col items-center" }
    : {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      transition: { duration: 0.5 },
      className: "glass-card rounded-lg p-6 flex flex-col items-center score-glow",
    };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-display font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {value}{suffix}
          </motion.span>
        </div>
      </div>
      <span className="mt-3 text-sm font-medium text-muted-foreground">{label}</span>
    </Wrapper>
  );
};

export default ScoreGauge;
