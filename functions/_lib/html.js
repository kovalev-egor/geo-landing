export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

const RAW_KEYS = new Set(["preview"]);

export function applyTemplate(template, vars) {
  return String(template).replace(/\{\{([a-z_]+)\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const value = vars[key] ?? "";
    return RAW_KEYS.has(key) ? String(value) : escapeHtml(value);
  });
}
