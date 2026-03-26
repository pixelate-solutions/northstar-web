import {
  CalendarDays,
  ClipboardList,
  DollarSign,
  Home,
  Map,
  MapPinned,
  Package,
} from "lucide-react";

export const primaryNavItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/days", label: "All Days", icon: ClipboardList },
  { href: "/map", label: "Map", icon: MapPinned },
  { href: "/packing", label: "Packing", icon: Package },
  { href: "/budget", label: "Budget", icon: DollarSign },
  { href: "/reminders", label: "Reminders", icon: Map },
];

export const mobileNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/map", label: "Map", icon: MapPinned },
  { href: "/packing", label: "Packing", icon: Package },
  { href: "/reminders", label: "More", icon: ClipboardList },
];
