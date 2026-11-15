import { AdminCardsSkeleton } from "@/components/admin/AdminPageSkeletons";

export default function FeedbackLoading() {
  return <AdminCardsSkeleton count={6} action={false} />;
}
