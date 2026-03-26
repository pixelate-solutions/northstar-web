"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("Sidebar components must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const value = React.useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleSidebar: () => setCollapsed((current) => !current),
    }),
    [collapsed]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

function Sidebar({
  className,
  children,
}: React.ComponentProps<"aside">) {
  const { collapsed } = useSidebar();

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[7rem]" : "w-[19rem]"
        )}
      />
      <aside
        data-slot="sidebar"
        data-collapsible={collapsed ? "icon" : "expanded"}
        className={cn(
          "fixed left-7 top-5 z-30 hidden h-[calc(100vh-2.5rem)] max-h-[calc(100vh-2.5rem)] overflow-hidden rounded-[2.25rem] border border-white/40 bg-white/34 shadow-[0_28px_70px_rgba(117,123,187,0.16),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl transition-[width,transform] duration-300 ease-out lg:flex lg:flex-col",
          collapsed ? "w-[5.5rem]" : "w-72",
          className
        )}
      >
        {children}
      </aside>
    </>
  );
}

function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("relative shrink-0 border-b border-white/30 p-5", className)}
      {...props}
    />
  );
}

function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("shrink-0 border-t border-white/30 p-4", className)}
      {...props}
    />
  );
}

function SidebarContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}
      {...props}
    />
  );
}

function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarProvider,
  useSidebar,
};
