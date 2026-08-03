import { Outlet } from "react-router-dom";
import OfficerSidebar from "./OfficerSidebar";
import OfficerTopbar from "./OfficerTopbar";
import { AssistantLauncher } from "@/features/assistant/components/AssistantLauncher";

export default function OfficerLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <OfficerSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <OfficerTopbar />
        <main className="flex-1 overflow-y-auto bg-background p-4 pb-20 md:p-6">
          <Outlet />
        </main>
      </div>
      <AssistantLauncher />
    </div>
  );
}


