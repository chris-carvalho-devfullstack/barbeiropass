import { QueueWorkspace } from "@/components/queue/queue-workspace";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function FilaDashboardPage() {
  return <QueueWorkspace mode="admin" />;
}
