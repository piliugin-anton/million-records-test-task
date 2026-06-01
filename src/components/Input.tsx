import type { InputHTMLAttributes } from "react";

const defaultClass =
  "h-10 min-w-0 rounded-md border border-[#cbd4cf] bg-white px-3 text-[#17201b] outline-none";

const bareClass = "min-w-0 bg-transparent text-[#17201b] outline-none";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "bare";
};

export function Input({ variant = "default", className, ...props }: InputProps) {
  const base = variant === "default" ? defaultClass : bareClass;
  return (
    <input className={className ? `${base} ${className}` : base} {...props} />
  );
}
