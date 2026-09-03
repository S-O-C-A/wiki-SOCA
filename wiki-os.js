/* ==========================================================================
   КОДЕКС ПАНДЕМОНИУМ // PANDEMONIUM OS — движок
   --------------------------------------------------------------------------
   Читает статьи из articles.js и показывает их как «файлы» ретро-ОС.
   Управление: клик по иконке/файлу открывает окно; крестик закрывает;
   меню «Переход» прыгает в любую статью. Контент не трогаем — только оболочка.
   ========================================================================== */
(function () {
  'use strict';

  var ARTICLES = (window.WIKI_ARTICLES || []).filter(function (a) { return !a.isMain; });
  var BY_ID = {};
  ARTICLES.forEach(function (a) { BY_ID[a.id] = a; });

  // индекс «ссылки сюда»: кто ссылается на каждую статью
  var BACKLINKS = {};
  ARTICLES.forEach(function (a) {
    var html = (a.intro || '') + (a.sections || []).map(function (s) { return s.html; }).join('') +
               (a.infobox ? JSON.stringify(a.infobox.rows) : '');
    var set = {};
    (html.match(/#\/([a-z0-9\-]+)/g) || []).forEach(function (m) { var t = m.slice(2); if (BY_ID[t] && t !== a.id) set[t] = 1; });
    (a.seeAlso || []).forEach(function (t) { if (BY_ID[t] && t !== a.id) set[t] = 1; });
    Object.keys(set).forEach(function (t) { (BACKLINKS[t] = BACKLINKS[t] || []).push(a.id); });
  });

  /* ---- пиксельные иконки (SVG, моно, currentColor) --------------------- */
  var ICO = {
    folder: '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M1 4h6l2 2h10v10H1z"/><path d="M1 4h6l2 2"/></svg>',
    disk:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><rect x="2" y="1" width="16" height="16"/><rect x="6" y="1" width="8" height="6"/><rect x="5" y="10" width="10" height="7"/><line x1="11" y1="2" x2="11" y2="6"/></svg>',
    doc:    '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M4 1h8l4 4v12H4z"/><path d="M12 1v4h4"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="6" y1="11" x2="14" y2="11"/><line x1="6" y1="14" x2="11" y2="14"/></svg>',
    find:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.6" shape-rendering="crispEdges"><circle cx="8" cy="7" r="5"/><line x1="12" y1="11" x2="17" y2="16"/></svg>',
    note:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><rect x="3" y="1" width="14" height="16"/><line x1="6" y1="5" x2="14" y2="5"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="6" y1="11" x2="14" y2="11"/><line x1="6" y1="14" x2="11" y2="14"/></svg>',
    trash:  '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M4 4h12l-1 13H5z"/><line x1="2" y1="4" x2="18" y2="4"/><path d="M8 4V2h4v2"/><line x1="8" y1="7" x2="8" y2="14"/><line x1="12" y1="7" x2="12" y2="14"/></svg>',
    image:  '<svg viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="1.6" shape-rendering="crispEdges"><rect x="2" y="2" width="20" height="16"/><circle cx="8" cy="7" r="2"/><path d="M3 17l6-6 4 4 3-3 5 5"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" shape-rendering="crispEdges"><rect x="4" y="10" width="16" height="12"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="11" y="14" width="2" height="4"/></svg>'
  };

  /* ---- элементы каркаса ------------------------------------------------ */
  var elDesktop = document.getElementById('desktop');
  var elIcons   = document.getElementById('icons');
  var elClock   = document.getElementById('clock');
  var elMenubar = document.getElementById('menubar');

  var zTop = 10;
  var winCount = 0;
  var openWindows = [];

  function isMobile() {
    return window.matchMedia ? window.matchMedia('(max-width: 720px)').matches
                             : (window.innerWidth <= 720);
  }
  function setMobileFlag() { document.body.classList.toggle('is-mobile', isMobile()); }

  function applyTheme(t) {
    document.body.classList.toggle('dark', t === 'dark');
    var btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = (t === 'dark' ? 'ТЕМА: ТЁМНАЯ' : 'ТЕМА: СВЕТЛАЯ');
    try { localStorage.setItem('pd04-theme', t); } catch (e) {}
  }
  function toggleTheme() { applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'); }

  /* ---- утилиты по данным ----------------------------------------------- */
  function stripHtml(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function byTitle(x, y) { return x.title.localeCompare(y.title, 'ru'); }
  var CAT_ORDER = ['База', 'Сайт СОКА', 'Пилоты', 'ИИ', 'Корабли', 'Ивенты', 'Мир'];
  function catRank(c) { var i = CAT_ORDER.indexOf(c); return i === -1 ? 99 : i; }
  function categories() {
    var set = {};
    ARTICLES.forEach(function (a) { (a.categories || []).forEach(function (c) { set[c] = (set[c] || 0) + 1; }); });
    return Object.keys(set).sort(function (x, y) {
      return (catRank(x) - catRank(y)) || x.localeCompare(y, 'ru');
    }).map(function (c) { return { name: c, count: set[c] }; });
  }
  function inCategory(cat) { return ARTICLES.filter(function (a) { return (a.categories || []).indexOf(cat) !== -1; }).sort(byTitle); }
  function articleText(a) {
    var t = a.title + ' ' + (a.aka || []).join(' ') + ' ' + stripHtml(a.intro);
    (a.sections || []).forEach(function (s) { t += ' ' + s.h + ' ' + stripHtml(s.html); });
    return t;
  }
  function search(q) {
    q = (q || '').trim().toLowerCase(); if (!q) return [];
    return ARTICLES.map(function (a) {
      var head = (a.title + ' ' + (a.aka || []).join(' ')).toLowerCase();
      var body = articleText(a).toLowerCase(); var s = 0;
      if (a.title.toLowerCase() === q) s += 100;
      if (head.indexOf(q) !== -1) s += 40;
      if (body.indexOf(q) !== -1) s += 10;
      return { a: a, s: s };
    }).filter(function (r) { return r.s > 0; }).sort(function (x, y) { return y.s - x.s; }).map(function (r) { return r.a; });
  }

  /* ---- рабочий стол ---------------------------------------------------- */
  function buildDesktop() {
    var items = [];
    categories().forEach(function (c) {
      items.push({ ic: 'disk', label: c.name.toUpperCase(), act: function () { openFolder(c.name); } });
    });
    items.push({ ic: 'folder', label: 'ВСЕ СТАТЬИ', act: function () { openFolder(null); } });
    items.push({ ic: 'find',   label: 'ПОИСК',      act: function () { openSearch(''); } });
    items.push({ ic: 'note',   label: 'О КОДЕКСЕ',  act: openReadme });

    var h = '';
    items.forEach(function (it, i) {
      h += '<div class="dicon" data-i="' + i + '"><span class="glyph">' + ICO[it.ic] +
           '</span><span class="label">' + it.label + '</span></div>';
    });
    elIcons.innerHTML = h;

    // корзина — отдельно, в углу рабочего стола, чтобы не слипалась с сеткой
    var trash = document.createElement('div');
    trash.className = 'dicon trash';
    trash.innerHTML = '<span class="glyph">' + ICO.trash + '</span><span class="label">КОРЗИНА</span>';
    elDesktop.appendChild(trash);

    elIcons.querySelectorAll('.dicon[data-i]').forEach(function (el) {
      var it = items[+el.getAttribute('data-i')];
      el.addEventListener('click', function () { selectIcon(el); it.act(); });
    });
    var trashEl = elDesktop.querySelector('.dicon.trash');
    trashEl.addEventListener('click', function () {
      selectIcon(trashEl);
      makeWindow({ key: 'trash', name: 'КОРЗИНА', sub: '0 файлов',
        bodyHtml: '<div class="empty-note">Корзина пуста.<br>СОКА бы сказала: «а ты чего ждал?»</div>', w: 300 });
    });
  }
  function selectIcon(el) {
    elDesktop.querySelectorAll('.dicon.selected').forEach(function (d) { d.classList.remove('selected'); });
    el.classList.add('selected');
  }

  /* ---- окна ------------------------------------------------------------ */
  function focusWindow(w) {
    w.style.zIndex = ++zTop;
    openWindows.forEach(function (x) { x.classList.toggle('active', x === w); });
  }
  function closeWindow(w) {
    var i = openWindows.indexOf(w); if (i !== -1) openWindows.splice(i, 1);
    w.remove();
    if (openWindows.length) focusWindow(openWindows[openWindows.length - 1]);
  }
  function closeAll() { openWindows.slice().forEach(function (w) { w.remove(); }); openWindows = []; }

  function makeWindow(opts) {
    // если окно с таким key уже открыто — вынести наверх, не плодить
    if (opts.key) {
      var ex = openWindows.filter(function (w) { return w.dataset.key === opts.key; })[0];
      if (ex) { focusWindow(ex); return ex; }
    }
    var w = document.createElement('div');
    w.className = 'win';
    if (opts.key) w.dataset.key = opts.key;
    w.dataset.kind = opts.kind || 'plain';

    var sub = opts.sub ? '<div class="win-sub">' + opts.sub + '</div>' : '';
    w.innerHTML =
      '<div class="win-title"><div class="win-close" title="Закрыть">\u00d7</div>' +
      '<div class="win-name">' + opts.name + '</div>' + sub + '</div>' +
      '<div class="win-body">' + opts.bodyHtml + '</div>';

    // положение: каскад; на телефоне — во весь экран (через CSS)
    if (!isMobile()) {
      var off = (winCount % 6) * 26;
      var baseL = 120 + off, baseT = 40 + off;
      w.style.left = baseL + 'px';
      w.style.top  = baseT + 'px';
      if (opts.w) w.style.width = opts.w + 'px';
    }
    winCount++;

    elDesktop.appendChild(w);
    openWindows.push(w);
    focusWindow(w);

    // закрытие
    w.querySelector('.win-close').addEventListener('click', function (e) { e.stopPropagation(); closeWindow(w); });
    // фокус по клику
    w.addEventListener('mousedown', function () { focusWindow(w); });
    // перетаскивание за титул (только десктоп)
    dragify(w);
    resizify(w);
    // перехват внутренних ссылок #/...
    w.querySelector('.win-body').addEventListener('click', onInnerClick);
    // клики по строкам файлов
    w.querySelectorAll('.filerow[data-open]').forEach(function (row) {
      row.addEventListener('click', function () { openArticle(row.getAttribute('data-open')); });
    });
    wireCarousels(w);
    if (opts.onMount) opts.onMount(w);
    return w;
  }

  function resizify(w) {
    if (isMobile()) return;
    var grip = document.createElement('div');
    grip.className = 'win-resize';
    w.appendChild(grip);
    var sx, sy, ow, oh, rs = false;
    grip.addEventListener('mousedown', function (e) {
      if (isMobile()) return;
      rs = true; focusWindow(w);
      sx = e.clientX; sy = e.clientY; ow = w.offsetWidth; oh = w.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', function (e) {
      if (!rs) return;
      var nw = Math.max(260, Math.min(ow + (e.clientX - sx), window.innerWidth - 12));
      var nh = Math.max(150, Math.min(oh + (e.clientY - sy), window.innerHeight - 40));
      w.style.width = nw + 'px'; w.style.height = nh + 'px';
    });
    window.addEventListener('mouseup', function () { rs = false; });
  }

  function dragify(w) {
    var title = w.querySelector('.win-title');
    var sx, sy, ox, oy, dragging = false;
    title.addEventListener('mousedown', function (e) {
      if (isMobile() || e.target.closest('.win-close')) return;
      dragging = true; focusWindow(w);
      sx = e.clientX; sy = e.clientY;
      ox = parseInt(w.style.left, 10) || w.offsetLeft;
      oy = parseInt(w.style.top, 10) || w.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
      nx = Math.max(2, Math.min(nx, window.innerWidth - 60));
      ny = Math.max(28, Math.min(ny, window.innerHeight - 26));
      w.style.left = nx + 'px'; w.style.top = ny + 'px';
    });
    window.addEventListener('mouseup', function () { dragging = false; });
  }

  function onInnerClick(e) {
    var root = e.currentTarget;
    var a = e.target.closest('a[href^="#/"]');
    if (a) { e.preventDefault(); routeHash(a.getAttribute('href')); return; }
    var toc = e.target.closest('.toc-link');
    if (toc) {
      var sec = root.querySelector('.art-sec[data-sec="' + toc.getAttribute('data-sec') + '"]');
      if (sec) { sec.classList.remove('collapsed'); sec.scrollIntoView({ block: 'start' }); }
      return;
    }
    var sh = e.target.closest('.sec-h');
    if (sh) { sh.parentNode.classList.toggle('collapsed'); return; }
    var cell = e.target.closest('[data-lb-i]');
    if (cell) {
      var box = cell.closest('[data-lb-id]');
      if (box) openLightbox(box.dataset.lbId, +box.dataset.lbN, +cell.dataset.lbI);
    }
  }
  function routeHash(href) {
    var h = href.replace(/^#\/?/, '');
    if (h.indexOf('cat/') === 0) return openFolder(decodeURIComponent(h.slice(4)));
    if (h.indexOf('search/') === 0) return openSearch(decodeURIComponent(h.slice(7)));
    if (h === 'main' || h === '') return;
    if (BY_ID[h]) return openArticle(h);
  }

  /* ---- окно-папка ------------------------------------------------------ */
  function openFolder(cat) {
    var list = cat ? inCategory(cat) : ARTICLES.slice().sort(byTitle);
    var name = cat ? cat.toUpperCase() : 'ВСЕ СТАТЬИ';
    var rows = list.map(function (a) {
      return '<div class="filerow" data-open="' + a.id + '">' +
        '<span class="fr-ic">' + ICO.doc + '</span>' +
        '<span class="fr-name">' + a.title + (a.aka && a.aka[1] ? '' : '') + '</span>' +
        (a.stub ? '<span class="fr-tag">заготовка</span>' : '') + '</div>';
    }).join('');
    if (!rows) rows = '<div class="empty-note">Здесь пусто.</div>';
    makeWindow({ key: 'folder:' + (cat || 'all'), name: 'ПАПКА: ' + name,
      sub: list.length + ' файл.', bodyHtml: '<div class="filelist">' + rows + '</div>', w: 320 });
  }

  /* ---- окно-статья ----------------------------------------------------- */
  function renderCarousel(a) {
    var n = a.gallery || 0; if (!n) return '';
    var cells = '';
    for (var i = 1; i <= n; i++) {
      var fn = 'картинки/' + a.id + '-' + i + '.png';
      cells += '<figure class="cr-cell' + (i === 1 ? ' active' : '') + '" data-lb-i="' + i + '">' +
        '<span class="cr-ph">' + ICO.image + '<small>' + fn + '</small></span>' +
        '<img src="' + fn + '" alt="" onerror="this.remove()"></figure>';
    }
    var nav = n > 1
      ? '<button class="cr-prev" aria-label="Назад">&lt;</button>' +
        '<button class="cr-next" aria-label="Вперёд">&gt;</button>' +
        '<div class="cr-count">1 / ' + n + '</div>'
      : '';
    return '<div class="carousel" data-idx="0" data-count="' + n + '" data-lb-id="' + a.id + '" data-lb-n="' + n + '"><div class="cr-track">' + cells + '</div>' + nav + '</div>';
  }
  function wireCarousels(w) {
    w.querySelectorAll('.carousel').forEach(function (c) {
      var count = +c.dataset.count; if (count < 2) return;
      var cells = c.querySelectorAll('.cr-cell');
      var counter = c.querySelector('.cr-count');
      function show(i) {
        i = (i % count + count) % count; c.dataset.idx = i;
        cells.forEach(function (cell, ci) { cell.classList.toggle('active', ci === i); });
        if (counter) counter.textContent = (i + 1) + ' / ' + count;
      }
      c.querySelector('.cr-prev').addEventListener('click', function (e) { e.stopPropagation(); show(+c.dataset.idx - 1); });
      c.querySelector('.cr-next').addEventListener('click', function (e) { e.stopPropagation(); show(+c.dataset.idx + 1); });
    });
  }
  function renderInfobox(a) {
    if (!a.infobox) return '';
    var ib = a.infobox;
    var h = '<aside class="infobox"><div class="ib-head"><span class="ib-emblem">' + (a.emblem || '?') +
      '</span><span class="ib-title">' + a.title + '</span></div>';
    h += renderCarousel(a);
    if (ib.caption) h += '<div class="ib-caption">' + ib.caption + '</div>';
    h += '<table class="ib-table"><tbody>';
    (ib.rows || []).forEach(function (r) { h += '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; });
    return h + '</tbody></table></aside>';
  }
  function renderCats(a) {
    if (!a.categories || !a.categories.length) return '';
    return '<div class="a-cats"><span class="lab">Категории:</span>' +
      a.categories.map(function (c) { return '<a class="cat-chip" href="#/cat/' + encodeURIComponent(c) + '">' + c + '</a>'; }).join('') + '</div>';
  }
  function renderSeeAlso(a) {
    var ids = (a.seeAlso || []).filter(function (id) { return BY_ID[id]; });
    if (!ids.length) return '';
    return '<div class="see-also"><h2>См. также</h2><ul>' +
      ids.map(function (id) { return '<li><a href="#/' + id + '">' + BY_ID[id].title + '</a></li>'; }).join('') + '</ul></div>';
  }
  function renderGallery(a) {
    if (!a.gallery) return '';
    var n = a.gallery, frames = '';
    for (var i = 1; i <= n; i++) {
      var fn = 'картинки/' + a.id + '-' + i + '.png';
      frames += '<figure class="gframe" data-lb-i="' + i + '"><div class="gf-bar">' + fn + '</div>' +
        '<div class="gf-img"><span class="gf-ph">' + ICO.image + '</span>' +
        '<img src="' + fn + '" alt="" onerror="this.remove()"></div></figure>';
    }
    return '<div class="gallery" data-lb-id="' + a.id + '" data-lb-n="' + n + '">' + frames + '</div>';
  }
  function openArticle(id) {
    var a = BY_ID[id]; if (!a) return;
    if (a.locked) {
      var lb = '<div class="article"><div class="locked"><div class="lock-ic">' + ICO.lock + '</div>' +
        '<div class="lock-h">ЗАКРЫТО</div><p>Раздел «' + a.title + '» пока под визуальным замком.</p></div></div>';
      makeWindow({ key: 'art:' + id, name: (a.title + '.doc').toUpperCase(), sub: 'LOCK', bodyHtml: lb, w: 420, kind: 'art' });
      return;
    }
    var body = '<div class="article">';
    if (a.stub) body += '<div class="stub-note"><b>ЗАГОТОВКА.</b> Файл намеренно неполон — часть данных ещё не раскрыта.</div>';
    body += '<div class="a-title">' + a.title + '</div>';
    if (a.aka && a.aka.length) body += '<div class="a-aka">' + a.aka.slice(0, 4).join(' · ') + '</div>';
    body += renderInfobox(a);
    body += '<div class="a-body">' + (a.intro || '');
    if (!a.infobox) body += renderGallery(a);
    var secs = a.sections || [];
    if (secs.length >= 3) {
      body += '<nav class="toc"><div class="toc-h">СОДЕРЖАНИЕ</div><ol>';
      secs.forEach(function (s, i) { body += '<li><a class="toc-link" data-sec="' + i + '">' + s.h + '</a></li>'; });
      body += '</ol></nav>';
    }
    secs.forEach(function (s, i) {
      var col = /^Досье/.test(s.h) ? ' collapsed' : '';
      body += '<section class="art-sec' + col + '" data-sec="' + i + '"><h2 class="sec-h">' + s.h + '</h2><div class="sec-body">' + s.html + '</div></section>';
    });
    body += renderSeeAlso(a);
    var bl = BACKLINKS[a.id] || [];
    if (bl.length) body += '<div class="backlinks"><h2>Ссылки сюда</h2><ul>' +
      bl.map(function (id) { return '<li><a href="#/' + id + '">' + BY_ID[id].title + '</a></li>'; }).join('') + '</ul></div>';
    body += renderCats(a);
    body += '</div></div>';
    makeWindow({ key: 'art:' + id, name: (a.title + '.doc').toUpperCase(),
      sub: (a.stub ? 'DIR/?' : 'DIR/ok'), bodyHtml: body, w: 680, kind: 'art' });
  }

  /* ---- окно-поиск ------------------------------------------------------ */
  function openSearch(initial) {
    var body =
      '<div class="search-box"><span>НАЙТИ:</span>' +
      '<input type="search" id="os-search" autocomplete="off" placeholder="имя или слово…"></div>' +
      '<div class="win-body-results"><div class="filelist" id="os-results">' +
      '<div class="search-hint">Введите запрос — например «СОКА», «пилот», «арсенал».</div></div></div>';
    var w = makeWindow({ key: 'search', name: 'ПОИСК', sub: '', bodyHtml: body, w: 340,
      onMount: function (w) {
        var inp = w.querySelector('#os-search');
        var out = w.querySelector('#os-results');
        function run() {
          var res = search(inp.value);
          if (!inp.value.trim()) { out.innerHTML = '<div class="search-hint">Введите запрос — например «СОКА», «пилот», «арсенал».</div>'; return; }
          if (!res.length) { out.innerHTML = '<div class="search-hint">Ничего не найдено.</div>'; return; }
          out.innerHTML = res.map(function (a) {
            return '<div class="filerow" data-open="' + a.id + '"><span class="fr-ic">' + ICO.doc +
              '</span><span class="fr-name">' + a.title + '</span>' +
              (a.stub ? '<span class="fr-tag">заготовка</span>' : '') + '</div>';
          }).join('');
          out.querySelectorAll('.filerow[data-open]').forEach(function (row) {
            row.addEventListener('click', function () { openArticle(row.getAttribute('data-open')); });
          });
        }
        inp.addEventListener('input', run);
        inp.value = initial || '';
        if (initial) run();
        setTimeout(function () { inp.focus(); }, 30);
      }
    });
    return w;
  }

  /* ---- О Кодексе ------------------------------------------------------- */
  function openReadme() {
    var body = '<div class="article"><div class="a-body" style="max-width:none">' +
      '<div class="a-title" style="font-family:var(--font-ui);font-size:15px">КОДЕКС ПАНДЕМОНИУМ</div>' +
      '<p>Авторская энциклопедия вселенной <a href="#/pandemonium-04">ПАНДЕМОНИУМ-04</a>. ' +
      'Здесь собрано то, что известно с основного сайта: персонажи, корабль, доступные секретки, устройство мира.</p>' +
      '<p>Открывайте папки-диски на рабочем столе или ищите через "ПОИСК". ' +
      'Часть мира намеренно оставлена в недосказанной - Кодекс объясняет устройство, но не раскрывает загадки.</p>' +
      '<p><em>Клик по иконке или файлу открывает окно. Крестик слева - закрыть. Меню "Переход" - прыгнуть в любую статью.</em></p>' +
      '</div></div>';
    makeWindow({ key: 'readme', name: 'О КОДЕКСЕ', sub: '', bodyHtml: body, w: 420 });
  }

  /* ---- ЛАЙТБОКС (просмотр фото на весь экран + лента миниатюр) --------- */
  var lbEl, lbState = { id: null, n: 0, i: 1 };
  function buildLightbox() {
    lbEl = document.createElement('div');
    lbEl.className = 'lightbox';
    lbEl.innerHTML =
      '<div class="lb-backdrop"></div>' +
      '<div class="lb-frame">' +
        '<div class="lb-title"><div class="lb-close" title="Закрыть">\u00d7</div>' +
          '<div class="lb-name"></div><div class="lb-count"></div></div>' +
        '<div class="lb-stage"><span class="lb-ph"></span><img class="lb-img" alt="">' +
          '<button class="lb-prev" aria-label="Назад">&lt;</button>' +
          '<button class="lb-next" aria-label="Вперёд">&gt;</button></div>' +
        '<div class="lb-strip"></div>' +
      '</div>';
    document.body.appendChild(lbEl);
    lbEl.querySelector('.lb-close').addEventListener('click', closeLightbox);
    lbEl.querySelector('.lb-backdrop').addEventListener('click', closeLightbox);
    lbEl.querySelector('.lb-prev').addEventListener('click', function () { showLb(lbState.i - 1); });
    lbEl.querySelector('.lb-next').addEventListener('click', function () { showLb(lbState.i + 1); });
    document.addEventListener('keydown', function (e) {
      if (!lbEl.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showLb(lbState.i - 1);
      else if (e.key === 'ArrowRight') showLb(lbState.i + 1);
    });
  }
  function openLightbox(id, n, i) {
    lbState.id = id; lbState.n = n;
    var strip = lbEl.querySelector('.lb-strip'), th = '';
    for (var k = 1; k <= n; k++) {
      var fn = 'картинки/' + id + '-' + k + '.png';
      th += '<figure class="lb-thumb" data-i="' + k + '"><span class="lb-tph">' + ICO.image + '</span>' +
        '<img src="' + fn + '" alt="" onerror="this.remove()"></figure>';
    }
    strip.innerHTML = th;
    strip.querySelectorAll('.lb-thumb').forEach(function (t) {
      t.addEventListener('click', function () { showLb(+t.dataset.i); });
    });
    var multi = n > 1;
    lbEl.querySelector('.lb-prev').style.display = multi ? '' : 'none';
    lbEl.querySelector('.lb-next').style.display = multi ? '' : 'none';
    strip.style.display = multi ? '' : 'none';
    lbEl.classList.add('open');
    showLb(i);
  }
  function showLb(i) {
    var n = lbState.n; i = ((i - 1 + n) % n) + 1; lbState.i = i;
    var fn = 'картинки/' + lbState.id + '-' + i + '.png';
    var img = lbEl.querySelector('.lb-img'), ph = lbEl.querySelector('.lb-ph');
    ph.innerHTML = ICO.image + '<small>' + fn + '</small>';
    ph.style.display = 'grid'; img.style.display = 'none';
    img.onload = function () { img.style.display = 'block'; ph.style.display = 'none'; };
    img.onerror = function () { img.style.display = 'none'; ph.style.display = 'grid'; };
    img.src = fn;
    lbEl.querySelector('.lb-name').textContent = fn;
    lbEl.querySelector('.lb-count').textContent = i + ' / ' + n;
    lbEl.querySelectorAll('.lb-thumb').forEach(function (t) { t.classList.toggle('active', +t.dataset.i === i); });
  }
  function closeLightbox() { lbEl.classList.remove('open'); }

  /* ---- меню-бар -------------------------------------------------------- */
  function buildMenus() {
    var goRows = ARTICLES.slice().sort(byTitle).map(function (a) {
      return { label: a.title, act: function () { openArticle(a.id); } };
    });
    var viewRows = [{ label: 'Все статьи', act: function () { openFolder(null); } }, { sep: true }]
      .concat(categories().map(function (c) { return { label: c.name, act: function () { openFolder(c.name); } }; }));

    var menus = [
      { title: 'Файл', rows: [
        { label: 'Найти…', act: function () { openSearch(''); } },
        { label: 'О Кодексе', act: openReadme },
        { sep: true },
        { label: 'Закрыть окно', act: function () { if (openWindows.length) closeWindow(openWindows[openWindows.length - 1]); } },
        { label: 'Убрать все окна', act: closeAll }
      ]},
      { title: 'Вид', rows: viewRows },
      { title: 'Переход', rows: goRows }
    ];

    var h = '<div class="mb-brand"><span class="diamond"></span>КОДЕКС</div>';
    menus.forEach(function (m, mi) {
      h += '<div class="mb-item" data-m="' + mi + '">' + m.title +
        '<div class="mb-drop">' + m.rows.map(function (r) {
          return r.sep ? '<div class="mb-sep"></div>' : '<div class="mb-row">' + r.label + '</div>';
        }).join('') + '</div></div>';
    });
    h += '<div class="mb-item mb-theme" id="theme-btn">ТЕМА</div>';
    h += '<div class="mb-clock" id="clock">--:--</div>';
    elMenubar.innerHTML = h;
    elClock = document.getElementById('clock');

    elMenubar.querySelectorAll('.mb-item[data-m]').forEach(function (item) {
      var mi = +item.getAttribute('data-m');
      var rowsEls = item.querySelectorAll('.mb-row');
      var real = menus[mi].rows.filter(function (r) { return !r.sep; });
      rowsEls.forEach(function (rowEl, ri) {
        rowEl.addEventListener('click', function (e) { e.stopPropagation(); closeMenus(); real[ri].act(); });
      });
      item.addEventListener('click', function (e) {
        if (e.target.closest('.mb-row')) return;
        var wasOpen = item.classList.contains('open');
        closeMenus(); if (!wasOpen) item.classList.add('open');
        e.stopPropagation();
      });
    });
    document.addEventListener('click', closeMenus);
    var tb = document.getElementById('theme-btn');
    if (tb) tb.addEventListener('click', function (e) { e.stopPropagation(); closeMenus(); toggleTheme(); });
  }
  function closeMenus() { elMenubar.querySelectorAll('.mb-item.open').forEach(function (i) { i.classList.remove('open'); }); }

  /* ---- часы ------------------------------------------------------------ */
  function tick() {
    if (!elClock) return;
    var d = new Date();
    elClock.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---- старт ----------------------------------------------------------- */
  setMobileFlag();
  window.addEventListener('resize', setMobileFlag);
  buildMenus();
  buildDesktop();
  buildLightbox();
  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('pd04-theme') || 'light'; } catch (e) {}
  applyTheme(savedTheme);
  tick(); setInterval(tick, 15000);

  // приветственное окно при первом заходе
  openReadme();

  // публичный хук для отладки
  window.OS = { openArticle: openArticle, openFolder: openFolder, openSearch: openSearch };
})();
