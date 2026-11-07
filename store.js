/**
 * 商店页：列表筛选、详情、版本列表、下载
 * 数据来自 store-data.js 的 window.STORE_ITEMS（只读阶段）
 * versionMode='all' 时实时读取 Gitee 发行版列表，所有版本都可下载
 * versionMode='latest' 时只显示最新版本
 * 下载复用桌面端的原生下载能力，网页端则直接跳转外链
 */
(function () {
    const items = Array.isArray(window.STORE_ITEMS) ? window.STORE_ITEMS : [];
    const isDesktop = !!(window.desktopAPI && window.desktopAPI.isDesktop);
    const RELEASES_API = 'https://gitee.com/api/v5/repos/';

    const listView = document.getElementById('store-list-view');
    const detailView = document.getElementById('store-detail-view');
    const grid = document.getElementById('store-grid');
    const emptyTip = document.getElementById('store-empty');
    const searchInput = document.getElementById('store-search');
    const chips = Array.prototype.slice.call(document.querySelectorAll('#page-store .store-chip'));

    const detailCover = document.getElementById('store-detail-cover');
    const detailTitle = document.getElementById('store-detail-title');
    const detailMeta = document.getElementById('store-detail-meta');
    const detailDesc = document.getElementById('store-detail-desc');
    const detailSize = document.getElementById('store-detail-size');
    const downloadBtn = document.getElementById('store-download');
    const msg = document.getElementById('store-msg');
    const progress = document.getElementById('store-progress');
    const progressFill = document.getElementById('store-progress-fill');
    const progressText = document.getElementById('store-progress-text');
    const backBtn = document.getElementById('store-back');
    const versionsWrap = document.getElementById('store-versions');
    const versionsList = document.getElementById('store-versions-list');

    let activeKind = 'all';
    let keyword = '';
    let currentItem = null;
    // 每次打开详情自增，用来丢弃过期的异步请求
    let openToken = 0;
    let downloading = false;

    if (!grid) return;

    function kindLabel(kind) {
        return kind === 'app' ? '应用' : '游戏';
    }

    // 卡片 meta 文案，列表和异步刷新都用它，保证两边一致
    function cardMetaText(item) {
        return (item.author || '匿名') + ' · ' + (item.version || '') +
            (item.size ? ' · ' + item.size : '') +
            (item.versionMode === 'all' ? ' · 多版本' : '');
    }

    function fmtBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n <= 0) return '';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }

    function matches(item) {
        if (activeKind !== 'all' && item.kind !== activeKind) return false;
        const k = keyword.trim().toLowerCase();
        if (!k) return true;
        const text = (item.title + ' ' + (item.summary || '') + ' ' + (item.author || '')).toLowerCase();
        return text.indexOf(k) !== -1;
    }

    function buildCard(item) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'store-card';
        card.setAttribute('aria-label', '查看 ' + item.title);

        const cover = document.createElement('span');
        cover.className = 'store-card__cover';
        cover.dataset.kind = item.kind;
        if (item.cover) {
            cover.classList.add('store-card__cover--img');
            cover.style.backgroundImage = 'url("' + item.cover + '")';
        } else {
            cover.textContent = (item.title || '?').slice(0, 1);
        }

        const body = document.createElement('span');
        body.className = 'store-card__body';

        const top = document.createElement('span');
        top.className = 'store-card__top';
        const title = document.createElement('span');
        title.className = 'store-card__title';
        title.textContent = item.title;
        const badge = document.createElement('span');
        badge.className = 'store-card__badge';
        badge.dataset.kind = item.kind;
        badge.textContent = kindLabel(item.kind);
        top.appendChild(title);
        top.appendChild(badge);

        const summary = document.createElement('span');
        summary.className = 'store-card__summary';
        summary.textContent = item.summary || '';

        const meta = document.createElement('span');
        meta.className = 'store-card__meta';
        meta.textContent = cardMetaText(item);
        // 挂在卡片上，异步拿到最新版本后直接改这段文字
        card.__meta = meta;

        body.appendChild(top);
        body.appendChild(summary);
        body.appendChild(meta);
        card.appendChild(cover);
        card.appendChild(body);

        card.addEventListener('click', function () {
            openDetail(item);
        });
        return card;
    }

    // 最新版本缓存：60 秒内不重复请求同一仓库
    const versionCache = {};
    const VERSION_CACHE_MS = 60 * 1000;

    function fetchLatestVersion(item) {
        if (!item || !item.repo) return Promise.resolve(null);
        const cached = versionCache[item.repo];
        if (cached && Date.now() - cached.at < VERSION_CACHE_MS) {
            return Promise.resolve(cached.version);
        }
        return fetchReleases(item).then(function (releases) {
            const latest = pickLatestRelease(releases);
            if (!latest || !latest.tag_name) return null;
            versionCache[item.repo] = { at: Date.now(), version: latest.tag_name };
            return latest.tag_name;
        });
    }

    // 仅最新版的条目：卡片上的版本号跟着 Gitee 实际发行版走，不用手改代码
    function refreshCardVersion(item, card) {
        if (!item || item.versionMode !== 'latest') return;
        fetchLatestVersion(item).then(function (tag) {
            if (!tag) return;
            if (tag !== item.version) item.version = tag;
            if (card.__meta) card.__meta.textContent = cardMetaText(item);
        }).catch(function () {
            // 离线时保留 store-data.js 里写好的版本号
        });
    }

    function renderList() {
        grid.innerHTML = '';
        const visible = items.filter(matches);
        visible.forEach(function (item) {
            const card = buildCard(item);
            grid.appendChild(card);
            refreshCardVersion(item, card);
        });
        if (emptyTip) emptyTip.hidden = visible.length > 0;
    }

    // 从发行版资产里挑出真正的安装包，排除 Gitee 自动附加的源码包
    function pickAsset(release, item) {
        const assets = (release && release.assets) || [];
        const keyword = (item && item.assetKeyword) ? item.assetKeyword.toLowerCase() : '';
        const matched = assets.filter(function (a) {
            return a && a.name && keyword && a.name.toLowerCase().indexOf(keyword) !== -1;
        })[0];
        if (matched) return matched;

        return assets.filter(function (a) {
            if (!a || !a.name) return false;
            if (/\.tar\.gz$/i.test(a.name)) return false;
            // 源码包的名字等于标签名（tag.zip / tag.tar.gz）
            if (release && a.name === release.tag_name + '.zip') return false;
            return true;
        })[0] || null;
    }

    function fileBaseName(url, fallback) {
        try {
            const path = url.split('?')[0].split('/').pop();
            return path ? decodeURIComponent(path) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    // 标签形如 v1.0.1 时解析成数组，beta-v1.0-win64 这类返回 null
    function versionToArray(text) {
        const match = String(text || '').match(/v?(\d+)\.(\d+)\.(\d+)/i);
        if (!match) return null;
        return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function compareVersionList(a, b) {
        for (let i = 0; i < 3; i++) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    // 发行版接口按创建时间排序，不能保证第一个就是最新版，这里按版本号取最大
    function pickLatestRelease(releases) {
        const withVersion = releases.filter(function (release) {
            return versionToArray(release && release.tag_name);
        });
        if (!withVersion.length) return releases[0] || null;

        return withVersion.slice().sort(function (a, b) {
            return compareVersionList(versionToArray(b.tag_name), versionToArray(a.tag_name));
        })[0];
    }

    // 读取 Gitee 发行版列表（浏览器和 Electron 都可直接跨域访问）
    function fetchReleases(item) {
        if (!item || !item.repo) return Promise.resolve([]);
        return fetch(RELEASES_API + item.repo + '/releases?page=1&per_page=20', {
            headers: { Accept: 'application/json' }
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (list) {
            return Array.isArray(list) ? list : [];
        });
    }

    function renderVersionRows(item, releases) {
        if (!versionsList) return;
        versionsList.innerHTML = '';

        releases.forEach(function (release) {
            const asset = pickAsset(release, item);
            if (!asset) return;

            const row = document.createElement('div');
            row.className = 'store-version';
