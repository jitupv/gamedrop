"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();
  const onVault = pathname.startsWith("/vault");
  return (
    <nav className="seg">
      <Link href="/" className={onVault ? "" : "active"}>
        Today
      </Link>
      <Link href="/vault" className={onVault ? "active" : ""}>
        The Vault
      </Link>
    </nav>
  );
}
