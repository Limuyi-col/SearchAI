// background.js

// 配置信息
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; // 需要替换为你的 Google API Key
const GOOGLE_CSE_ID = 'YOUR_GOOGLE_CSE_ID';   // 需要替换为你的 Custom Search Engine ID
const SEARCH_RESULTS_LIMIT = 5; // 限制搜索结果数量

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'search') {
        handleSearch(request.query).then(sendResponse);
        return true; // 保持消息通道开启，等待异步响应
    }
});

// 主搜索函数
async function handleSearch(query) {
    try {
        // 首先尝试使用 Google API
        const googleResults = await searchWithGoogleAPI(query);
        if (googleResults && googleResults.length > 0) {
            return {
                success: true,
                results: googleResults,
                source: 'google_api'
            };
        }

        // 如果 Google API 失败或无结果，使用备用爬虫方法
        const scrapedResults = await searchWithScraper(query);
        return {
            success: true,
            results: scrapedResults,
            source: 'scraper'
        };

    } catch (error) {
        console.error('Search error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 使用 Google Custom Search API 搜索
async function searchWithGoogleAPI(query) {
    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Google API request failed');
        }

        return data.items?.slice(0, SEARCH_RESULTS_LIMIT).map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: 'Google'
        })) || [];

    } catch (error) {
        console.error('Google API error:', error);
        throw error;
    }
}

// 使用网页爬虫方法搜索（备用方案）
async function searchWithScraper(query) {
    try {
        // 这里使用 Bing 搜索作为示例
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const html = await response.text();

        // 使用简单的正则表达式提取搜索结果
        // 注意：这是一个基础实现，可能需要根据实际情况调整
        const results = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 查找搜索结果元素
        const searchResults = doc.querySelectorAll('.b_algo');
        searchResults.forEach((result, index) => {
            if (index >= SEARCH_RESULTS_LIMIT) return;

            const titleElement = result.querySelector('h2');
            const linkElement = result.querySelector('a');
            const snippetElement = result.querySelector('.b_caption p');

            if (titleElement && linkElement) {
                results.push({
                    title: titleElement.textContent.trim(),
                    link: linkElement.href,
                    snippet: snippetElement ? snippetElement.textContent.trim() : '',
                    source: 'Bing'
                });
            }
        });

        return results;

    } catch (error) {
        console.error('Scraper error:', error);
        throw error;
    }
}

// 辅助函数：清理和验证 URL
function sanitizeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.toString();
    } catch {
        return null;
    }
}

// 缓存管理
const searchCache = new Map();

// 缓存搜索结果
function cacheResults(query, results) {
    searchCache.set(query, {
        results,
        timestamp: Date.now()
    });
}

// 获取缓存的搜索结果
function getCachedResults(query) {
    const cached = searchCache.get(query);
    if (!cached) return null;

    // 缓存有效期为 1 小时
    if (Date.now() - cached.timestamp > 3600000) {
        searchCache.delete(query);
        return null;
    }

    return cached.results;
}

// 清理过期缓存
function cleanupCache() {
    const now = Date.now();
    for (const [query, data] of searchCache.entries()) {
        if (now - data.timestamp > 3600000) {
            searchCache.delete(query);
        }
    }
}

// 定期清理缓存
setInterval(cleanupCache, 3600000); // 每小时清理一次