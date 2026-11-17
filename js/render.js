/* Rendering di prodotti e articoli che arrivano dall'app (D19, D22).
   Lo stesso file gira nel browser (window.MK, usato da main.js) e in Node (scripts/build-content.mjs),
   così le pagine generate dall'Action e quelle aggiornate nel browser hanno lo stesso HTML. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MK = factory();
})(this, function () {
  'use strict';

  /** URL immagine dell'API: i percorsi relativi (/uploads, /static) diventano assoluti; solo http(s). */
  function mediaUrl(u, base) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return u.charAt(0) === '/' && base ? base + u : '';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Titolo con *parte in evidenza* → HTML con <em>. */
  function titleHtml(t) { return esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function plain(t) { return String(t || '').replace(/\*/g, ''); }

  /* Markdown degli articoli: ## titoli, elenchi, **grassetto**, *corsivo*, [link](url), tabelle, "> " nota.
     Il testo viene prima "escapato": l'HTML scritto nell'articolo non passa. I link accettano solo
     http(s), mailto, tel o percorsi del sito (niente "javascript:": i due punti non sono ammessi). */
  function inline(s) {
    return esc(s)
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]*|[\w.\/#?=&%-]+)\)/g, function (_, txt, url) {
        var ext = /^https?:/i.test(url);
        return '<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + txt + '</a>';
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function markdown(md) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], i = 0;
    var cells = function (l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
    function flush() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i], m;
      if (!l.trim()) { flush(); i++; continue; }
      if ((m = /^(#{2,3})\s+(.*)$/.exec(l))) {
        flush();
        var h = m[1].length === 2 ? 'h2' : 'h3';
        out.push('<' + h + '>' + inline(m[2]) + '</' + h + '>');
        i++;
        continue;
      }
      if (/^\s*[-*]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
        flush();
        var ordered = /^\s*\d/.test(l), items = [];
        var itemRe = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
        while (i < lines.length && itemRe.test(lines[i])) {
          items.push('<li>' + inline(lines[i].replace(itemRe, '')) + '</li>');
          i++;
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      if (/^\s*\|/.test(l)) {
        flush();
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var head = rows.length > 1 && /^\s*\|?\s*:?-{3,}/.test(rows[1]) ? cells(rows[0]) : null;
        var body = rows.slice(head ? 2 : 0).map(function (r) {
          return '<tr>' + cells(r).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
        });
        out.push('<table class="price-table">' +
          (head ? '<thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead>' : '') +
          '<tbody>' + body.join('') + '</tbody></table>');
        continue;
      }
      if (/^>\s?/.test(l)) {
        flush();
        var note = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { note.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<p class="small">' + inline(note.join(' ')) + '</p>');
        continue;
      }
      para.push(l.trim());
      i++;
    }
    flush();
    return out.join('\n');
  }

  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function dateIt(iso) {
    var d = String(iso || '').slice(0, 10).split('-');
    return d.length === 3 ? (+d[2]) + ' ' + MONTHS[+d[1] - 1] + ' ' + d[0] : '';
  }

  /* ---------------------------------------------------------------- prodotti */
  var CAT = { VISO: 'Viso', ANTIAGE: 'Antiage', CORPO: 'Corpo', PIEDI: 'Piedi' };
  var CAT_ORDER = ['VISO', 'ANTIAGE', 'CORPO', 'PIEDI'];
  var AVAIL = { ON_ORDER: 'Su ordinazione', OUT_OF_STOCK: 'Esaurito' };
  var EMPTY_PRODUCTS = '<li class="pempty">Stiamo rinnovando la vetrina: scrivici su WhatsApp per i prodotti disponibili.</li>';

  function productCard(p, base) {
    var img = mediaUrl(p.imageUrl, base);
    var more = '';
    if (p.description) more += '<p>' + esc(p.description) + '</p>';
    if (p.howToUse) more += '<h4>Come si usa</h4><p>' + esc(p.howToUse) + '</p>';
    if (p.tryInStore) more += '<h4>Da provare in centro</h4><p>' + esc(p.tryInStore) + '</p>';
    if (p.highlights && p.highlights.length) {
      more += '<h4>In evidenza</h4><ul class="chips">' + p.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>';
    }
    if (AVAIL[p.availability]) more += '<p class="small">' + AVAIL[p.availability] + ': chiedici quando torna disponibile.</p>';
    return '<li class="pcard" data-cat="' + esc(String(p.category || '').toLowerCase()) + '" data-slug="' + esc(p.slug) + '" data-img="' + esc(img) + '">' +
      '<button class="pcard-hit" type="button" aria-haspopup="dialog"><span class="sr">Dettagli: ' + esc(p.name) + '</span></button>' +
      '<figure class="pimg">' +
      (img ? '<img src="' + esc(img) + '" width="600" height="600" loading="lazy" decoding="async" alt="' + esc(p.imageAlt || p.name) + '">' : '') +
      (AVAIL[p.availability] ? '<span class="pbadge">' + AVAIL[p.availability] + '</span>' : '') +
      '</figure>' +
      '<div class="pbody"><p class="pcat">' + esc(p.tagline || CAT[p.category] || '') + '</p><h3>' + esc(p.name) + '</h3>' +
      (p.summary ? '<p class="pdesc">' + esc(p.summary) + '</p>' : '') + '</div>' +
      '<div class="pmore" hidden>' + more + '</div></li>';
  }

  /** "featured": prima quelli in evidenza, poi gli altri, fino a `limit`. "all": tutti. */
  function pickProducts(list, source, limit) {
    if (source !== 'featured') return list;
    return list.filter(function (p) { return p.featured; })
      .concat(list.filter(function (p) { return !p.featured; }))
      .slice(0, limit || 4);
  }

  function productGrid(list, base) {
    return list.length ? list.map(function (p) { return productCard(p, base); }).join('\n') : EMPTY_PRODUCTS;
  }

  function filterButtons(list) {
    var counts = {};
    list.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var btn = function (f, label, n, on) {
      return '<button type="button" class="chip-btn' + (on ? ' is-on' : '') + '" data-filter="' + f + '" aria-pressed="' + on + '">' + label + ' <span>' + n + '</span></button>';
    };
    return btn('tutti', 'Tutti', list.length, true) +
      CAT_ORDER.filter(function (c) { return counts[c]; }).map(function (c) { return btn(c.toLowerCase(), CAT[c], counts[c], false); }).join('');
  }

  /* ---------------------------------------------------------------- articoli */
  /** Pagina statica dell'articolo (generata dall'Action). */
  function postPage(slug) { return 'blog-' + slug + '.html'; }

  function postCard(a, hTag, base, href) {
    var img = mediaUrl(a.coverUrl, base);
    return '<li class="bcard reveal"><a href="' + esc(href || postPage(a.slug)) + '">' +
      '<figure class="bimg">' + (img ? '<img src="' + esc(img) + '" width="800" height="1000" loading="lazy" decoding="async" alt="">' : '') + '</figure>' +
      '<div class="bbody"><p class="pcat">' + esc(a.category) + ' · ' + a.readingMinutes + ' min</p>' +
      '<' + hTag + '>' + esc(plain(a.title)) + '</' + hTag + '>' +
      '<p>' + esc(a.excerpt) + '</p>' +
      '<span class="link-arrow">Leggi<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span></div></a></li>';
  }
  var EMPTY_POSTS = '<li class="pempty">Nuovi articoli in arrivo.</li>';

  /** "Leggi anche": i due articoli più recenti diversi da quello aperto. */
  function otherPosts(list, slug) { return list.filter(function (a) { return a.slug !== slug; }).slice(0, 2); }

  function postMeta(a) {
    var d = String(a.publishedAt || '').slice(0, 10);
    return (d ? '<time datetime="' + esc(d) + '">' + dateIt(d) + '</time> · ' : '') +
      a.readingMinutes + (a.readingMinutes === 1 ? ' minuto' : ' minuti') + ' di lettura';
  }
  function coverImg(a, base) {
    var img = mediaUrl(a.coverUrl, base);
    return img ? '<img src="' + esc(img) + '" width="1024" height="1280" alt="' + esc(a.coverAlt || '') + '" fetchpriority="high">' : '';
  }

  return {
    mediaUrl: mediaUrl, esc: esc, titleHtml: titleHtml, plain: plain, inline: inline, markdown: markdown, dateIt: dateIt,
    CAT: CAT, AVAIL: AVAIL, productCard: productCard, pickProducts: pickProducts, productGrid: productGrid, filterButtons: filterButtons,
    postPage: postPage, postCard: postCard, EMPTY_POSTS: EMPTY_POSTS, otherPosts: otherPosts, postMeta: postMeta, coverImg: coverImg
  };
});
