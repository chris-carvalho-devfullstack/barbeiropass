import { AppointmentsWorkspace } from "@/components/appointments/appointments-workspace";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default function ProfessionalAppointmentsPage() {
  return <AppointmentsWorkspace mode="professional" />;
}
