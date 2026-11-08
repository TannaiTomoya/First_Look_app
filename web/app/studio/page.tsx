import { redirect } from "next/navigation";

/** 補正スタジオは美肌診断に統合 */
export default function StudioRedirect() {
  redirect("/skin");
}
