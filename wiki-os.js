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

  /* ---- пиксельные иконки (SVG, моно, currentColor) --------------------- */
  var ICO = {
    folder: '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M1 4h6l2 2h10v10H1z"/><path d="M1 4h6l2 2"/></svg>',
    disk:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><rect x="2" y="1" width="16" height="16"/><rect x="6" y="1" width="8" height="6"/><rect x="5" y="10" width="10" height="7"/><line x1="11" y1="2" x2="11" y2="6"/></svg>',
    doc:    '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M4 1h8l4 4v12H4z"/><path d="M12 1v4h4"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="6" y1="11" x2="14" y2="11"/><line x1="6" y1="14" x2="11" y2="14"/></svg>',
    find:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.6" shape-rendering="crispEdges"><circle cx="8" cy="7" r="5"/><line x1="12" y1="11" x2="17" y2="16"/></svg>',
    note:   '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><rect x="3" y="1" width="14" height="16"/><line x1="6" y1="5" x2="14" y2="5"/><line x1="6" y1="8" x2="14" y2="8"/><line x1="6" y1="11" x2="14" y2="11"/><line x1="6" y1="14" x2="11" y2="14"/></svg>',
    trash:  '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.4" shape-rendering="crispEdges"><path d="M4 4h12l-1 13H5z"/><line x1="2" y1="4" x2="18" y2="4"/><path d="M8 4V2h4v2"/><line x1="8" y1="7" x2="8" y2="14"/><line x1="12" y1="7" x2="12" y2="14"/></svg>'
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

  /* ---- утилиты по данным ----------------------------------------------- */
  function stripHtml(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function byTitle(x, y) { return x.title.localeCompare(y.title, 'ru'); }
  function categories() {
    var set = {};
    ARTICLES.forEach(function (a) { (a.categories || []).forEach(function (c) { set[c] = (set[c] || 0) + 1; }); });
    return Object.keys(set).sort(function (x, y) { return x.localeCompare(y, 'ru'); }).map(function (c) { return { name: c, count: set[c] }; });
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
    // корзина — во флаворе референса, отдельно внизу
    h += '<div class="dicon trash" data-trash="1"><span class="glyph">' + ICO.trash +
         '</span><span class="label">КОРЗИНА</span></div>';
    elIcons.innerHTML = h;

    elIcons.querySelectorAll('.dicon[data-i]').forEach(function (el) {
      var it = items[+el.getAttribute('data-i')];
      el.addEventListener('click', function () { selectIcon(el); it.act(); });
    });
    var trash = elIcons.querySelector('[data-trash]');
    trash.addEventListener('click', function () {
      selectIcon(trash);
      makeWindow({ key: 'trash', name: 'КОРЗИНА', sub: '0 файлов',
        bodyHtml: '<div class="empty-note">Корзина пуста.<br>СОКА бы сказала: «а ты чего ждал?»</div>', w: 300 });
    });
  }
  function selectIcon(el) {
    elIcons.querySelectorAll('.dicon.selected').forEach(function (d) { d.classList.remove('selected'); });
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
    // перехват внутренних ссылок #/...
    w.querySelector('.win-body').addEventListener('click', onInnerClick);
    // клики по строкам файлов
    w.querySelectorAll('.filerow[data-open]').forEach(function (row) {
      row.addEventListener('click', function () { openArticle(row.getAttribute('data-open')); });
    });
    if (opts.onMount) opts.onMount(w);
    return w;
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
    var a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    routeHash(a.getAttribute('href'));
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
  function renderInfobox(a) {
    if (!a.infobox) return '';
    var ib = a.infobox;
    var h = '<aside class="infobox"><div class="ib-head"><span class="ib-emblem">' + (a.emblem || '?') +
      '</span><span class="ib-title">' + a.title + '</span></div>';
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
  function openArticle(id) {
    var a = BY_ID[id]; if (!a) return;
    var body = '<div class="article">';
    if (a.stub) body += '<div class="stub-note"><b>ЗАГОТОВКА.</b> Файл намеренно неполон — часть данных ещё не раскрыта.</div>';
    body += '<div class="a-title">' + a.title + '</div>';
    if (a.aka && a.aka.length) body += '<div class="a-aka">' + a.aka.slice(0, 4).join(' · ') + '</div>';
    body += renderInfobox(a);
    body += '<div class="a-body">' + (a.intro || '');
    (a.sections || []).forEach(function (s) { body += '<h2>' + s.h + '</h2>' + s.html; });
    body += renderSeeAlso(a) + renderCats(a) + '</div></div>';
    makeWindow({ key: 'art:' + id, name: (a.title + '.doc').toUpperCase(),
      sub: (a.stub ? 'DIR/?' : 'DIR/ok'), bodyHtml: body, w: 560 });
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
      'Здесь собрано то, что известно точно: персонажи, корабль, станция <a href="#/astralis">Астралис</a> и устройство мира.</p>' +
      '<p>Открывайте папки-диски на рабочем столе или ищите через «ПОИСК». ' +
      'Часть мира намеренно оставлена в тени — Кодекс объясняет устройство, но не раскрывает загадки.</p>' +
      '<p><em>Клик по иконке или файлу открывает окно. Крестик слева — закрыть. Меню «Переход» — прыгнуть в любую статью.</em></p>' +
      '</div></div>';
    makeWindow({ key: 'readme', name: 'О КОДЕКСЕ', sub: '', bodyHtml: body, w: 420 });
  }

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

    var h = '<div class="mb-brand"><span class="diamond">\u25c6</span> КОДЕКС</div>';
    menus.forEach(function (m, mi) {
      h += '<div class="mb-item" data-m="' + mi + '">' + m.title +
        '<div class="mb-drop">' + m.rows.map(function (r) {
          return r.sep ? '<div class="mb-sep"></div>' : '<div class="mb-row">' + r.label + '</div>';
        }).join('') + '</div></div>';
    });
    h += '<div class="mb-clock" id="clock">--:--</div>';
    elMenubar.innerHTML = h;
    elClock = document.getElementById('clock');

    elMenubar.querySelectorAll('.mb-item').forEach(function (item) {
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
  tick(); setInterval(tick, 15000);

  // приветственное окно при первом заходе
  openReadme();

  // публичный хук для отладки
  window.OS = { openArticle: openArticle, openFolder: openFolder, openSearch: openSearch };
})();
