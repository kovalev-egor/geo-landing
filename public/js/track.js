const buttons = document.querySelectorAll("[data-track='cta']");

for (const button of buttons) {
  button.addEventListener("click", () => trackClick(button));
}

async function trackClick(button) {
  if (button.dataset.pending === "1") return;
  button.dataset.pending = "1";
  button.disabled = true;

  const status = ensureStatus(button);
  const payload = {
    landing_id: document.body.dataset.landingId || "",
    variant: document.body.dataset.variant || "",
    country: document.body.dataset.country || "",
    region: document.body.dataset.region || "",
    city: document.body.dataset.city || "",
    offer_id: document.body.dataset.offerId || "",
  };
  const next = safeOutbound(document.body.dataset.offerUrl || "");

  try {
    const response = await fetch("/api/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) throw new Error(String(response.status));
    status.textContent = button.dataset.done || "Saved";
    if (next) location.assign(next);
  } catch {
    status.textContent = "The click could not be recorded. Try again.";
    button.disabled = false;
    button.dataset.pending = "0";
  }
}

function safeOutbound(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
  } catch {
    return "";
  }
  return "";
}

function ensureStatus(button) {
  const existing = button.parentElement?.querySelector(".track-status");
  if (existing) return existing;
  const status = document.createElement("p");
  status.className = "track-status";
  status.setAttribute("role", "status");
  button.insertAdjacentElement("afterend", status);
  return status;
}
