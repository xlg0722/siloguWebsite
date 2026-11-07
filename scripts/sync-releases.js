/**
 * 把 Gitee 上的发行版抓下来，生成 releases.json
 * 由 GitHub Actions 定时执行（见 .github/workflows/sync-releases.yml），
 * 这样商店读取的是静态文件，不受 Gitee 接口限流影响。
 */
const fs = require('fs');
const path = require('path');

// 商店里出现的仓库，新增游戏时在这里加一行
const REPOS = ['silogu/silogu-app', 'silogu/yourworld'];
const API = 'https://gitee.com/api/v5/repos/';

function slimAsset(asset) {
    if (!asset || !asset.name) return null;
    return {
        name: asset.name,
        size: asset.size || 0,
        browser_download_url: asset.browser_download_url || ''
    };
}

function slimRelease(release) {
    if (!release || !release.tag_name) return null;
    return {
        tag_name: release.tag_name,
        prerelease: !!release.prerelease,
        created_at: release.created_at || '',
        assets: (release.assets || []).map(slimAsset).filter(Boolean)
    };
}

async function fetchReleases(repo) {
    const url = API + repo + '/releases?page=1&per_page=20';
    const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'silogu-sync' }
    });
    if (!res.ok) throw new Error(repo + ' HTTP ' + res.status);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error(repo + ' 返回格式不对');
    return list.map(slimRelease).filter(Boolean);
}

(async function main() {
    const output = { updatedAt: new Date().toISOString(), repos: {} };
    const failed = [];

    for (const repo of REPOS) {
        try {
            output.repos[repo] = await fetchReleases(repo);
            console.log(repo + '：' + output.repos[repo].length + ' 个发行版');
        } catch (err) {
            failed.push(repo + '：' + err.message);
            console.error('抓取失败 ' + repo + '：' + err.message);
        }
    }

    // 一个都没抓到就不要写入，避免把好数据覆盖成空
    if (!Object.keys(output.repos).length) {
        console.error('全部仓库都抓取失败，保留原有 releases.json');
        process.exit(1);
    }
    if (failed.length) {
        console.error('部分仓库失败：' + failed.join('；'));
    }

    const file = path.join(__dirname, '..', 'releases.json');
    let previous = null;
    try {
        previous = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        previous = null;
    }
    // 失败仓库沿用上一次的数据
    if (previous && previous.repos) {
        Object.keys(previous.repos).forEach(function (repo) {
            if (!output.repos[repo]) output.repos[repo] = previous.repos[repo];
        });
    }

    fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log('releases.json 已更新');
})();
