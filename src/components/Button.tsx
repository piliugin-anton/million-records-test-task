import type { ButtonHTMLAttributes, ReactNode } from "react";

const primaryClass =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-[#23685a] px-3.5 text-white disabled:cursor-not-allowed disabled:opacity-45";

const iconClass =
  "inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-[#23685a] p-0 text-white";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "icon";
  children: ReactNode;
};

export function Button({ variant, className, children, ...props }: ButtonProps) {
  const base = variant === "primary" ? primaryClass : iconClass;
  return (
    <button className={className ? `${base} ${className}` : base} {...props}>
      {children}
    </button>
  );
}
