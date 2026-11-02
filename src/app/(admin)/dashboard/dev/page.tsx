import { redirect } from "next/navigation";

export default function DevRedirectPage() {
    redirect("/dashboard/my-tasks");
}
