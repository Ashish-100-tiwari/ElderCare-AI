import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const inputClasses =
  "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 " +
  "placeholder:text-ink-400 focus:border-calm-500 disabled:bg-ink-100 disabled:text-ink-500";

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FieldShell({ label, htmlFor, hint, children, className }: FieldShellProps) {
  return (
    <div className={cn("", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-700">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "className"> & {
  label: string;
  id: string;
  hint?: ReactNode;
  className?: string;
};

export function TextField({ label, id, hint, className, ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} className={className}>
      <input id={id} {...input} className={inputClasses} />
    </FieldShell>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "className"> & {
  label: string;
  id: string;
  hint?: ReactNode;
  className?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, id, hint, className, options, ...select }: SelectFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} className={className}>
      <select id={id} {...select} className={inputClasses}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "className"> & {
  label: string;
  id: string;
  hint?: ReactNode;
  className?: string;
};

export function TextAreaField({ label, id, hint, className, ...textarea }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} className={className}>
      <textarea id={id} {...textarea} className={cn(inputClasses, "resize-y")} />
    </FieldShell>
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}

export function ToggleField({ label, description, checked, onChange, id }: ToggleFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-200 bg-ink-50/60 p-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-ink-800">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-calm-600" : "bg-ink-300",
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
