import { ChevronDown } from "@hugeicons/core-free-icons";

import { HugIcon } from "@/components/ui/hug-icon";
import { cn } from "@/lib/utils";

export type FormFieldOption = {
  value: string;
  label: string;
};

type FormFieldType = "text" | "email" | "password" | "number" | "date" | "select" | "checkbox";

interface FormFieldProps {
  type?: FormFieldType;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  icon?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  name?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  list?: string;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  onChange?: (value: string) => void;
  onBlur?: (value: string) => void;
  onCheckedChange?: (checked: boolean) => void;
}

const baseInputClass =
  "h-9 w-full rounded-md border border-border bg-background/60 px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/40 focus:outline-none transition";

export function FormField({
  type = "text",
  label,
  hint,
  value,
  defaultValue,
  checked,
  defaultChecked,
  placeholder,
  options = [],
  icon,
  required = false,
  disabled = false,
  readOnly = false,
  id,
  name,
  min,
  max,
  step,
  list,
  autoComplete,
  className,
  inputClassName,
  onChange,
  onBlur,
  onCheckedChange,
}: FormFieldProps) {
  if (type === "checkbox") {
    return (
      <label className={cn("flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-foreground", className)}>
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
        <span>{label}</span>
        {hint ? <span className="[margin-inline-start:auto] text-[11px] text-muted-foreground">{hint}</span> : null}
      </label>
    );
  }

  const input = type === "select" ? (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        className={cn(baseInputClass, "appearance-none [padding-inline-end:2.25rem]", inputClassName)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-2.5 text-muted-foreground [inset-inline-end:0.75rem]">
        <HugIcon icon={ChevronDown} size={14} />
      </span>
    </div>
  ) : (
    <div className="relative">
      {icon ? <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground [inset-inline-start:0.75rem]">{icon}</span> : null}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        min={min}
        max={max}
        step={step}
        list={list}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
        className={cn(baseInputClass, icon ? "[padding-inline-start:2.25rem]" : "", inputClassName)}
      />
    </div>
  );

  if (!label) {
    return <div className={className}>{input}</div>;
  }

  return (
    <label className={cn("grid gap-1 text-xs", className)}>
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {input}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
