/**
 * Supabase 项目配置
 * 这两个值可以放在前端：安全性由数据库的 RLS（行级安全）和存储桶权限决定。
 * 千万不要把 service_role key 写进这里。
 */
window.SUPABASE_CONFIG = {
    url: 'https://hzatkedpdkfmfkopiigi.supabase.co',
    publishableKey: 'sb_publishable_Km5Wu4BwgjXHPXuCApYCMg_Q9TgMAz4',
    // 安装包所在的私有存储桶与文件名（仅在没有 gameUrl 时作为回退）
    bucket: 'yourworld',
    fileName: 'yourworld-v0.1-win64.zip',
    // 你的世界游戏安装包：统一从 Gitee 发行版下载（发新版时改这里的 tag 与文件名）
    gameUrl: 'https://gitee.com/silogu/yourworld/releases/download/beta-v1.0-win64/yourworld-v0.1-win64.zip',
    gameFileName: 'yourworld-v0.1-win64.zip'
};