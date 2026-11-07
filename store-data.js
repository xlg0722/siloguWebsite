/**
 * 商店条目数据（第一阶段只读）
 * 字段说明：
 *   kind         game | app
 *   versionMode  'all' 可下载所有历史版本 | 'latest' 只能下载最新版
 *   repo         Gitee 仓库（owner/repo），用来实时读取发行版
 *   assetKeyword 附件名关键字，用来从发行版里挑出真正的安装包（排除源码包）
 *   versions     versionMode='all' 时的兜底版本列表（接口请求失败时使用）
 *   cover        封面图地址，留空则显示名称首字的渐变封面
 */
window.STORE_ITEMS = [
    {
        id: 'yourworld',
        kind: 'game',
        title: '你的世界',
        summary: '探索、建造，和朋友一起玩的沙盒世界。',
        description: '《你的世界》测试版本，适用于 Windows 64 位。下载后解压运行，遇到问题可以在社区里反馈。',
        author: '小龙果',
        version: 'beta v1.0',
        size: '2.5 MB',
        versionMode: 'all',
        repo: 'silogu/yourworld',
        assetKeyword: 'yourworld',
        url: 'https://gitee.com/silogu/yourworld/releases/download/beta-v1.0-win64/yourworld-v0.1-win64.zip',
        fileName: 'yourworld-v0.1-win64.zip',
        versions: [
            {
                tag: 'beta-v1.0-win64',
                size: '2.5 MB',
                url: 'https://gitee.com/silogu/yourworld/releases/download/beta-v1.0-win64/yourworld-v0.1-win64.zip'
            }
        ],
        cover: ''
    },
    {
        id: 'silogu-app',
        kind: 'app',
        title: '小龙果',
        summary: '桌面客户端：社区、好友、聊天和下载，一个窗口搞定。',
        description: '小龙果桌面应用为便携版，不需要安装。下载后直接双击运行，可在设置页里指定下载目录。',
        author: '小龙果',
        version: 'v1.0.2',
        size: '70.7 MB',
        versionMode: 'latest',
        repo: 'silogu/silogu-app',
        assetKeyword: 'siloguApp',
        url: 'https://gitee.com/silogu/silogu-app/releases/download/v1.0.2/siloguApp.exe',
        fileName: 'siloguApp.exe',
        cover: ''
    }
];