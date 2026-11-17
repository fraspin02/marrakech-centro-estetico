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

  /* Catalogo prodotti: filtri */
  var grid = $('#pgrid');
  var cards = grid ? $$('.pcard', grid) : [];
  var filterBtns = $$('.chip-btn[data-filter]');
  filterBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      filterBtns.forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      var n = 0;
      cards.forEach(function (c) {
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

  /* Catalogo prodotti: scheda di dettaglio */
  var dlg = $('#pdialog');
  if (dlg && typeof dlg.showModal === 'function' && cards.length) {
    var pdIn = $('.pd-in', dlg);
    var pdImg = $('#pd-img'), pdCat = $('#pd-cat'), pdTitle = $('#pd-title'), pdMore = $('#pd-more'), pdWa = $('#pd-wa');
    var current = 0, lastFocus = null;
    function visible() { return cards.filter(function (c) { return !c.classList.contains('is-hidden'); }); }
    function fill(card) {
      var list = visible();
      current = list.indexOf(card);
      var slug = card.getAttribute('data-slug');
      var name = $('.sr', card).textContent.replace(/^Dettagli:\s*/, '');
      var img = $('.pimg img', card);
      pdImg.src = 'img/p-' + slug + '-1024.webp';
      pdImg.alt = img.alt;
      pdCat.textContent = $('.pcat', card).textContent;
      pdTitle.textContent = name;
      pdMore.innerHTML = $('.pmore', card).innerHTML;
      pdWa.href = WA + encodeURIComponent('Ciao Marrakech! Vorrei informazioni su: ' + name + '. È disponibile in centro?');
      pdWa.setAttribute('aria-label', 'Chiedi disponibilità su WhatsApp: ' + name);
      if (!reduce) { pdIn.classList.remove('is-swap'); void pdIn.offsetWidth; pdIn.classList.add('is-swap'); }
    }
    function step(d) {
      var list = visible();
      fill(list[(current + d + list.length) % list.length]);
    }
    cards.forEach(function (c) {
      $('.pcard-hit', c).addEventListener('click', function () {
        lastFocus = this;
        fill(c);
        dlg.showModal();
      });
    });
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

  /* FAQ: una risposta aperta alla volta */
  var faqs = $$('.faq details');
  faqs.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) faqs.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
