/**
 * 商店页：列表筛选、详情、版本列表、下载
 * 商店条目只描述「是什么、从哪个仓库取」，版本号 / 大小 / 下载地址
 * 全部在运行时从 Gitee 发行版读取，发版后不需要再改代码。
 * versionMode='all'    列出所有发行版，每个都能下载
 * versionMode='latest' 只显示版本号最大的那个发行版
 */
(function () {
    const items = Array.isArray(window.STORE_ITEMS) ? window.STORE_ITEMS : [];
    const isDesktop = !!(window.desktopAPI && window.desktopAPI.isDesktop);
    const RELEASES_API = 'https://gitee.com/api/v5/repos/';

    // 发行版缓存：10 分钟内直接用本地缓存，避免每次进商店都等接口
    const CACHE_PREFIX = 'silgu:releases:';
    const CACHE_MS = 10 * 60 * 1000;

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

    function fmtBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n <= 0) return '';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }

    // 卡片 meta 文案：版本号还没读到时显示占位，不显示过期版本
    function cardMetaText(item) {
        const parts = [item.author || '匿名'];
        if (item.version) {
            parts.push(item.version);
            if (item.size) parts.push(item.size);
        } else if (item.loadFailed) {
            parts.push('读取版本失败');
        } else {
            parts.push('正在读取版本…');
        }
        if (item.versionMode === 'all') parts.push('多版本');
        return parts.join(' · ');
    }

    function matches(item) {
        if (activeKind !== 'all' && item.kind !== activeKind) return false;
        const k = keyword.trim().toLowerCase();
        if (!k) return true;
        const text = (item.title + ' ' + (item.summary || '') + ' ' + (item.author || '')).toLowerCase();
        return text.indexOf(k) !== -1;
    }

    // 封面图：logo / 图标都是黑色线稿，靠 CSS 反白显示在深色封面上
    function coverImage(item) {
        const img = document.createElement('img');
        img.className = 'store-cover-img';
        img.alt = '';
        img.src = item.cover;
        if (item.coverInvert) img.classList.add('store-cover-img--invert');
        if (item.coverPixel) img.classList.add('store-cover-img--pixel');
        return img;
    }

    // ===== 发行版读取 =====

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

    // 只留需要的字段，缓存体积小
    function slimRelease(release) {
        return {
            tag_name: (release && release.tag_name) || '',
            prerelease: !!(release && release.prerelease),
            created_at: (release && release.created_at) || '',
            assets: ((release && release.assets) || []).map(function (asset) {
                return {
                    name: (asset && asset.name) || '',
                    size: (asset && asset.size) || 0,
                    browser_download_url: (asset && asset.browser_download_url) || ''
                };
            })
        };
    }

    function readCache(repo) {
        try {
            const raw = window.localStorage.getItem(CACHE_PREFIX + repo);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.releases) || !data.releases.length) return null;
            return data;
        } catch (err) {
            return null;
        }
    }

    function writeCache(repo, releases) {
        try {
            window.localStorage.setItem(CACHE_PREFIX + repo, JSON.stringify({
                at: Date.now(),
                releases: releases
            }));
        } catch (err) {
            // 隐私模式写不了缓存时忽略
        }
    }

    function fetchReleases(item) {
        if (!item || !item.repo) return Promise.resolve([]);
        return fetch(RELEASES_API + item.repo + '/releases?page=1&per_page=20', {
            headers: { Accept: 'application/json' }
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (list) {
            if (!Array.isArray(list)) throw new Error('返回格式不对');
            return list.map(slimRelease);
        });
    }

    // 有新鲜缓存直接用；否则请求接口，失败时退回 releases.json 快照，再退回旧缓存
    function loadReleases(item) {
        if (!item || !item.repo) return Promise.resolve([]);
        const cached = readCache(item.repo);
        if (cached && Date.now() - cached.at < CACHE_MS) {
            return Promise.resolve(cached.releases);
        }
        return fetchReleases(item).then(function (releases) {
            if (!releases.length) throw new Error('没有发行版');
            writeCache(item.repo, releases);
            return releases;
        }).catch(function () {
            return fetchSnapshot(item).then(function (snapshot) {
                if (snapshot) {
                    writeCache(item.repo, snapshot);
                    return snapshot;
                }
                if (cached) return cached.releases;
                throw new Error('无法获取发行版');
            });
        });
    }

    // releases.json 由 GitHub Actions 定时从 Gitee 抓取生成，
    // Gitee 接口被限流时用它兜底（Electron 走 file:// 读不到，会直接跳过）
    function fetchSnapshot(item) {
        return fetch('releases.json', { headers: { Accept: 'application/json' } })
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
            .then(function (data) {
                const list = data && data.repos ? data.repos[item.repo] : null;
                if (!Array.isArray(list) || !list.length) return null;
                return list.map(slimRelease);
            })
            .catch(function () {
                return null;
            });
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

    // 接口按创建时间排序，不能保证第一个就是最新版：能解析版本号就比版本号，
    // 标签不是 x.y.z（比如 beta-v1.0-win64）就比发布时间
    function sortReleasesDesc(releases) {
        return releases.slice().sort(function (a, b) {
            const va = versionToArray(a && a.tag_name);
            const vb = versionToArray(b && b.tag_name);
            if (va && vb) return compareVersionList(vb, va);
            if (va) return -1;
            if (vb) return 1;
            return String((b && b.created_at) || '').localeCompare(String((a && a.created_at) || ''));
        });
    }

    function pickLatestRelease(releases) {
        if (!releases.length) return null;
        return sortReleasesDesc(releases)[0] || null;
    }

    // 附件地址缺失时按 Gitee 规则拼出来
    function assetUrl(item, release, asset) {
        if (asset && asset.browser_download_url) return asset.browser_download_url;
        if (!item || !release || !asset || !asset.name) return '';
        return 'https://gitee.com/' + item.repo + '/releases/download/' +
            encodeURIComponent(release.tag_name) + '/' + encodeURIComponent(asset.name);
    }

    // 把发行版信息写回条目，卡片和详情都用同一份数据
    function applyRelease(item, release) {
        if (!item || !release) return false;
        const asset = pickAsset(release, item);
        if (!asset || !asset.name) return false;

        item.version = release.tag_name;
        item.size = fmtBytes(asset.size);
        item.url = assetUrl(item, release, asset);
        item.fileName = asset.name;
        item.loadFailed = false;
        return true;
    }

    // ===== 列表 =====

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
            cover.appendChild(coverImage(item));
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
        // 挂在卡片上，读到发行版后直接改这段文字
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

    // 卡片上的版本号从 Gitee 实时读取
    function hydrateCard(item, card) {
        loadReleases(item).then(function (releases) {
            const latest = pickLatestRelease(releases);
            if (!applyRelease(item, latest)) {
                item.loadFailed = true;
            }
            if (card.__meta) card.__meta.textContent = cardMetaText(item);
        }).catch(function () {
            item.loadFailed = true;
            if (card.__meta) card.__meta.textContent = cardMetaText(item);
        });
    }

    function renderList() {
        grid.innerHTML = '';
        const visible = items.filter(matches);
        visible.forEach(function (item) {
            const card = buildCard(item);
            grid.appendChild(card);
            hydrateCard(item, card);
        });
        if (emptyTip) emptyTip.hidden = visible.length > 0;
    }

    // ===== 详情 =====

    function renderVersionRows(item, releases) {
        if (!versionsList) return;
        versionsList.innerHTML = '';

        releases.forEach(function (release) {
            const asset = pickAsset(release, item);
            if (!asset) return;

            const row = document.createElement('div');
            row.className = 'store-version';

            const tag = document.createElement('span');
            tag.className = 'store-version__tag';
            tag.textContent = release.tag_name + (release.prerelease ? '（预览）' : '');

            const size = document.createElement('span');
            size.className = 'store-version__size';
            size.textContent = fmtBytes(asset.size) || '正式版';

            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'friend-action store-version__btn';
            action.textContent = '下载';
            action.addEventListener('click', function () {
                startDownload(item, {
                    url: assetUrl(item, release, asset),
                    fileName: asset.name
                });
            });

            row.appendChild(tag);
            row.appendChild(size);
            row.appendChild(action);
            versionsList.appendChild(row);
        });

        return versionsList.children.length;
    }

    function detailMetaText(item) {
        const version = item.version || (item.loadFailed ? '读取版本失败' : '正在读取版本…');
        return kindLabel(item.kind) + ' · ' + (item.author || '匿名') + ' · ' + version;
    }

    function refreshDetailText(item) {
        if (detailMeta) detailMeta.textContent = detailMetaText(item);
        if (detailSize) detailSize.textContent = item.size ? '文件大小：' + item.size : '';
    }

    function openDetail(item) {
        currentItem = item;
        openToken += 1;
        const token = openToken;

        if (msg) msg.textContent = '';
        if (progress) progress.hidden = true;
        if (versionsWrap) versionsWrap.hidden = true;
        if (downloadBtn) downloadBtn.disabled = false;

        if (detailCover) {
            detailCover.dataset.kind = item.kind;
            while (detailCover.firstChild) detailCover.removeChild(detailCover.firstChild);
            if (item.cover) {
                detailCover.classList.add('store-detail__cover--img');
                detailCover.appendChild(coverImage(item));
            } else {
                detailCover.classList.remove('store-detail__cover--img');
                detailCover.textContent = (item.title || '?').slice(0, 1);
            }
        }
        if (detailTitle) detailTitle.textContent = item.title;
        if (detailDesc) detailDesc.textContent = item.description || item.summary || '';
        refreshDetailText(item);

        if (listView) listView.hidden = true;
        if (detailView) detailView.hidden = false;

        // 多版本：直接列出接口返回的所有发行版
        if (item.versionMode === 'all') {
            if (downloadBtn) downloadBtn.hidden = true;
            if (versionsWrap) versionsWrap.hidden = false;
            if (versionsList) versionsList.innerHTML = '';
            if (msg) msg.textContent = '正在读取版本列表…';

            loadReleases(item).then(function (releases) {
                if (token !== openToken) return;
                if (msg) msg.textContent = '';
                const ordered = sortReleasesDesc(releases);
                applyRelease(item, ordered[0]);
                refreshDetailText(item);

                const count = renderVersionRows(item, ordered);
                if (!count && msg) msg.textContent = '暂时没有可下载的版本';
            }).catch(function () {
                if (token !== openToken) return;
                if (msg) msg.textContent = '读取版本失败，请检查网络后重试';
            });
            return;
        }

        // 仅最新版：读最新发行版，拿到版本号、大小和下载地址
        if (downloadBtn) downloadBtn.hidden = false;
        if (downloadBtn) downloadBtn.disabled = true;
        loadReleases(item).then(function (releases) {
            if (token !== openToken) return;
            const latest = pickLatestRelease(releases);
            if (!applyRelease(item, latest)) throw new Error('没有可下载的安装包');
            refreshDetailText(item);
            if (downloadBtn) downloadBtn.disabled = false;
        }).catch(function () {
            if (token !== openToken) return;
            // 读取失败时保持禁用，避免下载到不存在的地址
            item.loadFailed = true;
            refreshDetailText(item);
            if (msg) msg.textContent = '读取最新版本失败，请检查网络后重试';
        });
    }

    function closeDetail() {
        currentItem = null;
        openToken += 1;
        if (progress) progress.hidden = true;
        if (detailView) detailView.hidden = true;
        if (listView) listView.hidden = false;
    }

    // ===== 下载 =====

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

    function startDownload(item, target) {
        if (!item) return;

        const url = (target && target.url) || item.url;
        const fileName = (target && target.fileName) || item.fileName || item.title;
        if (!url) {
            if (msg) msg.textContent = '还没读到下载地址，请稍后再试';
            return;
        }
        if (msg) msg.textContent = '';

        // 桌面端：原生下载，带进度；网页端：直接跳转外链
        if (isDesktop && window.desktopAPI && typeof window.desktopAPI.downloadFile === 'function') {
            downloading = true;
            showProgress(true, 0, 0);
            window.desktopAPI.downloadFile({ url: url, filename: fileName })
                .catch(function (err) {
                    downloading = false;
                    showProgress(false);
                    if (msg) msg.textContent = '下载失败：' + (err && err.message ? err.message : '未知错误');
                });
            return;
        }

        window.location.href = url;
    }

    // ===== 事件绑定 =====

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
        downloadBtn.addEventListener('click', function () {
            if (!currentItem) return;
            startDownload(currentItem, null);
        });
    }

    // 桌面端下载进度
    if (isDesktop && window.desktopAPI) {
        if (typeof window.desktopAPI.onDownloadProgress === 'function') {
            window.desktopAPI.onDownloadProgress(function (data) {
                if (!downloading || !detailView || detailView.hidden) return;
                showProgress(true, data.received || 0, data.total || 0);
            });
        }
        if (typeof window.desktopAPI.onDownloadDone === 'function') {
            window.desktopAPI.onDownloadDone(function (data) {
                if (!downloading) return;
                downloading = false;
                showProgress(true, 1, 1);
                if (msg) msg.textContent = '下载完成：' + (data && data.path ? data.path : '');
            });
        }
        if (typeof window.desktopAPI.onDownloadError === 'function') {
            window.desktopAPI.onDownloadError(function (data) {
                if (!downloading) return;
                downloading = false;
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
