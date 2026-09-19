import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * `md` suits the caregiver dashboard, where forms are dense. `lg` is for the
 * senior-facing screens: 15px type is small against their 17–18px base, and a
 * sign-in field is the one control that has to be unmistakable.
 *
 * Named `fieldSize` rather than `size` because `size` is already a native
 * attribute on both `<input>` and `<select>`.
 */
type FieldSize = "md" | "lg";

const inputBase =
  "w-full border border-ink-300 bg-white text-ink-900 transition-colors " +
  "placeholder:text-ink-400 focus:border-calm-500 disabled:bg-ink-100 disabled:text-ink-500";

const inputSize: Record<FieldSize, string> = {
  md: "rounded-xl px-3.5 py-2.5 text-[15px]",
  lg: "rounded-2xl px-4 py-3.5 text-lg",
};

const labelSize: Record<FieldSize, string> = {
  md: "text-sm",
  lg: "text-base",
};

function inputClassesFor(fieldSize: FieldSize = "md", extra?: string): string {
  return cn(inputBase, inputSize[fieldSize], extra);
}

const inputClasses = inputClassesFor("md");

interface FieldShellProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  fieldSize?: FieldSize;
}

export function FieldShell({
  label,
  htmlFor,
  hint,
  children,
  className,
  fieldSize = "md",
}: FieldShellProps) {
  return (
    <div className={cn("", className)}>
      <label htmlFor={htmlFor} className={cn("block font-semibold text-ink-700", labelSize[fieldSize])}>
        {label}
      </label>
      <div className={fieldSize === "lg" ? "mt-2" : "mt-1.5"}>{children}</div>
      {hint ? (
        <p className={cn("mt-1.5 text-ink-500", fieldSize === "lg" ? "text-sm" : "text-xs")}>{hint}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<ComponentProps<"input">, "className"> & {
  label: string;
  id: string;
  hint?: ReactNode;
  className?: string;
  fieldSize?: FieldSize;
  /** Extra classes for the input itself, e.g. room for a trailing button. */
  inputClassName?: string;
};

export function TextField({
  label,
  id,
  hint,
  className,
  fieldSize,
  inputClassName,
  ...input
}: TextFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} className={className} fieldSize={fieldSize}>
      <input id={id} {...input} className={inputClassesFor(fieldSize, inputClassName)} />
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
