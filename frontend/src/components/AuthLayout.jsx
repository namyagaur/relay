import React from "react";
import RelayLogo from "@/components/layout/RelayLogo";

export default function AuthLayout({ title, subtitle, footer = undefined, children }) {
  return (
    <div className="auth-page flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center sm:mb-8">
          <div className="mb-7 inline-flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14)]">
              <RelayLogo className="h-[18px] w-[18px]" />
            </span>
            <span className="text-lg font-semibold tracking-[-0.035em]">Relay</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="surface-shadow rounded-2xl border border-border bg-card p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Namya Gaur. All rights reserved.
        </p>
      </div>
    </div>
  );
}
