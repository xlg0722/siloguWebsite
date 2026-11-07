/**
 * 商店页：列表筛选、详情、下载
 * 数据来自 store-data.js 的 window.STORE_ITEMS（只读阶段）
 * 下载复用桌面端的原生下载能力，网页端则直接跳转外链
 */
(function () {
    const items = Array.isArray(window.STORE_ITEMS) ? window.STORE_ITEMS : [];
    const isDesktop = !!(window.desktopAPI && window.desktopAPI.isDesktop);

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

    let activeKind = 'all';
    let keyword = '';
    let currentItem = null;

    if (!grid) return;

    function kindLabel(kind) {
        return kind === 'app' ? '应用' : '游戏';
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
        meta.textContent = (item.author || '匿名') + ' · ' + (item.version || '') +
            (item.size ? ' · ' + item.size : '');

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

    function renderList() {
        grid.innerHTML = '';
        const visible = items.filter(matches);
        visible.forEach(function (item) {
            grid.appendChild(buildCard(item));
        });
        if (emptyTip) emptyTip.hidden = visible.length > 0;
    }

    function openDetail(item) {
        currentItem = item;
        if (msg) msg.textContent = '';
        if (progress) progress.hidden = true;

        if (detailCover) {
            detailCover.dataset.kind = item.kind;
            if (item.cover) {
                detailCover.classList.add('store-detail__cover--img');
                detailCover.style.backgroundImage = 'url("' + item.cover + '")';
                detailCover.textContent = '';
            } else {
                detailCover.classList.remove('store-detail__cover--img');
                detailCover.style.backgroundImage = '';
                detailCover.textContent = (item.title || '?').slice(0, 1);
            }
        }
        if (detailTitle) detailTitle.textContent = item.title;
        if (detailMeta) {
            detailMeta.textContent = kindLabel(item.kind) + ' · ' + (item.author || '匿名') +
                ' · ' + (item.version || '');
        }
        if (detailDesc) detailDesc.textContent = item.description || item.summary || '';
        if (detailSize) detailSize.textContent = item.size ? '文件大小：' + item.size : '';

        if (listView) listView.hidden = true;
        if (detailView) detailView.hidden = false;
    }

    function closeDetail() {
        currentItem = null;
        if (progress) progress.hidden = true;
        if (detailView) detailView.hidden = true;
        if (listView) listView.hidden = false;
    }

    function showProgress(show, received, total) {
        if (!progress) return;
        progress.hidden = !show;
        if (!show) return;
        const hasTotal = total > 0;
        const percent = hasTotal ? Math.min(100, Math.round(received / total * 100)) : 0;
        if (progressFill) progressFill.style.width = (hasTotal ? percent : 0) + '%';
        if (progressText) {
            progressText.textContent = hasTotal
                ? percent + '% · ' + fmtBytes(received) + ' / ' + fmtBytes(total)
                : '已下载 ' + fmtBytes(received);
        }
    }

    function startDownload() {
        if (!currentItem) return;
        if (msg) msg.textContent = '';

        const url = currentItem.url;
        const fileName = currentItem.fileName || currentItem.title;

        // 桌面端：原生下载，带进度；网页端：直接跳转外链
        if (isDesktop && window.desktopAPI && typeof window.desktopAPI.downloadFile === 'function') {
            showProgress(true, 0, 0);
            window.desktopAPI.downloadFile({ url: url, filename: fileName })
                .catch(function (err) {
                    showProgress(false);
                    if (msg) msg.textContent = '下载失败：' + (err && err.message ? err.message : '未知错误');
                });
            return;
        }

        window.location.href = url;
    }

    // 筛选按钮
    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            activeKind = chip.dataset.kind || 'all';
            chips.forEach(function (c) {
                c.classList.toggle('store-chip--active', c === chip);
            });
            renderList();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            keyword = searchInput.value || '';
            renderList();
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', closeDetail);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', startDownload);
    }

    // 桌面端下载进度
    if (isDesktop && window.desktopAPI) {
        if (typeof window.desktopAPI.onDownloadProgress === 'function') {
            window.desktopAPI.onDownloadProgress(function (data) {
                if (!currentItem || !detailView || detailView.hidden) return;
                showProgress(true, data.received || 0, data.total || 0);
            });
        }
        if (typeof window.desktopAPI.onDownloadDone === 'function') {
            window.desktopAPI.onDownloadDone(function (data) {
                if (!currentItem) return;
                showProgress(true, 1, 1);
                if (msg) msg.textContent = '下载完成：' + (data && data.path ? data.path : '');
            });
        }
        if (typeof window.desktopAPI.onDownloadError === 'function') {
            window.desktopAPI.onDownloadError(function (data) {
                if (!currentItem) return;
                showProgress(false);
                if (msg) msg.textContent = '下载失败：' + (data && data.message ? data.message : '未知错误');
            });
        }
    }

    // 每次进入商店页回到列表，避免停在上一次的详情
    window.addEventListener('silgu:page', function (e) {
        if (!e.detail || e.detail.name !== 'store') return;
        closeDetail();
        renderList();
    });

    renderList();
})();