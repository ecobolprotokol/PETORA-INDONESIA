export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  const placeholderPattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/gu;
  const withoutPlaceholders = template.replace(placeholderPattern, "");
  if (withoutPlaceholders.includes("{{") || withoutPlaceholders.includes("}}")) {
    throw new Error("Template notifikasi memuat placeholder yang tidak valid.");
  }

  return template.replace(placeholderPattern, (_, key: string) => {
    if (!Object.hasOwn(variables, key)) {
      throw new Error(`Variabel template notifikasi "${key}" tidak tersedia.`);
    }
    return variables[key] ?? "";
  });
}
