"use client";

import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";

import { HugIcon } from "@/components/ui/hug-icon";

type PasswordFieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className: string;
  showLabel: string;
  hideLabel: string;
};

export function PasswordField({
  label,
  name,
  placeholder,
  required = false,
  minLength,
  className,
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-1 text-xs w-full">
      {label}
      <div className="relative w-full">
        <input
          name={name}
          type={visible ? "text" : "password"}
          className={`${className} [padding-inline-end:2.5rem] w-full `}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground [inset-inline-end:0.65rem]"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
        >
          <HugIcon icon={visible ? ViewOffSlashIcon : ViewIcon} size={16} />
        </button>
      </div>
    </label>
  );
}

