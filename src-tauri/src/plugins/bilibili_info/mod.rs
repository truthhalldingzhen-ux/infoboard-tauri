// ─── B站视频信息补充 ───
//
// 通过 B站公开 API 搜索视频标题，获取封面图、UP主名称/头像、BV 号、播放量/弹幕数。
//
// 数据流：
//   1. 调 search API 搜索关键词
//   2. 用第一个结果的 BV 号调 detail API 获取详情
//   3. 标题匹配：精确匹配 > 包含匹配 > 第一个结果
//   4. 不缓存（缓存放前端 `bilibiliCache`，30 分钟 TTL）

use std::time::Duration;
use serde::{Deserialize, Serialize};

// ─── 常量 ───

const SEARCH_API: &str = "https://api.bilibili.com/x/web-interface/search/type/v2";
const DETAIL_API: &str = "https://api.bilibili.com/x/web-interface/view";
const TIMEOUT_SECS: u64 = 10;

// ─── 类型定义 ───

/// B站视频信息（返回给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BilibiliVideoInfo {
    /// 封面图 URL
    pub cover: String,
    /// UP主名称
    pub owner_name: String,
    /// UP主头像 URL
    pub owner_avatar: String,
    /// BV 号
    pub bvid: String,
    /// 播放量
    pub play_count: i64,
    /// 弹幕数
    pub danmaku_count: i64,
}

// ─── 搜索接口响应 ───

#[derive(Debug, Deserialize)]
struct SearchResponse {
    code: i64,
    data: Option<SearchData>,
}

#[derive(Debug, Deserialize)]
struct SearchData {
    result: Option<Vec<SearchResultItem>>,
}

#[derive(Debug, Deserialize)]
struct SearchResultItem {
    bvid: String,
    title: String,
    author: String,
    pic: String,
    play: i64,
    #[serde(rename = "video_review")]
    danmaku: i64,
}

// ─── 详情接口响应 ───

#[derive(Debug, Deserialize)]
struct DetailResponse {
    code: i64,
    data: Option<DetailData>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct DetailData {
    bvid: String,
    title: String,
    pic: String,
    owner: DetailOwner,
    stat: DetailStat,
}

#[derive(Debug, Deserialize)]
struct DetailOwner {
    name: String,
    face: String,
}

#[derive(Debug, Deserialize)]
struct DetailStat {
    view: i64,
    danmaku: i64,
}

// ─── 标题清洗 ───

/// 清洗 B站标题：去分P前缀、去 "—哔哩哔哩" 后缀
fn clean_title(raw: &str) -> String {
    let mut t = raw.to_string();

    // 去除尾部 " —哔哩哔哩" 或 " —bilibili"（含各种变体）
    let suffixes = [
        " —哔哩哔哩",
        " —bilibili",
        " - 哔哩哔哩",
        " - bilibili",
        "—哔哩哔哩",
        "—bilibili",
    ];
    for s in &suffixes {
        if t.ends_with(*s) {
            t.truncate(t.len() - s.len());
            break;
        }
    }

    // 去除头部分P前缀 "(P1. xxx) " 或 "(P1) "
    // 匹配 (P数字. 任意内容) 或 (P数字) 开头的括号内容 + 可能的空格
    let re = regex::Regex::new(r"^\(P\d+(\.\s*[^)]*)?\)\s*").unwrap();
    t = re.replace(&t, "").to_string();

    t.trim().to_string()
}

/// 判断 API 返回的标题是否匹配用户输入的标题
fn is_title_match(api_title: &str, target: &str) -> bool {
    let cleaned = clean_title(api_title);
    // 精确匹配（忽略大小写）
    if cleaned.eq_ignore_ascii_case(target) {
        return true;
    }
    // 包含匹配：一方包含另一方
    if cleaned.to_lowercase().contains(&target.to_lowercase())
        || target.to_lowercase().contains(&cleaned.to_lowercase())
    {
        return true;
    }
    false
}

// ─── HTTP 客户端工具 ───

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))
}

// ─── 搜索 B站视频 ───

async fn search_video(client: &reqwest::Client, keyword: &str) -> Result<Vec<SearchResultItem>, String> {
    let resp = client
        .get(SEARCH_API)
        .query(&[
            ("search_type", "video"),
            ("keyword", keyword),
        ])
        .send()
        .await
        .map_err(|e| format!("B站搜索请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("B站搜索 HTTP {}", resp.status().as_u16()));
    }

    let body: SearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("B站搜索响应解析失败: {e}"))?;

    if body.code != 0 {
        return Err(format!("B站搜索 API 错误 code={}", body.code));
    }

    Ok(body
        .data
        .and_then(|d| d.result)
        .unwrap_or_default())
}

// ─── 获取视频详情 ───

async fn get_video_detail(client: &reqwest::Client, bvid: &str) -> Result<BilibiliVideoInfo, String> {
    let resp = client
        .get(DETAIL_API)
        .query(&[("bvid", bvid)])
        .send()
        .await
        .map_err(|e| format!("B站详情请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("B站详情 HTTP {}", resp.status().as_u16()));
    }

    let body: DetailResponse = resp
        .json()
        .await
        .map_err(|e| format!("B站详情响应解析失败: {e}"))?;

    if body.code != 0 {
        return Err(format!("B站详情 API 错误 code={}", body.code));
    }

    let data = body.data.ok_or("B站详情无 data 字段")?;

    Ok(BilibiliVideoInfo {
        cover: data.pic,
        owner_name: data.owner.name,
        owner_avatar: data.owner.face,
        bvid: data.bvid,
        play_count: data.stat.view,
        danmaku_count: data.stat.danmaku,
    })
}

// ─── Tauri Command ───

/// 通过 B站公开 API 补充视频信息
///
/// 步骤：
///   1. 搜索视频标题
///   2. 匹配最佳结果（精确匹配 > 包含匹配 > 第一个结果）
///   3. 获取详情（封面、UP主、播放量等）
///
/// 网络错误或无匹配时返回 `None`（不抛错）
#[tauri::command]
pub async fn bilibili_enrich_media(title: String) -> Option<BilibiliVideoInfo> {
    let client = match build_client() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[bilibili_enrich_media] 客户端创建失败: {e}");
            return None;
        }
    };

    // Step 1: 搜索
    let results = match search_video(&client, &title).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[bilibili_enrich_media] 搜索失败: {e}");
            return None;
        }
    };

    if results.is_empty() {
        return None;
    }

    // Step 2: 匹配最佳结果
    let matched = results
        .iter()
        .find(|item| is_title_match(&item.title, &title));

    let best = match matched {
        Some(item) => item,
        None => &results[0], // 兜底：第一个结果
    };

    // Step 3: 获取详情
    match get_video_detail(&client, &best.bvid).await {
        Ok(info) => Some(info),
        Err(e) => {
            eprintln!("[bilibili_enrich_media] 获取详情失败: {e}");
            // 搜索有结果但详情失败时，用搜索结果构造简易信息
            Some(BilibiliVideoInfo {
                cover: best.pic.clone(),
                owner_name: best.author.clone(),
                owner_avatar: String::new(),
                bvid: best.bvid.clone(),
                play_count: best.play,
                danmaku_count: best.danmaku,
            })
        }
    }
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_title_remove_suffix() {
        assert_eq!(
            clean_title("【4K】赛博朋克2077 全剧情电影 —哔哩哔哩"),
            "【4K】赛博朋克2077 全剧情电影"
        );
    }

    #[test]
    fn test_clean_title_remove_prefix_and_suffix() {
        assert_eq!(
            clean_title("(P1. 开场) 【4K】赛博朋克2077 全剧情电影 —哔哩哔哩"),
            "【4K】赛博朋克2077 全剧情电影"
        );
    }

    #[test]
    fn test_clean_title_remove_numeric_prefix() {
        assert_eq!(
            clean_title("(P2) 第二集 —bilibili"),
            "第二集"
        );
    }

    #[test]
    fn test_clean_title_no_cleaning_needed() {
        assert_eq!(
            clean_title("【4K】赛博朋克2077 全剧情电影"),
            "【4K】赛博朋克2077 全剧情电影"
        );
    }

    #[test]
    fn test_clean_title_bilibili_variant() {
        assert_eq!(
            clean_title("测试视频 - bilibili"),
            "测试视频"
        );
    }

    #[test]
    fn test_is_title_match_exact() {
        assert!(is_title_match("测试视频", "测试视频"));
    }

    #[test]
    fn test_is_title_match_with_suffix() {
        assert!(is_title_match("测试视频 —哔哩哔哩", "测试视频"));
    }

    #[test]
    fn test_is_title_match_contains() {
        assert!(is_title_match("【4K】赛博朋克2077 全剧情电影", "赛博朋克2077"));
    }

    #[test]
    fn test_is_title_match_no_match() {
        assert!(!is_title_match("完全不同的内容", "赛博朋克2077"));
    }
}
