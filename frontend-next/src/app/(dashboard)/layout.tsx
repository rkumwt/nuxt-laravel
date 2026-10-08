import AuthGuard from "@/components/auth/AuthGuard";
import AppLayout from "@/components/layout/AppLayout";

// Route group: wraps every page under (dashboard) without adding a URL segment
export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AuthGuard requireAuth>
			<AppLayout>{children}</AppLayout>
		</AuthGuard>
	);
}
