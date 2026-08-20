import { zoningColor, zoningTextColor } from "@/lib/zoning-colors";

export function ZoningBadge({
  zone,
  className = "",
}: {
  zone: string | null | undefined;
  className?: string;
}) {
  const label = zone?.trim() || "Sem zona vinculada";
  return (
    <span
      className={`zoning-badge ${className}`.trim()}
      style={{
        backgroundColor: zoningColor(zone),
        color: zoningTextColor(zone),
      }}
    >
      {label}
    </span>
  );
}
