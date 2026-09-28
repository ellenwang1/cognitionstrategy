import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva("relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "border-sky-200 bg-sky-50 text-sky-900 [&>svg]:text-sky-600 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100",
      success: "border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
      destructive: "border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-600 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100",
    },
  },
  defaultVariants: { variant: "default" },
});

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";
export { Alert };
