export function setStatus(message) {
  const el = document.getElementById("as-status");
  if (el) el.textContent = message;
  console.log("[eccom-tools]", message);
}
