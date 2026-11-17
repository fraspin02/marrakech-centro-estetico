#!/usr/bin/env node
// Genera le parti statiche del sito con i contenuti dell'app (D22), così Google e le anteprime dei
// link (WhatsApp, Facebook, Instagram) li vedono senza eseguire JavaScript.
//
//   - schede prodotto in index.html (in evidenza) e prodotti.html (tutte), con filtri e conteggi
//   - elenco del blog in blog.html
//   - una pagina blog-<indirizzo>.html per ogni articolo pubblicato, dal modello articolo.html;
//     le pagine degli articoli tolti dal blog vengono cancellate
//   - sitemap.xml
//
// Scrive solo tra i segnaposto <!-- mk:nome --> ... <!-- /mk:nome --> e tocca solo i file che cambiano:
// rilanciato senza modifiche nell'app, non cambia nulla. Lo lancia la GitHub Action "Contenuti dall'app".
//
//   API_BASE=https://api.<dominio> node scripts/build-content.mjs [--allow-empty]
//
// --allow-empty: accetta un'API senza prodotti o senza articoli. Senza, si ferma: un'API vuota per
// errore cancellerebbe le pagine del blog.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MK = createRequire(import.meta.url)("../js/render.js");
const API = (process.env.API_BASE || "").trim().replace(/\/+$/, "");
const ALLOW_EMPTY = process.argv.includes("--allow-empty");
const SITE_NAME = "Marrakech Centro Estetico, Bellizzi";

const fail = (msg) => {
  console.error(`build-content: ${msg}`);
  process.exit(1);
};
if (!/^https?:\/\/[^/]+$/.test(API)) fail("imposta API_BASE (es. https://api.dominio.it, senza percorso)");

/* ------------------------------------------------------------------ file */
const file = (name) => path.join(ROOT, name);
const read = (name) => fs.readFileSync(file(name), "utf8");
const changed = [];
function write(name, content) {
  const p = file(name);
  if (fs.existsSync(p) && fs.readFileSync(p, "utf8") === content) return;
  fs.writeFileSync(p, content);
  changed.push(name);
}

/** Sostituisce il contenuto tra <!-- mk:nome --> e <!-- /mk:nome -->. Il segnaposto deve esserci una volta sola. */
function fill(html, name, inner, where) {
  const re = new RegExp(`(<!-- mk:${name} -->)[\\s\\S]*?(<!-- /mk:${name} -->)`, "g");
  const hits = html.match(re);
  if (!hits || hits.length !== 1) fail(`${where}: segnaposto mk:${name} mancante o ripetuto`);
  return html.replace(re, (_, a, b) => a + inner + b);
}
/** Sostituzione che deve trovare esattamente una corrispondenza (il modello è cambiato? meglio fermarsi).
 *  Con testi dell'app, `to` è una funzione: così un "$" nel testo non viene interpretato. */
function once(html, re, to, where) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const n = (html.match(g) || []).length;
  if (n !== 1) fail(`${where}: atteso un solo ${re} (trovati ${n})`);
  return html.replace(re, to);
}
const block = (items, indent) => (items.length ? `\n${items.map((s) => indent + s).join("\n")}\n${indent}` : "");

/* ------------------------------------------------------------------ API */
async function get(p) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API + p, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  fail(`${p}: ${last.message}`);
}
const isStr = (v) => typeof v === "string";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const products = await get("/products");
if (!Array.isArray(products) || products.some((p) => !isStr(p.slug) || !isStr(p.name) || !isStr(p.category))) fail("/products: risposta non valida");
const summaries = await get("/articles");
if (!Array.isArray(summaries) || summaries.some((a) => !isStr(a.slug) || !SLUG.test(a.slug))) fail("/articles: risposta non valida");
const articles = [];
for (const s of summaries) {
  const a = await get(`/articles/${s.slug}`);
  if (!isStr(a.title) || !isStr(a.body) || !isStr(a.excerpt)) fail(`/articles/${s.slug}: risposta non valida`);
  articles.push(a);
}
if (!ALLOW_EMPTY && products.length === 0) fail("l'API non ha prodotti: se è giusto, rilancia con --allow-empty");
if (!ALLOW_EMPTY && articles.length === 0) fail("l'API non ha articoli: se è giusto, rilancia con --allow-empty");

const SITE = (/<link rel="canonical" href="([^"]+\/)">/.exec(read("index.html")) || [])[1];
if (!SITE) fail("index.html: canonical della home non trovato");
const abs = (rel) => SITE + rel;
const DEFAULT_OG = abs("img/og-marrakech-centro-estetico-bellizzi.jpg");
const jsonLd = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}\n</script>`;
const day = (iso) => String(iso || "").slice(0, 10);

/* ------------------------------------------------------------------ prodotti */
for (const name of ["index.html", "prodotti.html"]) {
  let html = read(name);
  const ul = /<ul class="pgrid" id="pgrid"([^>]*)>/.exec(html);
  if (!ul) fail(`${name}: #pgrid non trovato`);
  const source = (/data-source="([^"]*)"/.exec(ul[1]) || [])[1];
  const limit = +((/data-limit="(\d+)"/.exec(ul[1]) || [])[1] || 4);
  const shown = MK.pickProducts(products, source, limit);
  const cards = shown.length ? shown.map((p) => MK.productCard(p, API)) : [MK.productGrid([], API)];
  html = fill(html, "prodotti", block(cards, "        "), name);
  if (html.includes("<!-- mk:filtri -->")) {
    html = fill(html, "filtri", `\n        ${MK.filterButtons(products)}\n        `, name);
    html = html.replace(/(<div class="filters"[^>]*?)( hidden)?>/, (_, a) => a + (products.length ? "" : " hidden") + ">");
  }
  html = html.replace(/(data-product-count[^>]*>)\d+(<)/g, `$1${products.length}$2`);
  write(name, html);
}

/* ------------------------------------------------------------------ blog */
{
  const cards = articles.length ? articles.map((a) => MK.postCard(a, "h2", API)) : [MK.EMPTY_POSTS];
  write("blog.html", fill(read("blog.html"), "articoli", block(cards, "        "), "blog.html"));
}

/* ------------------------------------------------------------------ pagine articolo */
const TEMPLATE = read("articolo.html");

function articlePage(a) {
  const where = `articolo ${a.slug}`;
  const url = abs(MK.postPage(a.slug));
  const title = `${MK.plain(a.title)} | ${SITE_NAME}`;
  const cover = MK.mediaUrl(a.coverUrl, API);
  const published = day(a.publishedAt);
  const modified = day(a.updatedAt) || published;
  let h = TEMPLATE;

  h = once(h, /<!-- Pagina di passaggio[\s\S]*?-->/, "<!-- Generata da scripts/build-content.mjs con l'articolo scritto nell'app (D22): non modificare a mano, si riscrive a ogni pubblicazione. -->", where);
  h = once(h, /<title>[^<]*<\/title>/, () => `<title>${MK.esc(title)}</title>`, where);
  h = once(h, /<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${MK.esc(a.excerpt)}">`, where);
  h = once(h, /<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index, follow, max-image-preview:large">', where);
  h = once(h, /<meta property="og:title" content="[^"]*">/, () => `<meta property="og:title" content="${MK.esc(title)}">`, where);
  h = once(h, /<meta property="og:description" content="[^"]*">/, () => `<meta property="og:description" content="${MK.esc(a.excerpt)}">`, where);
  if (cover) {
    // Le copertine caricate dall'app hanno misure diverse: niente width/height fissi.
    h = once(h, /<meta property="og:image" content="[^"]*">\n<meta property="og:image:width" content="\d+">\n<meta property="og:image:height" content="\d+">/,
      () => `<meta property="og:image" content="${MK.esc(cover)}">`, where);
  }
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: MK.plain(a.title),
        description: a.excerpt,
        image: cover || DEFAULT_OG,
        ...(published ? { datePublished: published } : {}),
        dateModified: modified,
        inLanguage: "it-IT",
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "Marrakech Centro Estetico", url: SITE },
        publisher: { "@id": `${SITE}#centro` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Blog", item: abs("blog.html") },
          { "@type": "ListItem", position: 3, name: MK.plain(a.title), item: url },
        ],
      },
    ],
  };
  const head = [
    `<link rel="canonical" href="${MK.esc(url)}">`,
    `<meta property="og:url" content="${MK.esc(url)}">`,
    ...(published ? [`<meta property="article:published_time" content="${published}">`] : []),
    `<meta property="article:modified_time" content="${modified}">`,
    jsonLd(ld),
  ];
  h = fill(h, "head", `\n${head.join("\n")}\n`, where);

  h = once(h, /<article class="post" aria-busy="true">/, `<article class="post" data-article="${a.slug}">`, where);
  h = h.replace(/(class="post-cat">)[^<]*(<)/g, (_, x, y) => x + MK.esc(a.category) + y);
  h = once(h, /(<h1 class="[^"]*post-title[^"]*"[^>]*>)[^<]*(<\/h1>)/, (_, x, y) => x + MK.titleHtml(a.title) + y, where);
  h = once(h, /(<p class="[^"]*post-lead[^"]*"[^>]*>)[^<]*(<\/p>)/, (_, x, y) => x + MK.esc(a.excerpt) + y, where);
  h = once(h, /(<p class="post-meta[^"]*"[^>]*>)[^<]*(<\/p>)/, (_, x, y) => x + MK.postMeta(a) + y, where);
  const img = MK.coverImg(a, API);
  h = once(h, /<figure class="post-img([^"]*)"([^>]*?)( hidden)?><\/figure>/, (_, cls, attrs) =>
    `<figure class="post-img${cls}"${attrs}${img ? "" : " hidden"}>${img}</figure>`, where);
  h = fill(h, "testo", `\n${MK.markdown(a.body)}\n          `, where);

  const others = MK.otherPosts(articles, a.slug);
  h = fill(h, "altri", block(others.map((o) => MK.postCard(o, "h3", API)), "        "), where);
  if (!others.length) h = once(h, /<section class="section blog-more"/, '<section class="section blog-more" hidden', where);
  return h;
}

const published = new Set(articles.map((a) => a.slug));
for (const a of articles) write(MK.postPage(a.slug), articlePage(a));

// Articoli tolti dal blog: la pagina sparisce (Google riceve 404 e la toglie dai risultati).
const removed = [];
for (const f of fs.readdirSync(ROOT)) {
  const m = /^blog-([a-z0-9-]+)\.html$/.exec(f);
  if (m && !published.has(m[1])) {
    fs.unlinkSync(file(f));
    removed.push(f);
  }
}

/* ------------------------------------------------------------------ sitemap */
{
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const xml = read("sitemap.xml");
  const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>\s*)?<\/url>/g)]
    .map((m) => ({ loc: m[1], lastmod: m[2] }))
    .filter((u) => !/\/blog-[^/]+\.html$/.test(u.loc));
  for (const u of urls) {
    const page = u.loc === SITE ? "index.html" : u.loc.slice(SITE.length);
    if (changed.includes(page)) u.lastmod = today;
  }
  for (const a of articles) urls.push({ loc: abs(MK.postPage(a.slug)), lastmod: day(a.updatedAt) || today });
  const out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url>\n    <loc>${MK.esc(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ""}  </url>\n`).join("") +
    "</urlset>\n";
  write("sitemap.xml", out);
}

console.log(`build-content: ${products.length} prodotti, ${articles.length} articoli.`);
console.log(changed.length || removed.length
  ? `Aggiornati: ${changed.join(", ") || "nessuno"}. Tolti: ${removed.join(", ") || "nessuno"}.`
  : "Nessuna modifica.");
