import React from "react";
import { Outlet } from "react-router-dom";
import { AppToaster } from "@/components/ui/app-toaster";
import OfficerSidebar from "./OfficerSidebar";
import OfficerTopbar from "./OfficerTopbar";

export default function OfficerLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <OfficerSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <OfficerTopbar />
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
      <AppToaster />
    </div>
  );
}

