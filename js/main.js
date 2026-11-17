/* Marrakech Centro Estetico: interazioni leggere, nessuna dipendenza esterna. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var WA = 'https://wa.me/393206223880?text=';

  /* Link all'app di prenotazione. TODO-CLIENTE: incollare qui gli indirizzi dell'app negli store.
     Finché sono vuoti, i pulsanti portano alla sezione "Prenota" della home. */
  var APP_LINKS = {
    ios: '',      // es. https://apps.apple.com/it/app/...
    android: ''   // es. https://play.google.com/store/apps/details?id=...
  };
  (function () {
    var ua = navigator.userAgent;
    var guess = /iPhone|iPad|iPod|Macintosh/.test(ua) ? 'ios' : (/Android/.test(ua) ? 'android' : '');
    $$('[data-store]').forEach(function (a) {
      var k = a.getAttribute('data-store');
      var url = k === 'auto' ? APP_LINKS[guess] : APP_LINKS[k];
      if (!url) return;
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  })();

  /* Intestazione compatta dopo lo scroll */
  var header = $('#header');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-stuck', y > 40);
    parallax();
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  /* Parallasse leggera sugli elementi con data-parallax */
  var pEls = reduce ? [] : $$('[data-parallax]');
  function parallax() {
    var vh = window.innerHeight;
    pEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      var k = parseFloat(el.getAttribute('data-parallax')) || 0;
      var off = (r.top + r.height / 2 - vh / 2) * k;
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    });
  }
  onScroll();

  /* Menu mobile */
  var burger = $('#burger');
  var nav = $('#nav');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger && nav) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
  }

  /* Comparsa progressiva degli elementi */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) {
      var sib = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [];
      var i = sib.indexOf(el);
      if (i > 0) el.style.setProperty('--d', (i * 0.09).toFixed(2) + 's');
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Voce di menu attiva in base alla sezione visibile */
  var links = $$('.nav a[href^="#"]');
  if ('IntersectionObserver' in window && links.length) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = map[en.target.id];
        if (a && en.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-active'); });
          a.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* Esploratore dei trattamenti */
  var ex = $('#explorer');
  if (ex) {
    var items = $$('.ex-item', ex);
    var stage = $$('.ex-stage img', ex);
    var capN = $('.ex-cap-n', ex);
    var capT = $('.ex-cap-t', ex);
    var desktop = window.matchMedia('(min-width: 901px)');
    function openItem(i, toggle) {
      items.forEach(function (it, j) {
        var on = j === i ? (toggle ? !it.classList.contains('is-open') || desktop.matches : true) : false;
        it.classList.toggle('is-open', on);
        $('.ex-btn', it).setAttribute('aria-expanded', String(on));
      });
      stage.forEach(function (img, j) { img.classList.toggle('is-on', j === i); });
      if (capN) capN.textContent = $('.ex-n', items[i]).textContent;
      if (capT) capT.textContent = $('.ex-name', items[i]).textContent;
    }
    items.forEach(function (it, i) {
      var btn = $('.ex-btn', it);
      btn.addEventListener('click', function () { openItem(i, true); });
      btn.addEventListener('mouseenter', function () { if (desktop.matches && !it.classList.contains('is-open')) openItem(i, false); });
    });
  }

  /* ---------------------------------------------------------------------------
     Contenuti dall'app (D19): prodotti e articoli si gestiscono dal gestionale e il sito
     li legge dall'API. Le schede scritte nell'HTML restano come riserva: se l'API non
     risponde, o API_BASE è vuoto, la pagina mostra quelle.
     TODO-DEPLOY: indirizzo pubblico dell'API (es. https://api.<dominio>), senza "/" finale.
     L'API deve avere l'indirizzo di questo sito in SITE_ORIGINS. */
  var API_BASE = '';
  (function () {
    // Solo in locale: ?api=http://localhost:3000 per provare con l'API di sviluppo.
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    var m = /[?&]api=([^&]+)/.exec(location.search);
    if (m) API_BASE = decodeURIComponent(m[1]).replace(/\/$/, '');
  })();

  function getJSON(path) {
    if (!API_BASE || !window.fetch) return Promise.reject(new Error('API non configurata'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch(API_BASE + path, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
        return r.json();
      }, function (e) { clearTimeout(t); throw e; });
  }
  /** URL immagine dell'API: i percorsi relativi (/uploads, /static) diventano assoluti; solo http(s). */
  function mediaUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return u.charAt(0) === '/' ? API_BASE + u : '';
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
  var AVAIL = { ON_ORDER: 'Su ordinazione', OUT_OF_STOCK: 'Esaurito' };
  var grid = $('#pgrid');
  var filtersBox = $('.filters');
  var cards = function () { return grid ? $$('.pcard', grid) : []; };

  function productCard(p) {
    var img = mediaUrl(p.imageUrl);
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

  function renderProducts(list) {
    var shown = list;
    if (grid.getAttribute('data-source') === 'featured') {
      var limit = +grid.getAttribute('data-limit') || 4;
      shown = list.filter(function (p) { return p.featured; })
        .concat(list.filter(function (p) { return !p.featured; }))
        .slice(0, limit);
    }
    grid.innerHTML = shown.length
      ? shown.map(productCard).join('')
      : '<li class="pempty">Stiamo rinnovando la vetrina: scrivici su WhatsApp per i prodotti disponibili.</li>';
    $$('[data-product-count]').forEach(function (el) { el.textContent = String(list.length); });
    if (filtersBox) {
      var order = ['VISO', 'ANTIAGE', 'CORPO', 'PIEDI'], counts = {};
      list.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
      var btn = function (f, label, n, on) {
        return '<button type="button" class="chip-btn' + (on ? ' is-on' : '') + '" data-filter="' + f + '" aria-pressed="' + on + '">' + label + ' <span>' + n + '</span></button>';
      };
      filtersBox.innerHTML = btn('tutti', 'Tutti', list.length, true) +
        order.filter(function (c) { return counts[c]; }).map(function (c) { return btn(c.toLowerCase(), CAT[c], counts[c], false); }).join('');
      filtersBox.hidden = list.length === 0;
    }
    bindCatalog();
  }

  /* Filtri e apertura della scheda: si ricollegano ogni volta che le schede cambiano. */
  function bindCatalog() {
    var filterBtns = $$('.chip-btn[data-filter]');
    filterBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        filterBtns.forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
        var n = 0;
        cards().forEach(function (c) {
          var show = f === 'tutti' || c.getAttribute('data-cat') === f;
          c.classList.toggle('is-hidden', !show);
          c.classList.remove('is-entering');
          if (show && !reduce) {
            void c.offsetWidth;
            c.style.animationDelay = (n * 0.05) + 's';
            c.classList.add('is-entering');
          }
          if (show) n++;
        });
      });
    });
    if (!dlg) return;
    cards().forEach(function (c) {
      $('.pcard-hit', c).addEventListener('click', function () {
        lastFocus = this;
        fill(c);
        dlg.showModal();
      });
    });
  }

  /* Catalogo prodotti: scheda di dettaglio */
  var dlg = $('#pdialog');
  if (dlg && typeof dlg.showModal !== 'function') dlg = null;
  var pdIn, pdImg, pdCat, pdTitle, pdMore, pdWa, current = 0, lastFocus = null;
  function visible() { return cards().filter(function (c) { return !c.classList.contains('is-hidden'); }); }
  function fill(card) {
    var list = visible();
    current = list.indexOf(card);
    var slug = card.getAttribute('data-slug');
    var name = $('.sr', card).textContent.replace(/^Dettagli:\s*/, '');
    var img = $('.pimg img', card);
    // Schede statiche: foto grande del sito. Schede dall'API: la foto caricata dal gestionale.
    pdImg.src = card.getAttribute('data-img') || ('img/p-' + slug + '-1024.webp');
    pdImg.alt = img ? img.alt : '';
    pdCat.textContent = $('.pcat', card).textContent;
    pdTitle.textContent = name;
    pdMore.innerHTML = $('.pmore', card).innerHTML;
    pdWa.href = WA + encodeURIComponent('Ciao Marrakech! Vorrei informazioni su: ' + name + '. È disponibile in centro?');
    pdWa.setAttribute('aria-label', 'Chiedi disponibilità su WhatsApp: ' + name);
    if (!reduce) { pdIn.classList.remove('is-swap'); void pdIn.offsetWidth; pdIn.classList.add('is-swap'); }
  }
  function step(d) {
    var list = visible();
    if (list.length) fill(list[(current + d + list.length) % list.length]);
  }
  if (dlg) {
    pdIn = $('.pd-in', dlg);
    pdImg = $('#pd-img'); pdCat = $('#pd-cat'); pdTitle = $('#pd-title'); pdMore = $('#pd-more'); pdWa = $('#pd-wa');
    $('[data-close]', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    dlg.addEventListener('close', function () { if (lastFocus) lastFocus.focus(); });
    // swipe su mobile
    var sx = null;
    dlg.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
      sx = null;
    });
  }

  if (grid) {
    bindCatalog(); // schede statiche, subito utilizzabili
    getJSON('/products').then(function (list) {
      if (Array.isArray(list)) renderProducts(list);
    }, function () { /* API non raggiungibile: restano le schede dell'HTML */ });
  }

  /* ---------------------------------------------------------------- blog */
  // Articoli che hanno già una pagina statica (indicizzata): si linkano lì. Gli altri usano articolo.html.
  var LEGACY_POSTS = { 'semipermanente-ricostruzione-refill': 1, 'epilazione-laser-prima-seduta': 1, 'bagno-turco': 1 };
  function postUrl(slug) { return LEGACY_POSTS[slug] ? 'blog-' + slug + '.html' : 'articolo.html?a=' + encodeURIComponent(slug); }
  function postCard(a, hTag) {
    var img = mediaUrl(a.coverUrl);
    return '<li class="bcard reveal is-in"><a href="' + esc(postUrl(a.slug)) + '">' +
      '<figure class="bimg">' + (img ? '<img src="' + esc(img) + '" width="800" height="1000" loading="lazy" decoding="async" alt="">' : '') + '</figure>' +
      '<div class="bbody"><p class="pcat">' + esc(a.category) + ' · ' + a.readingMinutes + ' min</p>' +
      '<' + hTag + '>' + esc(plain(a.title)) + '</' + hTag + '>' +
      '<p>' + esc(a.excerpt) + '</p>' +
      '<span class="link-arrow">Leggi<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span></div></a></li>';
  }

  var post = $('article.post');
  var postSlug = post ? (post.getAttribute('data-article') || (window.URLSearchParams ? new URLSearchParams(location.search).get('a') : '')) : '';

  // Elenco del blog (blog.html) e "Leggi anche" sotto gli articoli.
  var blogGrid = $('#bgrid');
  var moreGrid = $('#bgrid-more');
  if (blogGrid || moreGrid) {
    getJSON('/articles').then(function (list) {
      if (!Array.isArray(list)) return;
      if (blogGrid) {
        blogGrid.innerHTML = list.length ? list.map(function (a) { return postCard(a, 'h2'); }).join('') : '<li class="pempty">Nuovi articoli in arrivo.</li>';
      }
      if (moreGrid) {
        var others = list.filter(function (a) { return a.slug !== postSlug; }).slice(0, 2);
        if (others.length) moreGrid.innerHTML = others.map(function (a) { return postCard(a, 'h3'); }).join('');
        else moreGrid.closest('section').hidden = true;
      }
    }, function () { /* restano gli articoli scritti nell'HTML */ });
  }

  // Pagina articolo: le pagine statiche si aggiornano con il testo dell'app; articolo.html lo carica da ?a=slug.
  if (post && $('.prose-body', post)) {
    var dynamicPost = !post.getAttribute('data-article');
    var postMissing = function () {
      if (!dynamicPost) return; // pagina statica: resta il testo scritto nell'HTML
      document.title = 'Articolo non trovato | Marrakech Centro Estetico';
      $('.post-title', post).textContent = 'Articolo non trovato';
      $('.post-lead', post).textContent = "Forse è stato tolto dal blog. Trovi tutti gli articoli nell'elenco.";
      $('.post-meta', post).textContent = '';
      $('.prose-body', post).innerHTML = '<p><a href="blog.html">Vai al blog</a></p>';
      post.removeAttribute('aria-busy');
    };
    if (!postSlug) postMissing();
    else getJSON('/articles/' + encodeURIComponent(postSlug)).then(function (a) {
      document.title = plain(a.title) + ' | Marrakech Centro Estetico';
      var desc = $('meta[name="description"]');
      if (desc) desc.setAttribute('content', a.excerpt);
      $$('.post-cat').forEach(function (el) { el.textContent = a.category; });
      $('.post-title', post).innerHTML = titleHtml(a.title);
      $('.post-lead', post).textContent = a.excerpt;
      var d = String(a.publishedAt || '').slice(0, 10);
      $('.post-meta', post).innerHTML = (d ? '<time datetime="' + esc(d) + '">' + dateIt(d) + '</time> · ' : '') +
        a.readingMinutes + (a.readingMinutes === 1 ? ' minuto' : ' minuti') + ' di lettura';
      var fig = $('.post-img', post), img = mediaUrl(a.coverUrl);
      if (fig) {
        fig.hidden = !img;
        if (img) fig.innerHTML = '<img src="' + esc(img) + '" width="1024" height="1280" alt="' + esc(a.coverAlt || '') + '" fetchpriority="high">';
      }
      $('.prose-body', post).innerHTML = markdown(a.body);
      post.removeAttribute('aria-busy');
    }, postMissing);
  }

  /* FAQ: una risposta aperta alla volta */
  var faqs = $$('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
