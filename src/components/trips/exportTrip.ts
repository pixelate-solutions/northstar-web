import { toast } from "sonner";

function getFilenameFromDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "northstar-trip.html";
}

export async function downloadTripExport() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`/api/trips/export?tz=${encodeURIComponent(timeZone)}`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    toast.error(body?.error ?? "Unable to export trip.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFilenameFromDisposition(response.headers.get("Content-Disposition"));
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Trip exported.");
}
