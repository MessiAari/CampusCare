import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-[#1F9A8B] to-teal text-white shadow-[0_8px_18px_-8px_rgba(22,124,112,0.75)] hover:-translate-y-0.5 hover:shadow-[0_12px_22px_-8px_rgba(22,124,112,0.8)] active:translate-y-0",
        navy: "bg-gradient-to-b from-navy-700 to-navy text-white shadow-[0_8px_18px_-8px_rgba(20,45,58,0.7)] hover:-translate-y-0.5 active:translate-y-0",
        outline: "border border-navy/15 bg-white text-navy hover:bg-mint",
        ghost: "text-navy hover:bg-navy/5",
        danger: "bg-danger text-white hover:bg-danger/90",
        amber: "bg-amber text-white hover:bg-amber/90",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
