const ENDPOINT = "/sparql";

const PREFIXES = `
PREFIX vgaccess: <http://www.semanticweb.org/alexagliuzza/ontologies/2026/4/VGAccess#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`;

function shortValue(value) {
  if (!value) return "";
  if (value.includes("#")) return value.split("#").pop();
  if (value.includes("/")) return value.replace(/\/$/, "").split("/").pop();
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLoading() {
  document.getElementById("loading").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading").classList.add("hidden");
}

async function runQuery(query) {
  const fullQuery = PREFIXES + query;
  document.getElementById("query-preview").textContent = fullQuery;
  showLoading();

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: fullQuery })
  });

  if (!response.ok) {
    const errorText = await response.text();
    hideLoading();
    throw new Error("Errore GraphDB: " + response.status + " - " + errorText);
  }

  const data = await response.json();
  hideLoading();

  return data.results.bindings.map(row => {
    const clean = {};
    for (const key in row) clean[key] = shortValue(row[key].value);
    return clean;
  });
}

function selectRole(role) {
  document.getElementById("role-section").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("results").innerHTML = "";
  document.getElementById("query-preview").textContent = "";

  if (role === "player") renderPlayerDashboard();
  if (role === "developer") renderDeveloperDashboard();
  if (role === "researcher") renderResearcherDashboard();
}

function goHome() {
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("role-section").classList.remove("hidden");
  document.getElementById("results").innerHTML = "";
  document.getElementById("controls").innerHTML = "";
  document.getElementById("query-preview").textContent = "";
  hideLoading();
}

/* =========================
   DASHBOARD GIOCATORE
   ========================= */

function renderPlayerDashboard() {
  document.getElementById("dashboard-title").textContent = "Dashboard Giocatore";
  document.getElementById("dashboard-description").textContent =
    "La compatibilità tra profilo e videogioco viene ricostruita passando dalle funzionalità di accessibilità e dalle esigenze che queste funzionalità supportano.";

  document.getElementById("controls").innerHTML = `
    <button onclick="showProfileRecommendations()">Consigli per profilo</button>
    <button onclick="showGamesByNeed()">Videogiochi per esigenza</button>
    <button onclick="showFeaturesByNeed()">Funzionalità per esigenza</button>
  `;
}

async function showProfileRecommendations() {
  const query = `
    SELECT DISTINCT ?profile ?need ?feature ?game ?title ?level
    WHERE {
      ?profile rdf:type vgaccess:ProfiloGiocatore ;
               vgaccess:haEsigenzaAccessibilita ?need .

      ?feature rdf:type vgaccess:FunzionalitaAccessibilita ;
               vgaccess:supportaEsigenza ?need .

      ?game rdf:type vgaccess:Videogioco ;
            vgaccess:haFunzionalitaAccessibilita ?feature .

      OPTIONAL { ?game vgaccess:haTitoloPrincipale ?title . }
      OPTIONAL { ?game vgaccess:haLivelloAccessibilita ?level . }
    }
    ORDER BY ?profile ?game ?feature
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "game", "Videogiochi consigliabili per profilo");
  } catch (error) {
    renderError(error);
  }
}

async function showGamesByNeed() {
  const query = `
    SELECT DISTINCT ?need ?game ?title ?feature ?level
    WHERE {
      ?feature rdf:type vgaccess:FunzionalitaAccessibilita ;
               vgaccess:supportaEsigenza ?need .

      ?game rdf:type vgaccess:Videogioco ;
            vgaccess:haFunzionalitaAccessibilita ?feature .

      OPTIONAL { ?game vgaccess:haTitoloPrincipale ?title . }
      OPTIONAL { ?game vgaccess:haLivelloAccessibilita ?level . }
    }
    ORDER BY ?need ?game ?feature
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "game", "Videogiochi raggruppati per esigenza");
  } catch (error) {
    renderError(error);
  }
}

async function showFeaturesByNeed() {
  const query = `
    SELECT DISTINCT ?need ?feature
    WHERE {
      ?feature rdf:type vgaccess:FunzionalitaAccessibilita ;
               vgaccess:supportaEsigenza ?need .
    }
    ORDER BY ?need ?feature
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "feature", "Funzionalità che supportano esigenze di accessibilità");
  } catch (error) {
    renderError(error);
  }
}

/* =========================
   DASHBOARD SVILUPPATORE
   ========================= */

function renderDeveloperDashboard() {
  document.getElementById("dashboard-title").textContent = "Dashboard Sviluppatore";
  document.getElementById("dashboard-description").textContent =
    "Analizza i videogiochi in base alle funzionalità accessibili e alle esigenze coperte.";

  document.getElementById("controls").innerHTML = `
    <button onclick="showAccessibilityRanking()">Numero di funzionalità per gioco</button>
    <button onclick="showNeedCoverageByGame()">Numero di esigenze coperte</button>
    <button onclick="showGameDetails()">Dettaglio funzionalità dei giochi</button>
  `;
}

async function showAccessibilityRanking() {
  const query = `
    SELECT ?game ?title ?level (COUNT(DISTINCT ?feature) AS ?numeroFunzionalita)
    WHERE {
      ?game rdf:type vgaccess:Videogioco ;
            vgaccess:haFunzionalitaAccessibilita ?feature .

      OPTIONAL { ?game vgaccess:haTitoloPrincipale ?title . }
      OPTIONAL { ?game vgaccess:haLivelloAccessibilita ?level . }
    }
    GROUP BY ?game ?title ?level
    ORDER BY DESC(?numeroFunzionalita)
  `;

  try {
    const rows = await runQuery(query);
    renderGameCards(rows, "Numero di funzionalità per videogioco");
  } catch (error) {
    renderError(error);
  }
}

async function showNeedCoverageByGame() {
  const query = `
    SELECT ?game ?title (COUNT(DISTINCT ?need) AS ?numeroEsigenze)
    WHERE {
      ?game rdf:type vgaccess:Videogioco ;
            vgaccess:haFunzionalitaAccessibilita ?feature .

      ?feature vgaccess:supportaEsigenza ?need .

      OPTIONAL { ?game vgaccess:haTitoloPrincipale ?title . }
    }
    GROUP BY ?game ?title
    ORDER BY DESC(?numeroEsigenze)
  `;

  try {
    const rows = await runQuery(query);
    renderGameCards(rows, "Numero di esigenze coperte per videogioco");
  } catch (error) {
    renderError(error);
  }
}

async function showGameDetails() {
  const query = `
    SELECT DISTINCT ?game ?title ?level ?feature ?need
    WHERE {
      ?game rdf:type vgaccess:Videogioco ;
            vgaccess:haFunzionalitaAccessibilita ?feature .

      OPTIONAL { ?feature vgaccess:supportaEsigenza ?need . }
      OPTIONAL { ?game vgaccess:haTitoloPrincipale ?title . }
      OPTIONAL { ?game vgaccess:haLivelloAccessibilita ?level . }
    }
    ORDER BY ?game ?feature ?need
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "game", "Dettaglio funzionalità dei videogiochi");
  } catch (error) {
    renderError(error);
  }
}

/* =========================
   DASHBOARD RICERCATORE
   ========================= */

function renderResearcherDashboard() {
  document.getElementById("dashboard-title").textContent = "Dashboard Ricercatore";
  document.getElementById("dashboard-description").textContent =
    "Esplora profili, relazioni inverse, classificazioni e allineamenti con risorse esterne.";

  document.getElementById("controls").innerHTML = `
    <button onclick="showClassificationPattern()">Classificazione dei videogiochi</button>
    <button onclick="showInverseProperties()">Proprietà inverse</button>
    <button onclick="showExternalLinks()">Allineamenti SKOS</button>
    <button onclick="showProfiles()">Profili ed esigenze</button>
  `;
}

async function showClassificationPattern() {
  const query = `
    SELECT DISTINCT ?game ?concept
    WHERE {
      ?game rdf:type vgaccess:Videogioco .
      {
        ?game vgaccess:haFunzionalitaAccessibilita ?concept .
      }
      UNION
      {
        ?game vgaccess:haLivelloAccessibilita ?concept .
      }
    }
    ORDER BY ?game ?concept
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "game", "Elementi che classificano i videogiochi");
  } catch (error) {
    renderError(error);
  }
}

async function showInverseProperties() {
  const query = `
    SELECT DISTINCT ?property ?inverse
    WHERE {
      ?property owl:inverseOf ?inverse .
    }
    ORDER BY ?property ?inverse
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "property", "Proprietà inverse dichiarate");
  } catch (error) {
    renderError(error);
  }
}

async function showExternalLinks() {
  const query = `
    SELECT DISTINCT ?localConcept ?externalConcept
    WHERE {
      ?localConcept skos:closeMatch|skos:exactMatch ?externalConcept .
    }
    ORDER BY ?localConcept ?externalConcept
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "localConcept", "Allineamenti SKOS verso risorse esterne");
  } catch (error) {
    renderError(error);
  }
}

async function showProfiles() {
  const query = `
    SELECT DISTINCT ?profile ?need
    WHERE {
      ?profile rdf:type vgaccess:ProfiloGiocatore ;
               vgaccess:haEsigenzaAccessibilita ?need .
    }
    ORDER BY ?profile ?need
  `;

  try {
    const rows = await runQuery(query);
    renderGenericCards(rows, "profile", "Profili giocatore ed esigenze associate");
  } catch (error) {
    renderError(error);
  }
}

/* =========================
   RENDERING
   ========================= */

function renderGameCards(rows, title = "Risultati") {
  const container = document.getElementById("results");

  if (rows.length === 0) {
    container.innerHTML = `<p class="empty-state">Nessun risultato trovato.</p>`;
    return;
  }

  container.innerHTML = `
    <article class="result-card wide-card section-title-card">
      <h3>${escapeHtml(title)}</h3>
    </article>
    ${rows.map(row => `
      <article class="result-card">
        <h3>${escapeHtml(row.title || row.game || "Videogioco")}</h3>
        <p class="meta"><strong>Identificativo:</strong> ${escapeHtml(row.game || "-")}</p>
        ${row.level ? `<span class="badge">${escapeHtml(row.level)}</span>` : ""}
        ${row.numeroFunzionalita ? `<span class="badge">${escapeHtml(row.numeroFunzionalita)} funzionalità</span>` : ""}
        ${row.numeroEsigenze ? `<span class="badge">${escapeHtml(row.numeroEsigenze)} esigenze coperte</span>` : ""}
      </article>
    `).join("")}
  `;
}

function renderGenericCards(rows, mainField, title = "Risultati") {
  const container = document.getElementById("results");

  if (rows.length === 0) {
    container.innerHTML = `<p class="empty-state">Nessun risultato trovato.</p>`;
    return;
  }

  container.innerHTML = `
    <article class="result-card wide-card section-title-card">
      <h3>${escapeHtml(title)}</h3>
    </article>
    ${rows.map(row => `
      <article class="result-card">
        <h3>${escapeHtml(row[mainField] || "Risultato")}</h3>
        ${Object.entries(row).map(([key, value]) => `
          <p class="meta"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>
        `).join("")}
      </article>
    `).join("")}
  `;
}

function renderError(error) {
  hideLoading();
  document.getElementById("results").innerHTML = `
    <article class="result-card error-card">
      <h3>Errore</h3>
      <p>${escapeHtml(error.message)}</p>
      <p class="meta">
        Controlla che GraphDB sia avviato, che il repository VGAccess sia raggiungibile
        e che il proxy locale /sparql sia configurato correttamente.
      </p>
    </article>
  `;
}
