// 获取元素
const chatContainer = document.getElementById('results');
const inputField = document.getElementById('userInput');
const processButton = document.getElementById('sendButton');
//const resultsDiv = document.getElementById('results');

// 本地AI服务器地址
const AI_SERVER_URL = 'http://localhost:5000/generate';


function addMessage(content, isUser = false, searchResults = null) {
    // 清空消息
    chatContainer.innerHTML = '';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
//    messageDiv.textContent = content;

    if (isUser) {
        messageDiv.textContent = content;
    } else {
        // 展示 AI 响应
        const responseText = document.createElement('div');
        responseText.textContent = content.aiResponse;
        messageDiv.appendChild(responseText);

        // 添加搜索结果链接
        if (content.searchResults && content.searchResults.length > 0) {
            const resultsDiv = document.createElement('div');
            resultsDiv.className = 'search-results';
            resultsDiv.innerHTML = '<p class="search-results-title">相关链接：</p>';

            content.searchResults.forEach(result => {
                const resultDiv = document.createElement('div');
                resultDiv.className = 'search-result-item';

                const link = document.createElement('a');
                link.href = result.link;
                link.textContent = result.title;
                link.target = '_blank';
                link.className = 'search-result-link';

                resultDiv.appendChild(link);
                resultsDiv.appendChild(resultDiv);
            });

            messageDiv.appendChild(resultsDiv);
        }
    }

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = `
        联网搜索中...
        <div class="loading-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}

async function processQuery(query) {
    try {
        let searchResults = []
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage){
            console.log('In extension environment, attempting Chrome API.');
            try {
                // 尝试使用 Chrome 扩展 API 进行搜索
                const searchResponse = await chrome.runtime.sendMessage({
                    type: 'search',
                    query: query
                });

                if (!searchResponse.success) {
                    throw new Error('搜索失败：' + searchResponse.error);
                }

                if (searchResponse && searchResponse.success) {
                    searchResults = searchResponse.results;
                }
            } catch (chromeError) {
                console.error('Chrome API error:', chromeError);
                // 如果 Chrome API 失败，使用备用搜索方法
                searchResults = await fallbackSearch(query);
            }
        } else {
            // 不在扩展环境中，使用备用搜索方法
            console.log('Not in extension environment, using fallback search.');
            searchResults = await fallbackSearch(query);
        }

        const loadingDiv = showLoading();

        // 构建发送给本地 AI 的上下文
        const searchContext = searchResults
            .map(result => `
                标题: ${result.title}
                链接: ${result.link}
                摘要: ${result.snippet}
                来源: ${result.source}
                ---`).join('\n');

        // 发送给本地 AI 服务器的完整查询
//        const aiQuery = {
//            query: query,
//            searchResults: searchContext
//        };

        const aiResponse = await fetch(AI_SERVER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                searchResults: searchContext
            })
        });

//        if (!aiResponse.ok) {
//            throw new Error('AI 服务请求失败');
//        }

        const data = await aiResponse.json();

        // 构建响应，包含 AI 回答和搜索结果链接
        return {
            aiResponse: data.result,
            searchResults: searchResults
        };

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// 备用搜索方法
async function fallbackSearch(query) {
    try {
        // 使用 Bing 搜索作为备用方案
        const response = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
        const html = await response.text();

        // 解析搜索结果
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const results = [];

        // 获取搜索结果元素
        const searchResults = doc.querySelectorAll('.b_algo');
        searchResults.forEach((result, index) => {
            if (index >= 5) return; // 限制结果数量

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
        console.error('Fallback search error:', error);
        return []; // 如果搜索失败，返回空数组
    }
}

sendButton.addEventListener('click', async () => {
    const query = userInput.value.trim();
    if (!query) return;

//    // 显示用户消息
//    addMessage(query, true);

    // 清空输入框并禁用按钮
    userInput.value = '';
    sendButton.disabled = true;

    // 显示加载动画
    const loadingDiv = showLoading();

    try {
        // 调用本地AI服务
        const response = await processQuery(query);

        // 移除加载动画
        loadingDiv.remove();

        // 显示AI响应
        addMessage(response);
    } catch (error) {
        loadingDiv.remove();
        addMessage('抱歉，处理您的请求时出现错误。请稍后重试。');
    } finally {
        sendButton.disabled = false;
    }
});

// 支持按Enter发送消息
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});


//// 获取元素
//const inputField = document.getElementById('user-input');
//const processButton = document.getElementById('search-button');
//const resultsDiv = document.getElementById('results');

//// 绑定按钮点击事件
//processButton.addEventListener('click', async () => {
//  const inputText = inputField.value;
//  if (inputText.trim() === '') {
//    resultsDiv.textContent = '请输入有效内容！';
//    return;
//  }
//
//  // 显示加载状态
//  resultsDiv.textContent = '正在处理中...';
//  processButton.disabled = true;
//
//  try {
//    const response = await fetch('http://localhost:5000/generate', {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//      },
//      body: JSON.stringify({
//        query: inputText
//      })
//    });
//
//    if (!response.ok) {
//      throw new Error(`HTTP error! status: ${response.status}`);
//    }
//
//    const data = await response.json();
//    resultsDiv.textContent = data.result;
//  } catch (error) {
//    console.error('Error:', error);
//    resultsDiv.textContent = '处理请求时出错，请稍后重试！';
//  } finally {
//    processButton.disabled = false;
//  }
//});

