import {
  Bell,
  CalendarDays,
  DollarSign,
  Home,
  MapPinned,
  Package,
} from "lucide-react";

export const primaryNavItems = [
  { href: "/app", label: "Dashboard", icon: Home },
  { href: "/app/calendar", label: "Trip", icon: CalendarDays },
  { href: "/app/days", label: "Days", icon: MapPinned },
  { href: "/app/packing", label: "Packing", icon: Package },
  { href: "/app/budget", label: "Budget", icon: DollarSign },
  { href: "/app/reminders", label: "Reminders", icon: Bell },
];

export const mobileNavItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/calendar", label: "Trip", icon: CalendarDays },
  { href: "/app/days", label: "Days", icon: MapPinned },
  { href: "/app/packing", label: "Packing", icon: Package },
  { href: "/app/budget", label: "Budget", icon: DollarSign },
  { href: "/app/reminders", label: "Reminders", icon: Bell },
];
