import { redirect } from "next/navigation";

/** 表情筋トレは削除 */
export default function TrainingRedirect() {
  redirect("/dashboard");
}
