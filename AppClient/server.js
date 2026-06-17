const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

const GRAPHDB_ENDPOINT = "http://localhost:7200/repositories/vgaccess";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/sparql", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Query SPARQL mancante"
      });
    }

    const response = await fetch(GRAPHDB_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json"
      },
      body: query
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).send(text);
    }

    res.setHeader("Content-Type", "application/sparql-results+json");
    res.send(text);

  } catch (error) {
    res.status(500).json({
      error: "Errore nella comunicazione con GraphDB",
      details: error.message
    });
  }
});

app.listen(3000, () => {
  console.log("VGAccess client avviato su http://localhost:3000");
});