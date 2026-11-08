import { redirect } from "next/navigation";
export default function DraftsPage() {
  redirect("/my-articles?status=draft");
}
