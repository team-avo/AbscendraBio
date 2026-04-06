import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { PaymentsContent } from "@/components/payments/payments-content";

export default function PaymentsPage() {
    return (
        <DashboardLayout>
            <PaymentsContent />
        </DashboardLayout>
    );
}
