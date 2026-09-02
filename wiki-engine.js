/* ==========================================================================
   КОДЕКС ПАНДЕМОНИУМ — движок
   --------------------------------------------------------------------------
   Отображает статьи из articles.js. Маршрутизация — через #hash, поэтому сайт
   работает как обычные файлы, без сервера.

   Маршруты:
     #/main            — заглавная
     #/<id>            — статья
     #/cat/<Название>  — список статей категории
     #/search/<строка> — результаты поиска
   ========================================================================== */
(function () {
  'use strict';

  var ARTICLES = window.WIKI_ARTICLES || [];
  var BY_ID = {};
  ARTICLES.forEach(function (a) { BY_ID[a.id] = a; });

  var elContent = document.getElementById('content');
  var elSidebar = document.getElementById('sidebar');
  var elSearch  = document.getElementById('search');
  var elSuggest = document.getElementById('suggest');
  var elMenuBtn = document.getElementById('menu-btn');

  /* ---- утилиты --------------------------------------------------------- */
  function stripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function articleText(a) {
    var t = a.title + ' ' + (a.aka || []).join(' ') + ' ' + stripHtml(a.intro);
    (a.sections || []).forEach(function (s) { t += ' ' + s.h + ' ' + stripHtml(s.html); });
    return t;
  }
  function contentArticles() {
    return ARTICLES.filter(function (a) { return !a.isMain; });
  }
  function categoriesList() {
    var set = {};
    contentArticles().forEach(function (a) {
      (a.categories || []).forEach(function (c) { set[c] = (set[c] || 0) + 1; });
    });
    return Object.keys(set).sort(function (x, y) { return x.localeCompare(y, 'ru'); })
      .map(function (c) { return { name: c, count: set[c] }; });
  }
  function articlesInCategory(cat) {
    return contentArticles().filter(function (a) {
      return (a.categories || []).indexOf(cat) !== -1;
    }).sort(byTitle);
  }
  function byTitle(x, y) { return x.title.localeCompare(y.title, 'ru'); }

  /* ---- боковая навигация ---------------------------------------------- */
  function buildSidebar() {
    var h = '';
    h += '<div class="side-block"><div class="side-h">Навигация</div><ul class="side-list">' +
         '<li><a href="#/main" data-id="main">Заглавная</a></li>' +
         '<li><a href="#/random" class="side-random">Случайная статья</a></li>' +
         '</ul></div>';

    h += '<div class="side-block"><div class="side-h">Категории</div><ul class="side-list">';
    categoriesList().forEach(function (c) {
      h += '<li><a href="#/cat/' + encodeURIComponent(c.name) + '">' + c.name +
           '<span class="side-count">' + c.count + '</span></a></li>';
    });
    h += '</ul></div>';

    h += '<div class="side-block"><div class="side-h">Все статьи</div><ul class="side-list">';
    contentArticles().sort(byTitle).forEach(function (a) {
      h += '<li><a href="#/' + a.id + '" data-id="' + a.id + '">' + a.title +
           (a.stub ? ' <span class="side-stub">заготовка</span>' : '') + '</a></li>';
    });
    h += '</ul></div>';

    elSidebar.innerHTML = h;
  }

  function highlightNav(id) {
    var links = elSidebar.querySelectorAll('a[data-id]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('active', links[i].getAttribute('data-id') === id);
    }
  }

  /* ---- рендер статьи --------------------------------------------------- */
  function renderInfobox(a) {
    if (!a.infobox) return '';
    var ib = a.infobox, h = '';
    h += '<aside class="infobox">';
    h += '<div class="ib-head"><span class="ib-emblem">' + (a.emblem || '◍') + '</span>' +
         '<span class="ib-title">' + a.title + '</span></div>';
    if (ib.caption) h += '<div class="ib-caption">' + ib.caption + '</div>';
    h += '<table class="ib-table"><tbody>';
    (ib.rows || []).forEach(function (r) {
      h += '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    });
    h += '</tbody></table></aside>';
    return h;
  }

  function renderCategories(a) {
    if (!a.categories || !a.categories.length) return '';
    var h = '<div class="cat-foot"><span class="cat-foot-label">Категории:</span> ';
    h += a.categories.map(function (c) {
      return '<a class="cat-chip" href="#/cat/' + encodeURIComponent(c) + '">' + c + '</a>';
    }).join(' ');
    return h + '</div>';
  }

  function renderSeeAlso(a) {
    var ids = (a.seeAlso || []).filter(function (id) { return BY_ID[id]; });
    if (!ids.length) return '';
    var h = '<div class="see-also"><h2>См. также</h2><ul>';
    ids.forEach(function (id) {
      h += '<li><a href="#/' + id + '">' + BY_ID[id].title + '</a></li>';
    });
    return h + '</ul></div>';
  }

  function renderPortal() {
    // подборка для заглавной: несколько ключевых статей + переход по категориям
    var featured = ['pandemonium-04', 'soca', 'smaily', 'koko', 'marai', 'astralis'];
    var h = '<div class="portal-grid">';
    featured.forEach(function (id) {
      var a = BY_ID[id]; if (!a) return;
      h += '<a class="portal-card" href="#/' + id + '">' +
           '<span class="pc-emblem">' + (a.emblem || '◍') + '</span>' +
           '<span class="pc-title">' + a.title + '</span>' +
           '<span class="pc-sub">' + (a.infobox && a.infobox.caption ? a.infobox.caption : '') + '</span>' +
           '</a>';
    });
    h += '</div>';

    h += '<div class="portal-cats"><h2>Обзор по категориям</h2><div class="pcat-row">';
    categoriesList().forEach(function (c) {
      h += '<a class="pcat" href="#/cat/' + encodeURIComponent(c.name) + '">' + c.name +
           '<span class="side-count">' + c.count + '</span></a>';
    });
    h += '</div></div>';
    return h;
  }

  function renderArticle(a) {
    var h = '<article class="article">';
    if (a.stub) {
      h += '<div class="stub-note"><strong>Заготовка.</strong> Эта статья намеренно неполна — часть сведений ещё не раскрыта.</div>';
    }
    h += '<h1 class="art-title">' + a.title + '</h1>';
    if (a.aka && a.aka.length) {
      h += '<div class="art-aka">' + a.aka.slice(0, 4).join(' · ') + '</div>';
    }
    if (!a.isMain) h += renderInfobox(a);
    h += '<div class="art-body">';
    h += a.intro || '';
    if (a.portal) h += renderPortal();
    (a.sections || []).forEach(function (s) {
      h += '<h2>' + s.h + '</h2>' + s.html;
    });
    h += renderSeeAlso(a);
    h += renderCategories(a);
    h += '</div></article>';
    elContent.innerHTML = h;
    document.title = (a.isMain ? 'Кодекс Пандемониум' : a.title + ' — Кодекс Пандемониум');
    highlightNav(a.id);
    scrollTop();
  }

  /* ---- рендер категории ------------------------------------------------ */
  function renderCategory(cat) {
    var list = articlesInCategory(cat);
    var h = '<article class="article listing">';
    h += '<div class="crumbs"><a href="#/main">Заглавная</a> › Категория</div>';
    h += '<h1 class="art-title">Категория: ' + cat + '</h1>';
    if (!list.length) {
      h += '<p class="empty">В этой категории пока нет статей. <a href="#/main">Вернуться на заглавную</a>.</p>';
    } else {
      h += '<p class="listing-count">Статей: ' + list.length + '</p><ul class="listing-list">';
      list.forEach(function (a) {
        h += '<li><a href="#/' + a.id + '">' + a.title + '</a>' +
             (a.stub ? ' <span class="side-stub">заготовка</span>' : '') +
             '<span class="listing-snip">' + snippet(a) + '</span></li>';
      });
      h += '</ul>';
    }
    h += '</article>';
    elContent.innerHTML = h;
    document.title = 'Категория: ' + cat + ' — Кодекс Пандемониум';
    highlightNav(null);
    scrollTop();
  }

  function snippet(a, q) {
    var text = stripHtml(a.intro);
    if (q) {
      var i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i > 40) text = '…' + text.slice(i - 30);
    }
    return text.length > 140 ? text.slice(0, 140) + '…' : text;
  }

  /* ---- поиск ----------------------------------------------------------- */
  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    return contentArticles().map(function (a) {
      var hay = (a.title + ' ' + (a.aka || []).join(' ')).toLowerCase();
      var body = articleText(a).toLowerCase();
      var score = 0;
      if (a.title.toLowerCase() === q) score += 100;
      if (hay.indexOf(q) !== -1) score += 40;
      if (body.indexOf(q) !== -1) score += 10;
      return { a: a, score: score };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (x, y) { return y.score - x.score; })
      .map(function (r) { return r.a; });
  }

  function renderSearch(q) {
    var res = search(q);
    var h = '<article class="article listing">';
    h += '<h1 class="art-title">Поиск: ' + escapeHtml(q) + '</h1>';
    if (!res.length) {
      h += '<p class="empty">Ничего не найдено. Проверьте написание или загляните на <a href="#/main">заглавную</a>.</p>';
    } else {
      h += '<p class="listing-count">Найдено: ' + res.length + '</p><ul class="listing-list">';
      res.forEach(function (a) {
        h += '<li><a href="#/' + a.id + '">' + a.title + '</a>' +
             '<span class="listing-snip">' + snippet(a, q) + '</span></li>';
      });
      h += '</ul>';
    }
    h += '</article>';
    elContent.innerHTML = h;
    document.title = 'Поиск: ' + q + ' — Кодекс Пандемониум';
    highlightNav(null);
    scrollTop();
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- живые подсказки поиска ----------------------------------------- */
  function updateSuggest() {
    var q = elSearch.value.trim();
    if (q.length < 2) { closeSuggest(); return; }
    var res = search(q).slice(0, 6);
    if (!res.length) { closeSuggest(); return; }
    elSuggest.innerHTML = res.map(function (a) {
      return '<a class="sg-item" href="#/' + a.id + '">' +
             '<span class="sg-em">' + (a.emblem || '◍') + '</span>' +
             '<span class="sg-t">' + a.title + '</span></a>';
    }).join('');
    elSuggest.classList.add('open');
  }
  function closeSuggest() { elSuggest.classList.remove('open'); elSuggest.innerHTML = ''; }

  /* ---- маршрутизация --------------------------------------------------- */
  function route() {
    closeSuggest();
    closeDrawer();
    var hash = location.hash.replace(/^#\/?/, '');
    if (!hash || hash === 'main') { renderArticle(BY_ID.main); return; }

    if (hash === 'random') {
      var pool = contentArticles();
      var pick = pool[Math.floor(Math.random() * pool.length)];
      location.hash = '#/' + pick.id;
      return;
    }
    if (hash.indexOf('cat/') === 0) {
      renderCategory(decodeURIComponent(hash.slice(4))); return;
    }
    if (hash.indexOf('search/') === 0) {
      renderSearch(decodeURIComponent(hash.slice(7))); return;
    }
    var a = BY_ID[hash];
    if (a) { renderArticle(a); return; }
    renderNotFound(hash);
  }

  function renderNotFound(id) {
    elContent.innerHTML = '<article class="article"><h1 class="art-title">Статья не найдена</h1>' +
      '<p class="empty">Записи «' + escapeHtml(id) + '» в Кодексе нет. ' +
      'Откройте <a href="#/main">заглавную</a> или выберите статью в списке слева.</p></article>';
    document.title = 'Не найдено — Кодекс Пандемониум';
    highlightNav(null);
    scrollTop();
  }

  /* ---- мобильный ящик навигации --------------------------------------- */
  function openDrawer() { document.body.classList.add('drawer-open'); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); }
  function scrollTop() { if (elContent) elContent.scrollTop = 0; window.scrollTo(0, 0); }

  /* ---- события --------------------------------------------------------- */
  var suggestTimer;
  if (elSearch) {
    elSearch.addEventListener('input', function () {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(updateSuggest, 120);
    });
    elSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var q = elSearch.value.trim();
        if (q) location.hash = '#/search/' + encodeURIComponent(q);
      } else if (e.key === 'Escape') { closeSuggest(); elSearch.blur(); }
    });
  }
  document.addEventListener('click', function (e) {
    if (elSuggest && !elSuggest.contains(e.target) && e.target !== elSearch) closeSuggest();
  });
  if (elMenuBtn) elMenuBtn.addEventListener('click', function () {
    document.body.classList.toggle('drawer-open');
  });

  window.addEventListener('hashchange', route);

  /* ---- старт ----------------------------------------------------------- */
  buildSidebar();
  route();
})();
