import { HugeiconsIcon } from "@hugeicons/react";

interface HugIconProps {
  icon: unknown;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function HugIcon({
  icon,
  size = 18,
  className,
  strokeWidth = 1,
}: HugIconProps) {
  return (
    <HugeiconsIcon
      icon={icon as never}
      size={size}
      strokeWidth={strokeWidth}
      color="currentColor"
      className={className}
    />
  );
}

