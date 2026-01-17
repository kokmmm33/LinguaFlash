use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub source_text: String,
    pub translated_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存查询请求（发送到前端执行）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheQuery {
    pub text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存批量查询请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCacheQuery {
    pub texts: Vec<String>,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}

// 缓存写入请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheWrite {
    pub source_text: String,
    pub translated_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub engine: String,
}
