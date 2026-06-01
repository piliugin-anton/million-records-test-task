import type { InputHTMLAttributes } from "react";
import { textInputClass } from "./buttonStyles";

const bareClass = "min-w-0 bg-transparent text-[#17201b] outline-none";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "bare";
};

export function Input({ variant = "default", className, ...props }: InputProps) {
  const base = variant === "default" ? textInputClass : bareClass;
  return (
    <input className={className ? `${base} ${className}` : base} {...props} />
  );
}
