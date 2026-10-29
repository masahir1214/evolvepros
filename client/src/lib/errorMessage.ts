// tRPC reports input-validation failures as a JSON list of issues; turn that into one readable sentence.
export function errorMessage(error: { message: string }): string {
  try {
    const issues = JSON.parse(error.message);
    if (Array.isArray(issues) && issues[0]?.message) {
      const field = Array.isArray(issues[0].path) ? issues[0].path.join(".") : "";
      return field ? `${field}: ${issues[0].message}` : String(issues[0].message);
    }
  } catch { /* not JSON — a normal message */ }
  return error.message;
}
