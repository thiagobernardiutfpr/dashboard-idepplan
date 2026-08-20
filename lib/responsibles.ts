export const RESPONSIBLE_OPTIONS = [
  "Thiago Bernardi",
  "Isadora Resges",
  "Isadora Araújo",
  "Ana Júlia",
  "Márcio Travagli",
  "Paulo César",
  "Ellen",
  "Nilton Fornaciari",
  "Bianca",
] as const;

export type ResponsibleName = (typeof RESPONSIBLE_OPTIONS)[number];

export function isResponsibleName(value: unknown): value is ResponsibleName {
  return (
    typeof value === "string" &&
    RESPONSIBLE_OPTIONS.includes(value as ResponsibleName)
  );
}
