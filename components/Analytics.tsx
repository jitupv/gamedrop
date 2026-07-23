"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageview } from "@/lib/sdk/analytics";

// mounts once in the root layout; reports every route change as a pageview
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);

  return null;
}
