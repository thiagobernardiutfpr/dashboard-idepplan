import type { AssignmentModule } from "@/lib/dashboard-types";

export function assignmentKey(module: AssignmentModule, itemId: string) {
  return `${module}:${itemId}`;
}
