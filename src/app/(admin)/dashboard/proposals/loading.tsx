import { AdminTableSkeleton } from "@/components/admin/AdminPageSkeletons";

export default function ProposalsLoading() {
  return <AdminTableSkeleton rows={6} columns={7} summaryCards={4} action />;
}
