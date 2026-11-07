/**
 * Capital One Adaptive Guard - Popup Controller
 * Connects Emil's card balance, safe-zone targets, and ADHD impulse cooling queue.
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEFAULTS = {
    isEnabled: true,
    cardholder: "Emil",
    cardLimit: 1000,
    currentBalance: 280,
    safeTarget: 30, // 30% = £300
    cooldownSeconds: 15,
    coolingOffItems: [
      {
        id: "demo-item-1",
        title: "Wireless ANC Headphones",
        price: 69.99,
        store: "Apex Retail",
        savedAt: Date.now() - 10 * 60 * 1000,
        expiresAt: Date.now() + 20 * 60 * 1000,
      }
    ]
  };

  const guardToggle = document.getElementById("guardToggle");
  const balanceAmountEl = document.getElementById("balanceAmount");
  const percentDisplayEl = document.getElementById("percentDisplay");
  const budgetProgressEl = document.getElementById("budgetProgress");
  const safeRemainingEl = document.getElementById("safeRemaining");
  const cooldownSelect = document.getElementById("cooldownSeconds");
  const coolingListEl = document.getElementById("coolingList");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusToast = document.getElementById("statusToast");

  let currentSettings = { ...DEFAULTS };

  function renderBalance(limit, balance, targetPercent) {
    const percent = Math.round((balance / limit) * 100);
    const targetAmount = (limit * targetPercent) / 100;
    const remainingBuffer = Math.max(0, targetAmount - balance);

    balanceAmountEl.textContent = `£${balance.toFixed(2)}`;
    percentDisplayEl.textContent = `${percent}% of £${limit.toFixed(0)}`;
    budgetProgressEl.style.width = `${Math.min(100, percent)}%`;

    if (percent > 50) {
      budgetProgressEl.style.backgroundColor = "#dc2626";
      safeRemainingEl.textContent = "High utilization warning";
      safeRemainingEl.style.color = "#b91c1c";
    } else if (percent >= targetPercent) {
      budgetProgressEl.style.backgroundColor = "#d97706";
      safeRemainingEl.textContent = `£${(balance - targetAmount).toFixed(2)} above target`;
      safeRemainingEl.style.color = "#92400e";
    } else {
      budgetProgressEl.style.backgroundColor = "#16a34a";
      safeRemainingEl.textContent = `£${remainingBuffer.toFixed(2)} buffer left`;
      safeRemainingEl.style.color = "#166534";
    }
  }

  function renderCoolingList(items) {
    coolingListEl.innerHTML = "";
    if (!items || items.length === 0) {
      coolingListEl.innerHTML = `
        <li style="color: #64748b; font-size: 11px; text-align: center; padding: 8px 0;">
          No items cooling off right now.
        </li>
      `;
      return;
    }

    items.forEach((item) => {
      const remainingMs = Math.max(0, (item.expiresAt || Date.now()) - Date.now());
      const remainingMins = Math.ceil(remainingMs / 60000);

      const li = document.createElement("li");
      li.className = "cooling-item";
      li.innerHTML = `
        <div class="cooling-header">
          <span>${item.title}</span>
          <span style="color: #003087;">£${Number(item.price).toFixed(2)}</span>
        </div>
        <div class="cooling-sub">
          <span>${item.store || "Online Store"} · ⏳ ${remainingMins}m cooling remaining</span>
        </div>
        <div class="cooling-actions">
          <button class="cooling-btn btn-saved" data-id="${item.id}" data-price="${item.price}">
            ✓ I don't need this (Save £${Number(item.price).toFixed(2)})
          </button>
        </div>
      `;
      coolingListEl.appendChild(li);
    });

    // Attach click listeners to "I don't need this"
    coolingListEl.querySelectorAll(".btn-saved").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.dataset.id;
        const price = e.currentTarget.dataset.price;
        removeCoolingItem(id, price);
      });
    });
  }

  function removeCoolingItem(id, price) {
    currentSettings.coolingOffItems = currentSettings.coolingOffItems.filter(i => i.id !== id);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ coolingOffItems: currentSettings.coolingOffItems });
    }
    renderCoolingList(currentSettings.coolingOffItems);
    showToast(`🎉 Impulse skipped! Saved £${Number(price).toFixed(2)}.`);
  }

  function loadSettings() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      renderBalance(DEFAULTS.cardLimit, DEFAULTS.currentBalance, DEFAULTS.safeTarget);
      renderCoolingList(DEFAULTS.coolingOffItems);
      return;
    }

    chrome.storage.local.get(DEFAULTS, (data) => {
      currentSettings = { ...DEFAULTS, ...data };
      guardToggle.checked = currentSettings.isEnabled;
      cooldownSelect.value = String(currentSettings.cooldownSeconds || 15);

      renderBalance(currentSettings.cardLimit, currentSettings.currentBalance, currentSettings.safeTarget);
      renderCoolingList(currentSettings.coolingOffItems);
    });
  }

  function saveSettings() {
    currentSettings.isEnabled = guardToggle.checked;
    currentSettings.cooldownSeconds = parseInt(cooldownSelect.value, 10) || 15;

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(currentSettings, () => {
        showToast("Settings saved to Capital One Guard!");
      });
    } else {
      showToast("Saved locally (Preview)");
    }
  }

  function resetDemo() {
    currentSettings = { ...DEFAULTS };
    guardToggle.checked = true;
    cooldownSelect.value = "10";
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(currentSettings, () => {
        renderBalance(currentSettings.cardLimit, currentSettings.currentBalance, currentSettings.safeTarget);
        renderCoolingList(currentSettings.coolingOffItems);
        showToast("Demo reset to Emil's initial state (£280 balance).");
      });
    } else {
      renderBalance(currentSettings.cardLimit, currentSettings.currentBalance, currentSettings.safeTarget);
      renderCoolingList(currentSettings.coolingOffItems);
      showToast("Demo reset.");
    }
  }

  function showToast(msg) {
    statusToast.textContent = msg;
    statusToast.style.display = "block";
    setTimeout(() => {
      statusToast.style.display = "none";
    }, 2400);
  }

  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetDemo);
  guardToggle.addEventListener("change", saveSettings);

  loadSettings();
});
