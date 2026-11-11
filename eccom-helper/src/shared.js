export function normalize(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[，。？！、；：""''（）【】《》,.?!;:"'()\[\]<>·—–\-_]/g, "")
    .toLowerCase();
}

export function setStatus(message) {
  const el = document.getElementById("as-status");
  if (el) el.textContent = message;
  console.log("[华讯助手]", message);
}
