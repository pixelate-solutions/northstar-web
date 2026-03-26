import {
  Bell,
  CalendarDays,
  DollarSign,
  Home,
  MapPinned,
  Package,
} from "lucide-react";

export const primaryNavItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Days", icon: CalendarDays },
  { href: "/packing", label: "Packing", icon: Package },
  { href: "/budget", label: "Budget", icon: DollarSign },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

export const mobileNavItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Days", icon: MapPinned },
  { href: "/packing", label: "Packing", icon: Package },
  { href: "/budget", label: "Budget", icon: DollarSign },
  { href: "/reminders", label: "Reminders", icon: Bell },
];
