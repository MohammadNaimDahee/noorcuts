interface NoorLogoProps {
  size?: number;
  className?: string;
  variant?: "full" | "mark";
}

export function NoorLogo({ size = 28, className = "", variant = "full" }: NoorLogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={variant === "mark" ? className : "shrink-0"}
    >
      <defs>
        <linearGradient id="nc-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="nc-gold" x1="24" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Main circle */}
      <circle cx="32" cy="32" r="30" fill="url(#nc-bg)" />

      {/* Crescent cutout — a lighter circle offset to create the moon shape */}
      <circle cx="24" cy="28" r="18" fill="#047857" opacity="0.5" />

      {/* Play triangle */}
      <path d="M27 19l18 13-18 13z" fill="url(#nc-gold)" />

      {/* Light rays */}
      <line x1="50" y1="10" x2="56" y2="4" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <line x1="54" y1="16" x2="60" y2="12" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="52" y1="6" x2="56" y2="2" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );

  if (variant === "mark") return mark;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-bold tracking-wide" style={{
          background: "linear-gradient(135deg, #34d399, #10b981)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          NOORCUTS
        </span>
        <span className="text-[7px] uppercase tracking-[0.3em] text-zinc-500 font-medium mt-[1px]">
          Studio
        </span>
      </div>
    </div>
  );
}
