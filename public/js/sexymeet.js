const waitEl = document.querySelector("[data-wait]");
if (waitEl) {
  let seconds = 80 + Math.floor(Math.random() * 45);
  const paint = () => {
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    waitEl.textContent = `${minutes}:${rest}`;
  };
  paint();
  setInterval(() => {
    seconds += 1;
    paint();
  }, 1000);
}

const girlsEl = document.querySelector("[data-girls]");
if (girlsEl) {
  let count = Number(girlsEl.textContent) || 18;
  setInterval(() => {
    count = Math.max(12, Math.min(26, count + (Math.random() > 0.5 ? 1 : -1)));
    girlsEl.textContent = String(count);
  }, 3200);
}

const menEl = document.querySelector("[data-men]");
if (menEl) {
  let count = Number(menEl.textContent) || 14;
  setInterval(() => {
    count = Math.max(9, Math.min(22, count + (Math.random() > 0.45 ? 1 : -1)));
    menEl.textContent = String(count);
  }, 4000);
}

const picks = document.querySelectorAll(".pick");
const cta = document.querySelector(".cta");
for (const pick of picks) {
  pick.addEventListener("click", () => {
    for (const item of picks) item.classList.remove("is-on");
    pick.classList.add("is-on");
    if (cta) cta.textContent = `Chat with ${pick.dataset.name} now`;
  });
}
