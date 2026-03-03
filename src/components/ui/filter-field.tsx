import { FormField } from "@/components/ui/form-field";

type FilterOption = {
  value: string;
  label: string;
};

interface FilterFieldProps {
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  onChange?: (value: string) => void;
  options?: FilterOption[];
}

export function FilterField({ value = "", placeholder, icon, onChange, options }: FilterFieldProps) {
  const isSelect = Array.isArray(options) && options.length > 0;

  if (isSelect) {
    return (
      <FormField
        type="select"
        value={value}
        onChange={onChange}
        options={options}
      />
    );
  }

  return (
    <FormField
      type="text"
      value={value}
      placeholder={placeholder}
      icon={icon}
      onChange={onChange}
    />
  );
}
