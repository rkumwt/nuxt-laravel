const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Blade's {{ }} escaping
export const escapeHtml = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]!);
