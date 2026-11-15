// Mappa Google caricata solo su richiesta (click-to-load): nessun cookie di terze parti prima del consenso.
(function () {
  var btn = document.getElementById('carica-mappa');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var box = document.getElementById('mappa');
    var f = document.createElement('iframe');
    f.src = 'https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sMarrakech+Centro+Estetico,+Via+Napoli+95A,+84092+Bellizzi+SA!6i16';
    f.title = 'Mappa: Marrakech Centro Estetico, Via Napoli 95A, Bellizzi';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.setAttribute('allowfullscreen', '');
    box.innerHTML = '';
    box.appendChild(f);
    f.focus();
  });
})();
