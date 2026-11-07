/**
 * CheckoutGuard - Popup Controller
 * Synchronizes user budget and friction preferences with chrome.storage.local.
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEFAULTS = {
    isEnabled: true,
    monthlyBudget: 300,
    currentSpent: 120,
    cooldownSeconds: 15,
  };

  const guardToggle = document.getElementById("guardToggle");
  const monthlyBudgetInput = document.getElementById("monthlyBudget");
  const currentSpentInput = document.getElementById("currentSpent");
  const cooldownSelect = document.getElementById("cooldownSeconds");
  const remainingAmountEl = document.getElementById("remainingAmount");
  const percentDisplayEl = document.getElementById("percentDisplay");
  const budgetProgressEl = document.getElementById("budgetProgress");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusToast = document.getElementById("statusToast");

  /**
   * Calculate remaining budget and update the visual gauge.
   */
  function updateUI(budget, spent) {
    const remaining = Math.max(0, budget - spent);
    const percent = Math.min(100, Math.round((spent / budget) * 100));

    remainingAmountEl.textContent = `£${remaining.toFixed(2)}`;
    percentDisplayEl.textContent = `${percent}% spent`;
    budgetProgressEl.style.width = `${percent}%`;

    if (percent > 100) {
      budgetProgressEl.style.backgroundColor = "#ef4444";
    } else if (percent >= 80) {
      budgetProgressEl.style.backgroundColor = "#f59e0b";
    } else {
      budgetProgressEl.style.backgroundColor = "#2563eb";
    }
  }

  /**
   * Load stored settings or populate defaults.
   */
  function loadSettings() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      // Running standalone/preview mode
      updateUI(DEFAULTS.monthlyBudget, DEFAULTS.currentSpent);
      return;
    }

    chrome.storage.local.get(DEFAULTS, (data) => {
      guardToggle.checked = data.isEnabled;
      monthlyBudgetInput.value = data.monthlyBudget;
      currentSpentInput.value = data.currentSpent;
      cooldownSelect.value = data.cooldownSeconds;

      updateUI(Number(data.monthlyBudget), Number(data.currentSpent));
    });
  }

  /**
   * Save form values to chrome.storage.local.
   */
  function saveSettings() {
    const budget = parseFloat(monthlyBudgetInput.value) || DEFAULTS.monthlyBudget;
    const spent = parseFloat(currentSpentInput.value) || 0;
    const cooldown = parseInt(cooldownSelect.value, 10) || DEFAULTS.cooldownSeconds;
    const isEnabled = guardToggle.checked;

    const payload = {
      isEnabled,
      monthlyBudget: budget,
      currentSpent: spent,
      cooldownSeconds: cooldown,
    };

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(payload, () => {
        updateUI(budget, spent);
        showToast("Settings saved successfully!");
      });
    } else {
      updateUI(budget, spent);
      showToast("Saved locally (Preview)");
    }
  }

  /**
   * Reset demonstration figures.
   */
  function resetDemo() {
    monthlyBudgetInput.value = DEFAULTS.monthlyBudget;
    currentSpentInput.value = DEFAULTS.currentSpent;
    cooldownSelect.value = 10; // set to 10s for fast live demos
    guardToggle.checked = true;
    saveSettings();
  }

  function showToast(msg) {
    statusToast.textContent = msg;
    statusToast.style.display = "block";
    setTimeout(() => {
      statusToast.style.display = "none";
    }, 2000);
  }

  // Live input calculation
  monthlyBudgetInput.addEventListener("input", () => {
    updateUI(parseFloat(monthlyBudgetInput.value) || 0, parseFloat(currentSpentInput.value) || 0);
  });
  currentSpentInput.addEventListener("input", () => {
    updateUI(parseFloat(monthlyBudgetInput.value) || 0, parseFloat(currentSpentInput.value) || 0);
  });

  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetDemo);
  guardToggle.addEventListener("change", saveSettings);

  // Initialize
  loadSettings();
});
