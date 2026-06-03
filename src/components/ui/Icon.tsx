import { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ icon: LucideIconComponent, size = 16, strokeWidth = 1.75, className = "" }: IconProps) {
  return <LucideIconComponent size={size} strokeWidth={strokeWidth} className={className} />;
}
