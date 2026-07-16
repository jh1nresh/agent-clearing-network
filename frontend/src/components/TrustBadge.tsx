"use client";

interface TrustBadgeProps {
  successRate: number; // 0-100
  rating: number; // 0-5
  jobsCompleted: number; // 0+
  size?: "sm" | "md" | "lg";
}

/**
 * TrustBadge - displays an agent's trust score as a circular badge
 *
 * Trust Score Formula:
 *   (successRate * 0.4) + (rating/5 * 0.3) + (min(jobsCompleted,100)/100 * 0.3) * 100
 *
 * Color coding:
 *   - Red: < 40
 *   - Yellow: 40-70
 *   - Green: > 70
 */
export default function TrustBadge({
  successRate,
  rating,
  jobsCompleted,
  size = "md",
}: TrustBadgeProps) {
  // Calculate trust score
  const normalizedSuccessRate = Math.min(Math.max(successRate, 0), 100) / 100;
  const normalizedRating = Math.min(Math.max(rating, 0), 5) / 5;
  const normalizedJobs = Math.min(jobsCompleted, 100) / 100;

  const trustScore = Math.round(
    (normalizedSuccessRate * 0.4 +
      normalizedRating * 0.3 +
      normalizedJobs * 0.3) *
      100
  );

  // Determine color based on score
  const getColor = () => {
    if (trustScore < 40) {
      return {
        bg: "bg-red-900/10",
        border: "border-red-800",
        text: "text-red-800",
        ring: "stroke-red-800",
      };
    }
    if (trustScore <= 70) {
      return {
        bg: "bg-amber-800/10",
        border: "border-amber-700",
        text: "text-amber-800",
        ring: "stroke-amber-700",
      };
    }
    return {
      bg: "bg-green-900/10",
      border: "border-green-800",
      text: "text-green-800",
      ring: "stroke-green-800",
    };
  };

  const colors = getColor();

  // Size variants
  const sizes = {
    sm: {
      container: "w-7 h-7",
      text: "text-[9px]",
      strokeWidth: 2,
      radius: 10,
    },
    md: {
      container: "w-10 h-10",
      text: "text-[11px]",
      strokeWidth: 2.5,
      radius: 16,
    },
    lg: {
      container: "w-14 h-14",
      text: "text-sm",
      strokeWidth: 3,
      radius: 22,
    },
  };

  const sizeConfig = sizes[size];
  const circumference = 2 * Math.PI * sizeConfig.radius;
  const strokeDashoffset = circumference - (trustScore / 100) * circumference;

  return (
    <div
      className={`relative ${sizeConfig.container} flex items-center justify-center`}
      title={`Trust Score: ${trustScore}/100`}
    >
      {/* Background circle */}
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 48 48"
        fill="none"
      >
        {/* Track */}
        <circle
          cx="24"
          cy="24"
          r={sizeConfig.radius}
          stroke="currentColor"
          strokeWidth={sizeConfig.strokeWidth}
          className="text-[#1a1a1a]/10"
          fill="none"
        />
        {/* Progress */}
        <circle
          cx="24"
          cy="24"
          r={sizeConfig.radius}
          strokeWidth={sizeConfig.strokeWidth}
          className={colors.ring}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>

      {/* Score text */}
      <span className={`font-mono font-bold ${sizeConfig.text} ${colors.text}`}>
        {trustScore}
      </span>
    </div>
  );
}
