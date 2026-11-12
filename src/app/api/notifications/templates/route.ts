import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  listNotificationTemplates,
  updateNotificationTemplate,
} from "@/server/notifications/queue";
import { renderNotificationTemplate } from "@/server/notifications/template";

export const runtime = "nodejs";

const updateTemplateSchema = z
  .object({
    key: z.enum(["staff.created", "access.role_assigned"]),
    titleTemplate: z.string().trim().min(1).max(160),
    bodyTemplate: z.string().trim().min(1).max(2_000),
    isEnabled: z.boolean(),
    honorsQuietHours: z.boolean(),
  })
  .strict();

const templateVariables = {
  "staff.created": { name: "Nama staf" },
  "access.role_assigned": { roleName: "Nama peran" },
} as const;

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "settings.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola template.", 403);
  }

  return NextResponse.json({ templates: await listNotificationTemplates() });
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "settings.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola template.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali template notifikasi.", 400);
  }

  try {
    const variables = templateVariables[parsed.data.key];
    renderNotificationTemplate(parsed.data.titleTemplate, variables);
    renderNotificationTemplate(parsed.data.bodyTemplate, variables);
  } catch {
    return apiError(
      "TEMPLATE_INVALID",
      "Template berisi placeholder yang tidak tersedia atau tidak valid.",
      400,
    );
  }

  await updateNotificationTemplate(parsed.data.key, parsed.data, staff.id);
  return NextResponse.json({ ok: true });
}
