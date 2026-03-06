const STORAGE_KEY = "ai-expense-tracker-v1";

const CATEGORY_HINTS = {
  Food: ["food", "restaurant", "dining", "swiggy", "zomato", "cafe"],
  Groceries: ["grocery", "groceries", "supermarket", "bigbasket", "dmart", "mart"],
  Transport: ["uber", "ola", "metro", "taxi", "transport", "fuel", "petrol", "diesel"],
  Shopping: ["shopping", "amazon", "flipkart", "myntra", "ecommerce", "online"],
  Bills: ["bill", "electricity", "utility", "recharge", "broadband", "gas", "water"],
  Subscriptions: ["subscription", "netflix", "spotify", "prime", "youtube", "ott"],
  Travel: ["flight", "hotel", "travel", "airline", "trip", "booking"],
  Health: ["pharmacy", "health", "hospital", "medicine", "apollo"],
  Entertainment: ["movie", "cinema", "entertainment", "game", "bookmyshow"],
  Other: []
};

const defaultState = {
  monthlyBudget: 50000,
  categories: ["Food", "Groceries", "Transport", "Shopping", "Bills", "Subscriptions", "Travel", "Health", "Entertainment", "Other"],
  cards: [
    { id: crypto.randomUUID(), name: "Default Credit Card", rewards: "1% all spends", bestCategories: ["Other"] },
    { id: crypto.randomUUID(), name: "UPI", rewards: "Direct account debit", bestCategories: ["Bills", "Other"] }
  ],
  transactions: [],
  theme: "light",
  openAiKey: ""
};

let state = loadState();
let spendBudgetChart;
let categoryChart;

const el = {
  expenseForm: document.getElementById("expenseForm"),
  budgetForm: document.getElementById("budgetForm"),
  categoryForm: document.getElementById("categoryForm"),
  cardForm: document.getElementById("cardForm"),
  kpis: document.getElementById("kpis"),
  txTable: document.getElementById("txTable"),
  category: document.getElementById("category"),
  card: document.getElementById("card"),
  monthFilter: document.getElementById("monthFilter"),
  searchInput: document.getElementById("searchInput"),
  monthlyBudget: document.getElementById("monthlyBudget"),
  insights: document.getElementById("insights"),
  optimizations: document.getElementById("optimizations"),
  date: document.getElementById("date"),
  themeToggle: document.getElementById("themeToggle"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  openAiKey: document.getElementById("openAiKey"),
  saveApiKey: document.getElementById("saveApiKey"),
  runLlmInsights: document.getElementById("runLlmInsights"),
  autoFetchCardBtn: document.getElementById("autoFetchCardBtn"),
  cardFetchStatus: document.getElementById("cardFetchStatus"),
  cardName: document.getElementById("cardName"),
  cardRewards: document.getElementById("cardRewards"),
  cardCategories: document.getElementById("cardCategories"),
  merchant: document.getElementById("merchant"),
  website: document.getElementById("website"),
  type: document.getElementById("type"),
  bestCardNow: document.getElementById("bestCardNow")
};

init();

function init() {
  if (state.theme === "dark") {
    document.body.classList.add("dark");
  }
  el.date.value = new Date().toISOString().slice(0, 10);
  el.monthlyBudget.value = state.monthlyBudget;
  el.openAiKey.value = state.openAiKey || "";
  bindEvents();
  renderAll();
}

function bindEvents() {
  el.expenseForm.addEventListener("submit", onAddTransaction);
  el.budgetForm.addEventListener("submit", onSaveBudget);
  el.categoryForm.addEventListener("submit", onAddCategory);
  el.cardForm.addEventListener("submit", onAddCard);
  el.searchInput.addEventListener("input", renderTransactions);
  el.monthFilter.addEventListener("change", renderTransactions);
  el.themeToggle.addEventListener("click", onToggleTheme);
  el.exportBtn.addEventListener("click", exportData);
  el.importInput.addEventListener("change", importData);
  el.saveApiKey.addEventListener("click", onSaveApiKey);
  el.runLlmInsights.addEventListener("click", onRunLlmInsights);
  el.autoFetchCardBtn.addEventListener("click", onAutoFetchCardFromWeb);
  el.category.addEventListener("change", renderLiveCardSuggestion);
  el.merchant.addEventListener("input", renderLiveCardSuggestion);
  el.website.addEventListener("input", renderLiveCardSuggestion);
  el.type.addEventListener("change", renderLiveCardSuggestion);
}

function onAddTransaction(e) {
  e.preventDefault();
  const tx = {
    id: crypto.randomUUID(),
    type: el.type.value,
    amount: Number(document.getElementById("amount").value),
    category: el.category.value,
    merchant: el.merchant.value.trim(),
    website: el.website.value.trim() || "-",
    cardId: el.card.value,
    date: el.date.value,
    notes: document.getElementById("notes").value.trim()
  };

  if (!tx.amount || tx.amount <= 0 || !tx.merchant || !tx.date) return;

  state.transactions.unshift(tx);
  saveState();
  el.expenseForm.reset();
  el.date.value = new Date().toISOString().slice(0, 10);
  renderAll();
}

function onSaveBudget(e) {
  e.preventDefault();
  const value = Number(el.monthlyBudget.value);
  if (!Number.isFinite(value) || value < 0) return;
  state.monthlyBudget = value;
  saveState();
  renderAll();
}

function onAddCategory(e) {
  e.preventDefault();
  const input = document.getElementById("newCategory");
  const name = input.value.trim();
  if (!name || state.categories.includes(name)) return;
  state.categories.push(name);
  input.value = "";
  saveState();
  renderSelectors();
  renderLiveCardSuggestion();
}

function onAddCard(e) {
  e.preventDefault();
  const name = el.cardName.value.trim();
  const rewards = el.cardRewards.value.trim();
  const cats = el.cardCategories.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeCategory)
    .filter(Boolean);

  if (!name || !rewards) return;

  state.cards.push({
    id: crypto.randomUUID(),
    name,
    rewards,
    bestCategories: cats.length ? cats : ["Other"]
  });

  el.cardForm.reset();
  el.cardFetchStatus.textContent = "Card added.";
  saveState();
  renderSelectors();
  renderAll();
}

async function onAutoFetchCardFromWeb() {
  const cardName = el.cardName.value.trim();
  if (!cardName) {
    el.cardFetchStatus.textContent = "Enter card name first.";
    return;
  }

  el.autoFetchCardBtn.disabled = true;
  el.cardFetchStatus.textContent = "Fetching card rewards from web...";

  try {
    const profile = await fetchCardProfileFromWeb(cardName);
    el.cardRewards.value = profile.rewards;
    el.cardCategories.value = profile.bestCategories.join(", ");
    el.cardFetchStatus.textContent = `Fetched from web: ${profile.source}. Review and click Add Card.`;
  } catch (err) {
    el.cardFetchStatus.textContent = `Could not auto-fetch: ${err.message}`;
  } finally {
    el.autoFetchCardBtn.disabled = false;
  }
}

async function fetchCardProfileFromWeb(cardName) {
  const query = `${cardName} credit card rewards cashback benefits India`;
  const candidates = [
    `https://r.jina.ai/http://www.bing.com/search?q=${encodeURIComponent(query)}`,
    `https://r.jina.ai/http://duckduckgo.com/?q=${encodeURIComponent(query)}`
  ];

  let bestText = "";
  let bestSource = "web search";

  for (const url of candidates) {
    const text = await fetchTextWithTimeout(url, 12000);
    if (text && text.length > bestText.length) {
      bestText = text;
      bestSource = new URL(url.replace("https://r.jina.ai/http://", "https://")).hostname;
    }
    if (bestText.length > 2500) break;
  }

  if (!bestText) {
    throw new Error("No readable search result returned.");
  }

  const rewards = buildRewardSummary(bestText);
  const bestCategories = inferCategoriesFromText(bestText);

  return {
    rewards,
    bestCategories: bestCategories.length ? bestCategories : ["Other"],
    source: bestSource
  };
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function buildRewardSummary(text) {
  const compact = text.replace(/\s+/g, " ");
  const rateMatches = [...compact.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map(m => `${m[1]}%`);
  const uniqueRates = [...new Set(rateMatches)].slice(0, 3);

  const keyBits = [];
  if (/cashback/i.test(compact)) keyBits.push("cashback");
  if (/reward point/i.test(compact)) keyBits.push("reward points");
  if (/lounge/i.test(compact)) keyBits.push("lounge access");
  if (/fuel surcharge/i.test(compact)) keyBits.push("fuel surcharge waiver");

  const rates = uniqueRates.length ? `${uniqueRates.join(", ")} detected` : "web rewards detected";
  const extras = keyBits.length ? `; perks: ${keyBits.join(", ")}` : "";
  return `${rates}${extras}`;
}

function inferCategoriesFromText(text) {
  const normalized = text.toLowerCase();
  const matches = [];

  for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
    if (category === "Other") continue;
    if (hints.some(h => normalized.includes(h.toLowerCase()))) {
      matches.push(normalizeCategory(category));
    }
  }

  return [...new Set(matches)].filter(Boolean).slice(0, 4);
}

function normalizeCategory(name) {
  const map = state.categories.find(c => c.toLowerCase() === String(name).toLowerCase());
  return map || state.categories.find(c => c.toLowerCase() === "other") || "Other";
}

function renderLiveCardSuggestion() {
  if (el.type.value !== "expense") {
    el.bestCardNow.textContent = "Best card suggestion is only for expense transactions.";
    return;
  }

  const choice = pickBestCardForContext(el.category.value, el.merchant.value, el.website.value);
  if (!choice) {
    el.bestCardNow.textContent = "Add cards to get best-card suggestions.";
    return;
  }

  el.bestCardNow.textContent = `Best card now: ${choice.name} (${choice.reason})`;
}

function pickBestCardForContext(category, merchant, website) {
  if (!state.cards.length) return null;

  const merchantLc = (merchant || "").toLowerCase();
  const websiteLc = (website || "").toLowerCase();

  const scored = state.cards.map(card => {
    let score = 0;
    const reasons = [];
    const cardCats = card.bestCategories.map(v => v.toLowerCase());

    if (cardCats.includes(String(category).toLowerCase())) {
      score += 8;
      reasons.push(`strong ${category} rewards`);
    }

    const rewardsLc = String(card.rewards || "").toLowerCase();
    if (merchantLc && rewardsLc.includes(merchantLc)) {
      score += 4;
      reasons.push(`merchant match (${merchant})`);
    }

    if (websiteLc && websiteLc !== "-" && rewardsLc.includes(websiteLc)) {
      score += 4;
      reasons.push(`website match (${website})`);
    }

    const categoryHints = CATEGORY_HINTS[category] || [];
    if (categoryHints.some(h => rewardsLc.includes(h))) {
      score += 3;
      reasons.push("category keywords in rewards");
    }

    if (/\d/.test(rewardsLc) && /%/.test(rewardsLc)) {
      score += 1;
    }

    return { ...card, score, reason: reasons[0] || "general rewards" };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function onToggleTheme() {
  document.body.classList.toggle("dark");
  state.theme = document.body.classList.contains("dark") ? "dark" : "light";
  saveState();
}

function onSaveApiKey() {
  state.openAiKey = el.openAiKey.value.trim();
  saveState();
  addInsight("API key saved locally in your browser storage.", el.insights);
}

async function onRunLlmInsights() {
  const key = state.openAiKey;
  if (!key) {
    addInsight("Add API key first to run LLM insights.", el.insights);
    return;
  }

  const payload = buildSummaryForAI();
  addInsight("Running LLM analysis...", el.insights);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a financial optimizer. Give concise, practical saving actions based on transactions. Mention overspending categories, best card usage and best website timing tips."
          },
          {
            role: "user",
            content: JSON.stringify(payload)
          }
        ],
        temperature: 0.2
      })
    });

    if (!res.ok) {
      throw new Error(`LLM request failed (${res.status})`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "No response from model.";
    renderInsightList(text.split("\n").filter(Boolean), el.insights);
  } catch (err) {
    addInsight(`LLM error: ${err.message}`, el.insights);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expense-tracker-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.transactions || !parsed.categories || !parsed.cards) {
        throw new Error("Invalid backup format");
      }
      state = {
        ...defaultState,
        ...parsed
      };
      saveState();
      renderAll();
    } catch (err) {
      addInsight(`Import failed: ${err.message}`, el.insights);
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  renderSelectors();
  renderKpis();
  renderTransactions();
  renderCharts();
  runRuleBasedAI();
  renderLiveCardSuggestion();
}

function renderSelectors() {
  const catOptions = state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  el.category.innerHTML = catOptions;

  const cardOptions = state.cards.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  el.card.innerHTML = cardOptions;

  const monthList = ["all", ...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  el.monthFilter.innerHTML = monthList
    .map(m => `<option value="${m}">${m === "all" ? "All Months" : m}</option>`)
    .join("");
}

function renderKpis() {
  const month = currentMonthKey();
  const thisMonth = state.transactions.filter(t => t.date.startsWith(month));
  const expense = thisMonth.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const income = thisMonth.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const savings = income - expense;
  const budgetLeft = state.monthlyBudget - expense;

  const cards = [
    { label: "Monthly Expense", value: inr(expense) },
    { label: "Monthly Income", value: inr(income) },
    { label: "Net Savings", value: inr(savings) },
    { label: "Budget Left", value: inr(budgetLeft) }
  ];

  el.kpis.innerHTML = cards
    .map(c => `<div class="kpi"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`)
    .join("");
}

function renderTransactions() {
  const search = el.searchInput.value.trim().toLowerCase();
  const month = el.monthFilter.value || "all";

  const rows = state.transactions
    .filter(t => month === "all" || t.date.startsWith(month))
    .filter(t => [t.category, t.merchant, t.website].join(" ").toLowerCase().includes(search))
    .map(t => {
      const card = state.cards.find(c => c.id === t.cardId)?.name || "Unknown";
      return `
        <tr>
          <td>${t.date}</td>
          <td><span class="tag-${t.type}">${t.type}</span></td>
          <td>${inr(t.amount)}</td>
          <td>${escapeHtml(t.category)}</td>
          <td>${escapeHtml(t.merchant)}</td>
          <td>${escapeHtml(t.website)}</td>
          <td>${escapeHtml(card)}</td>
          <td><button class="delete-btn" data-id="${t.id}">Delete</button></td>
        </tr>
      `;
    })
    .join("");

  el.txTable.innerHTML = rows || `<tr><td colspan="8" class="muted">No transactions found.</td></tr>`;

  el.txTable.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.transactions = state.transactions.filter(t => t.id !== btn.dataset.id);
      saveState();
      renderAll();
    });
  });
}

function renderCharts() {
  const month = currentMonthKey();
  const thisMonthExpense = state.transactions
    .filter(t => t.type === "expense" && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0);

  const categorySpend = {};
  state.transactions
    .filter(t => t.type === "expense" && t.date.startsWith(month))
    .forEach(t => {
      categorySpend[t.category] = (categorySpend[t.category] || 0) + t.amount;
    });

  if (spendBudgetChart) spendBudgetChart.destroy();
  if (categoryChart) categoryChart.destroy();

  spendBudgetChart = new Chart(document.getElementById("spendBudgetChart"), {
    type: "bar",
    data: {
      labels: ["Spent", "Budget"],
      datasets: [{
        data: [thisMonthExpense, state.monthlyBudget],
        backgroundColor: ["#0e7a86", "#0e9f6e"],
        borderRadius: 12
      }]
    },
    options: { plugins: { legend: { display: false } }, responsive: true }
  });

  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(categorySpend),
      datasets: [{
        data: Object.values(categorySpend),
        backgroundColor: ["#38bdf8", "#14b8a6", "#0ea5e9", "#34d399", "#06b6d4", "#22c55e", "#60a5fa", "#0284c7"]
      }]
    },
    options: { responsive: true }
  });
}

function runRuleBasedAI() {
  const month = currentMonthKey();
  const thisMonth = state.transactions.filter(t => t.date.startsWith(month));
  const expenses = thisMonth.filter(t => t.type === "expense");
  const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

  const categoryMap = {};
  const merchantMap = {};
  const siteMap = {};

  expenses.forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    merchantMap[t.merchant] = (merchantMap[t.merchant] || 0) + t.amount;
    siteMap[t.website] = (siteMap[t.website] || 0) + t.amount;
  });

  const insights = [];
  const optimizations = [];

  if (totalExpense > state.monthlyBudget) {
    insights.push(`You are over budget by ${inr(totalExpense - state.monthlyBudget)} this month.`);
  } else {
    insights.push(`You are within budget by ${inr(state.monthlyBudget - totalExpense)} this month.`);
  }

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  topCategories.forEach(([cat, amt]) => {
    const pct = totalExpense ? Math.round((amt / totalExpense) * 100) : 0;
    if (pct >= 25) {
      insights.push(`High spend in ${cat}: ${inr(amt)} (${pct}% of this month expenses).`);
      const best = pickBestCardForContext(cat, "", "");
      if (best) {
        optimizations.push(`For ${cat}, prefer ${best.name}. Why: ${best.reason}.`);
      }
    }
  });

  const weekendSpend = expenses
    .filter(t => {
      const day = new Date(t.date).getDay();
      return day === 0 || day === 6;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  if (weekendSpend > totalExpense * 0.35 && totalExpense > 0) {
    insights.push(`Weekend spending is high at ${inr(weekendSpend)}. Consider weekly caps for leisure and food.`);
  }

  const recurringCandidates = Object.entries(merchantMap)
    .filter(([, amt]) => amt > 1000)
    .slice(0, 4);

  recurringCandidates.forEach(([merchant, amt]) => {
    optimizations.push(`Review ${merchant} (${inr(amt)} this month) for subscription or repeat-cost optimization.`);
  });

  const topSite = Object.entries(siteMap).sort((a, b) => b[1] - a[1])[0];
  if (topSite && topSite[0] !== "-") {
    const bestForSite = pickBestCardForContext("Other", "", topSite[0]);
    const line = bestForSite
      ? `Top website/app spend: ${topSite[0]} (${inr(topSite[1])}). Best card here: ${bestForSite.name}.`
      : `Top website/app spend: ${topSite[0]} (${inr(topSite[1])}). Compare alternatives before checkout.`;
    optimizations.push(line);
  }

  const bestCardByCategory = buildCardAdvice();
  bestCardByCategory.forEach(line => optimizations.push(line));

  if (!insights.length) insights.push("Add transactions to generate AI insights.");
  if (!optimizations.length) optimizations.push("Add more data to unlock website/card optimization tips.");

  renderInsightList(insights, el.insights);
  renderInsightList(optimizations, el.optimizations);
}

function buildCardAdvice() {
  const advice = [];
  const month = currentMonthKey();
  const categorySpend = {};

  state.transactions
    .filter(t => t.type === "expense" && t.date.startsWith(month))
    .forEach(t => {
      categorySpend[t.category] = (categorySpend[t.category] || 0) + t.amount;
    });

  for (const [category, amount] of Object.entries(categorySpend)) {
    const best = pickBestCardForContext(category, "", "");
    if (best) {
      advice.push(`For ${category} (${inr(amount)}), use ${best.name}. Reward logic: ${best.rewards}.`);
    }
  }

  const expensiveHours = spendingHourPattern();
  if (expensiveHours.length) {
    advice.push(`You mostly spend during ${expensiveHours.join(", ")}:00 hours. Create app/site checkout rules for those time windows.`);
  }

  return advice.slice(0, 8);
}

function spendingHourPattern() {
  const hourBuckets = new Array(24).fill(0);
  state.transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      const dt = new Date(t.date);
      if (!Number.isNaN(dt.getTime())) {
        hourBuckets[dt.getHours()] += t.amount;
      }
    });

  return hourBuckets
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .filter(x => x.v > 0)
    .map(x => x.i.toString().padStart(2, "0"));
}

function buildSummaryForAI() {
  const month = currentMonthKey();
  const tx = state.transactions.filter(t => t.date.startsWith(month));
  const expense = tx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = tx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

  return {
    month,
    monthlyBudget: state.monthlyBudget,
    expense,
    income,
    topTransactions: tx.slice(0, 40),
    cards: state.cards
  };
}

function addInsight(text, container) {
  const div = document.createElement("div");
  div.className = "insight-item";
  div.textContent = text;
  container.prepend(div);
}

function renderInsightList(lines, container) {
  container.innerHTML = "";
  lines.forEach(line => {
    const div = document.createElement("div");
    div.className = "insight-item";
    div.textContent = line;
    container.appendChild(div);
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    return {
      ...structuredClone(defaultState),
      ...JSON.parse(raw)
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function inr(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
