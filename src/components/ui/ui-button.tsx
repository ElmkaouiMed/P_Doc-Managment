import {
  AiSearchIcon,
  AiSettingIcon,
  Cancel01Icon,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Upload04Icon,
  FileExportIcon,
  GridViewIcon,
  HierarchyFilesIcon,
  LayoutTable01Icon,
  LayoutTemplate,
  NotificationIcon,
  PackageIcon,
  UserSquareIcon,
  Logout04Icon, 
  MoreVerticalCircle01Icon
} from "@hugeicons/core-free-icons";

import { HugIcon } from "@/components/ui/hug-icon";
import { cn } from "@/lib/utils";

type UiButtonVariant = "primary" | "ghost" | "subtle" | "danger" | "outline";
type UiButtonSize = "xs" | "sm" | "md" | "lg";

const buttonIconMap = {
  plus: CirclePlus,
  logout: Logout04Icon,
  menu:MoreVerticalCircle01Icon,
  close: Cancel01Icon,
  search: AiSearchIcon,
  export: FileExportIcon,
  import: Upload04Icon,
  table: LayoutTable01Icon,
  grid: GridViewIcon,
  settings: AiSettingIcon,
  left: ChevronLeft,
  right: ChevronRight,
  template: LayoutTemplate,
  documents: HierarchyFilesIcon,
  user: UserSquareIcon,
  product: PackageIcon,
  notification: NotificationIcon,
  remove: Cancel01Icon,
} as const;

export type UiButtonIconName = keyof typeof buttonIconMap;

interface UiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  iconOnly?: boolean;
  iconName?: UiButtonIconName;
  icon?: unknown | UiButtonIconName;
  iconPosition?: "left" | "right";
  iconSize?: number;
  label?: React.ReactNode;
}

export function UiButton({
  className,
  variant = "outline",
  size = "md",
  iconOnly = false,
  iconName,
  icon,
  iconPosition = "left",
  iconSize = 14,
  label,
  children,
  ...props
}: UiButtonProps) {
  const resolvedIcon =
    typeof icon === "string"
      ? buttonIconMap[icon as UiButtonIconName]
      : icon || (iconName ? buttonIconMap[iconName] : undefined);
  const resolvedLabel = label ?? children;
  const isIconOnly = iconOnly || (!!resolvedIcon && !resolvedLabel);

  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60";

  const variantStyles: Record<UiButtonVariant, string> = {
    primary: "border-primary/40 bg-primary/10 text-primary hover:border-primary hover:text-primary-foreground",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground",
    subtle: "border-border bg-background/60 text-muted-foreground hover:border-primary/60 hover:text-foreground",
    danger: "border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive hover:text-destructive-foreground",
    outline: "border-border bg-background/60 text-muted-foreground hover:border-primary/60 hover:text-foreground",
  };

  const sizeStyles = isIconOnly
    ? {
        xs: "h-7 w-7",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-11 w-11",
      }[size]
    : {
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base",
      }[size];

  const ariaLabel = props["aria-label"] ?? (isIconOnly ? (typeof resolvedLabel === "string" ? resolvedLabel : iconName) : undefined);

  return (
    <button className={cn(baseStyles, variantStyles[variant], sizeStyles, className)} {...props} aria-label={ariaLabel}>
      {resolvedIcon && (isIconOnly || iconPosition === "left") ? <HugIcon icon={resolvedIcon} size={iconSize} className="shrink-0" /> : null}
      {!isIconOnly ? resolvedLabel : !resolvedIcon ? resolvedLabel : null}
      {resolvedIcon && !isIconOnly && iconPosition === "right" ? <HugIcon icon={resolvedIcon} size={iconSize} className="shrink-0" /> : null}
    </button>
  );
}
