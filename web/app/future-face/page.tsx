import { redirect } from "next/navigation";

/** FutureFace は削除 */
export default function FutureFaceRedirect() {
  redirect("/dashboard");
}
