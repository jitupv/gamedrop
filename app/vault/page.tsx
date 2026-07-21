import { redirect } from "next/navigation";

// the vault now lives on the homepage
export default function Vault() {
  redirect("/");
}
