import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <ErrorBoundary context="dashboard">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
