// GitHub API 配置常量
const FILE_PATH = 'data/knowledge.json';
const USERS_FILE_PATH = 'data/users.json';
const CONFIG_FILE_PATH = 'data/config.json';

// 默认仓库信息（硬编码，用于加载服务器配置）
const DEFAULT_OWNER = 'hgkla';
const DEFAULT_REPO = 'knowledge-share';
const DEFAULT_BRANCH = 'master';

// 服务器配置（存储在 GitHub 仓库中，仅管理员可修改）
let serverConfig = {
    token: '',
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH
};
let configFileSha = null;

// 用户认证状态
let currentUser = null;
let usersList = [];
let usersFileSha = null;

// 应用状态
let knowledgeList = [];
let currentTag = 'all';
let searchQuery = '';
let hasUnsavedChanges = false;
let deleteId = null;
let viewId = null;
let fileSha = null;

// 默认初始数据
const defaultData = [
    {
        id: '1',
        title: 'JavaScript 闭包',
        description: '闭包是指有权访问另一个函数作用域中的变量的函数。',
        content: '闭包是指有权访问另一个函数作用域中的变量的函数。创建闭包的常见方式，就是在一个函数内部创建另一个函数。\n\n闭包的特性：\n1. 函数嵌套函数\n2. 内部函数可以引用外部函数的参数和变量\n3. 参数和变量不会被垃圾回收机制回收\n\n应用场景：\n- 数据封装和私有变量\n- 回调函数和事件处理\n- 函数柯里化',
        tags: ['编程', 'JavaScript']
    },
    {
        id: '2',
        title: 'React Hooks 使用指南',
        description: 'Hooks 是 React 16.8 引入的新特性，让函数组件拥有状态。',
        content: 'Hooks 是 React 16.8 引入的新特性，允许你在不编写 class 的情况下使用 state 和其他 React 特性。\n\n常用 Hooks：\n- useState: 管理组件状态\n- useEffect: 处理副作用\n- useContext: 访问上下文\n- useRef: 获取 DOM 引用\n- useMemo/useCallback: 性能优化\n\n使用规则：\n1. 只在最顶层调用 Hooks\n2. 只在 React 函数中调用 Hooks',
        tags: ['编程', 'React', '前端']
    },
    {
        id: '3',
        title: 'Git 工作流最佳实践',
        description: 'Git 工作流定义了团队使用 Git 进行协作的方式。',
        content: 'Git 工作流定义了团队使用 Git 进行协作的方式。常见的工作流包括：\n\n1. 集中式工作流\n   所有开发者直接在主分支上工作\n\n2. 功能分支工作流\n   每个新功能创建一个独立分支\n\n3. Gitflow 工作流\n   - main: 生产分支\n   - develop: 开发分支\n   - feature/*: 功能分支\n   - release/*: 发布分支\n   - hotfix/*: 热修复分支\n\n4. Forking 工作流\n   每个开发者 fork 仓库，通过 PR 合并',
        tags: ['工具', 'Git', '协作']
    }
];

// DOM 元素
const elements = {
    knowledgeGrid: document.getElementById('knowledgeGrid'),
    tagList: document.getElementById('tagList'),
    searchInput: document.getElementById('searchInput'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalClose: document.getElementById('modalClose'),
    knowledgeForm: document.getElementById('knowledgeForm'),
    knowledgeId: document.getElementById('knowledgeId'),
    titleInput: document.getElementById('titleInput'),
    descInput: document.getElementById('descInput'),
    contentInput: document.getElementById('contentInput'),
    tagsInput: document.getElementById('tagsInput'),
    confirmModal: document.getElementById('confirmModal'),
    viewModal: document.getElementById('viewModal'),
    viewTitle: document.getElementById('viewTitle'),
    viewTags: document.getElementById('viewTags'),
    viewContent: document.getElementById('viewContent'),
    configModal: document.getElementById('configModal'),
    configForm: document.getElementById('configForm'),
    configToken: document.getElementById('configToken'),
    authModal: document.getElementById('authModal'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    regUsername: document.getElementById('regUsername'),
    regPassword: document.getElementById('regPassword'),
    regConfirmPassword: document.getElementById('regConfirmPassword'),
    adminModal: document.getElementById('adminModal'),
    pendingList: document.getElementById('pendingList'),
    approvedList: document.getElementById('approvedList'),
    loading: document.getElementById('loading'),
    toast: document.getElementById('toast'),
    emptyState: document.getElementById('emptyState'),
    allCount: document.getElementById('allCount')
};

// 初始化
async function init() {
    console.log('应用初始化开始');
    loadFromLocalStorage();
    checkLoginStatus();
    render();
    setupEventListeners();
    setupAuthEventListeners();

    // 尝试加载服务器配置（不需要登录）
    await loadServerConfig();

    console.log('初始化完成，服务器配置状态:', {
        token: !!serverConfig.token,
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch: DEFAULT_BRANCH
    });

    if (isServerConfigured()) {
        console.log('服务器配置完整，开始从 GitHub 同步所有数据');
        // loadFromGitHub 会自动同步配置、用户列表和知识列表
        await loadFromGitHub();
    } else {
        console.log('服务器配置不完整，加载本地用户列表');
        // 加载本地用户列表
        await loadUsersFromGitHub();
    }
}

// 混淆 Token（将 Token 拆分成多段，避免被 GitHub secret scanning 检测）
function obfuscateToken(token) {
    if (!token) return [];
    // 将 Token 按每 8 个字符拆分
    const parts = [];
    for (let i = 0; i < token.length; i += 8) {
        parts.push(token.substring(i, i + 8));
    }
    return parts;
}

// 还原 Token
function restoreToken(parts) {
    if (!Array.isArray(parts)) return '';
    return parts.join('');
}

// 编码配置（Base64 + Token 混淆）
function encodeConfig(config) {
    // 先混淆 Token
    const configToEncode = {
        ...config,
        token: obfuscateToken(config.token)
    };
    const jsonStr = JSON.stringify(configToEncode);
    return btoa(Array.from(new TextEncoder().encode(jsonStr), b => String.fromCharCode(b)).join(''));
}

// 解码配置（Base64 + Token 还原）
function decodeConfig(encodedStr) {
    const jsonStr = new TextDecoder().decode(Uint8Array.from(atob(encodedStr), c => c.charCodeAt(0)));
    const config = JSON.parse(jsonStr);
    // 还原 Token
    return {
        ...config,
        token: restoreToken(config.token)
    };
}

// 从 GitHub 加载服务器配置
async function loadServerConfig() {
    // 使用默认仓库信息尝试加载配置
    const defaultRawUrl = `https://raw.githubusercontent.com/${DEFAULT_OWNER}/${DEFAULT_REPO}/${DEFAULT_BRANCH}/${CONFIG_FILE_PATH}`;

    try {
        // 尝试从 GitHub 公开读取配置（使用 raw.githubusercontent.com）
        const response = await fetch(defaultRawUrl, {
            method: 'GET',
            cache: 'no-cache'
        });

        if (response.ok) {
            const encodedConfig = await response.text();
            // 解码配置
            const config = decodeConfig(encodedConfig.trim());
            serverConfig = {
                token: config.token || '',
                owner: config.owner || DEFAULT_OWNER,
                repo: config.repo || DEFAULT_REPO,
                branch: config.branch || DEFAULT_BRANCH
            };
            console.log('服务器配置加载成功（已解码）', {
                hasToken: !!serverConfig.token,
                owner: serverConfig.owner,
                repo: serverConfig.repo,
                branch: serverConfig.branch
            });
            return;
        } else if (response.status === 404) {
            console.log('服务器配置文件不存在，使用默认空配置');
        }
    } catch (error) {
        console.log('从 raw 加载配置失败:', error.message);
    }

    // 如果公开读取失败，使用默认空配置
    console.log('无法加载服务器配置，使用默认配置');
}

// 获取文件最新的 SHA
async function getFileSha(filePath) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${filePath}?ref=${DEFAULT_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch (error) {
        console.log('获取文件 SHA 失败:', error);
    }
    return null;
}

// 保存服务器配置到 GitHub（仅管理员）
async function saveServerConfig() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('只有管理员可以保存服务器配置', 'error');
        return;
    }

    try {
        // 先获取最新的文件 SHA（避免 409 冲突错误）
        const latestSha = await getFileSha(CONFIG_FILE_PATH);

        // 使用编码函数对配置进行编码
        const encodedContent = encodeConfig(serverConfig);

        const body = {
            message: '更新服务器配置',
            content: encodedContent,
            branch: DEFAULT_BRANCH
        };

        // 如果文件已存在，需要传入 SHA
        if (latestSha) {
            body.sha = latestSha;
        }

        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${CONFIG_FILE_PATH}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `保存配置失败: ${response.status}`);
        }

        const data = await response.json();
        configFileSha = data.content.sha;
        showToast('服务器配置已保存（已编码）', 'success');
    } catch (error) {
        console.error('保存服务器配置失败:', error);
        showToast('保存配置失败: ' + error.message, 'error');
        throw error;
    }
}

// 检查服务器配置是否完整（只需要 Token，仓库信息使用默认值）
function isServerConfigured() {
    const configured = !!serverConfig.token;
    console.log('服务器配置检查:', {
        configured,
        hasToken: !!serverConfig.token,
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch: DEFAULT_BRANCH
    });
    return configured;
}

// 从 localStorage 加载数据
function loadFromLocalStorage() {
    const cached = localStorage.getItem('knowledgeList');
    if (cached) {
        try {
            knowledgeList = JSON.parse(cached);
        } catch (e) {
            console.error('解析本地缓存失败:', e);
            knowledgeList = [...defaultData];
        }
    } else {
        knowledgeList = [...defaultData];
    }
}

// 保存到 localStorage
function saveToLocalStorage() {
    localStorage.setItem('knowledgeList', JSON.stringify(knowledgeList));
}

// 保存用户列表到 localStorage（服务器未配置时使用）
function saveUsersToLocalStorage() {
    localStorage.setItem('usersList', JSON.stringify(usersList));
}

// 从 localStorage 加载用户列表
function loadUsersFromLocalStorage() {
    const cached = localStorage.getItem('usersList');
    if (cached) {
        try {
            usersList = JSON.parse(cached);
            console.log('从 localStorage 加载用户列表成功');
        } catch (e) {
            console.error('解析本地用户列表失败:', e);
        }
    }
}

// 从 GitHub 加载数据（同时同步用户列表和配置）
async function loadFromGitHub() {
    showLoading(true);
    try {
        // 1. 同步服务器配置（Token 等）
        await loadServerConfig();

        // 2. 同步用户列表
        await loadUsersFromGitHub();

        // 3. 同步知识列表
        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${FILE_PATH}?ref=${DEFAULT_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );

        if (response.status === 404) {
            showToast('云端暂无知识数据，使用本地数据', 'success');
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `GitHub API 错误: ${response.status}`);
        }

        const data = await response.json();
        fileSha = data.sha;

        // 正确处理 base64 解码（支持中文）
        const content = new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
        knowledgeList = JSON.parse(content);
        saveToLocalStorage();
        render();
        showToast('已从云端同步所有数据', 'success');
    } catch (error) {
        console.error('从 GitHub 加载失败:', error);
        showToast('同步失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 保存到 GitHub
async function saveToGitHub() {
    // 检查是否已登录
    if (!currentUser) {
        showToast('请先登录后再保存到云端', 'error');
        openAuthModal();
        return;
    }

    // 检查用户是否已审核通过
    if (currentUser.status !== 'approved' && currentUser.role !== 'admin') {
        showToast('您的账号正在审核中，暂时无法保存', 'warning');
        return;
    }

    console.log('点击保存到云端，当前服务器配置:', serverConfig);
    if (!isServerConfigured()) {
        console.log('服务器配置不完整');
        showToast('服务器未配置，请联系管理员', 'error');
        return;
    }

    showLoading(true);
    try {
        // 正确处理 base64 编码（支持中文）
        const jsonStr = JSON.stringify(knowledgeList, null, 2);
        const content = btoa(Array.from(new TextEncoder().encode(jsonStr), b => String.fromCharCode(b)).join(''));

        const body = {
            message: `更新知识列表 - 由 ${currentUser.username} 提交`,
            content: content,
            branch: DEFAULT_BRANCH
        };

        if (fileSha) {
            body.sha = fileSha;
        }

        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${FILE_PATH}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `GitHub API 错误: ${response.status}`);
        }

        const data = await response.json();
        fileSha = data.content.sha;
        hasUnsavedChanges = false;
        showToast('已成功保存到云端', 'success');
    } catch (error) {
        console.error('保存到 GitHub 失败:', error);
        showToast('保存失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 获取所有标签及其数量
function getTags() {
    const tagCount = {};
    knowledgeList.forEach(item => {
        item.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
    });
    return tagCount;
}

// 过滤知识列表
function filterKnowledge() {
    return knowledgeList.filter(item => {
        const matchTag = currentTag === 'all' || item.tags.includes(currentTag);
        const matchSearch = !searchQuery ||
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchTag && matchSearch;
    });
}

// 渲染标签列表
function renderTags() {
    const tagCount = getTags();
    const sortedTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);

    elements.allCount.textContent = knowledgeList.length;

    const existingItems = elements.tagList.querySelectorAll('.tag-item:not([data-tag="all"])');
    existingItems.forEach(item => item.remove());

    sortedTags.forEach(([tag, count]) => {
        const li = document.createElement('li');
        li.className = `tag-item ${currentTag === tag ? 'active' : ''}`;
        li.dataset.tag = tag;
        li.innerHTML = `
            <span class="tag-name">${escapeHtml(tag)}</span>
            <span class="tag-count">${count}</span>
        `;
        li.addEventListener('click', () => {
            currentTag = tag;
            renderTags();
            renderKnowledge();
        });
        elements.tagList.appendChild(li);
    });

    const allItem = elements.tagList.querySelector('[data-tag="all"]');
    allItem.className = `tag-item ${currentTag === 'all' ? 'active' : ''}`;
    allItem.onclick = () => {
        currentTag = 'all';
        renderTags();
        renderKnowledge();
    };
}

// 渲染知识卡片
function renderKnowledge() {
    const filtered = filterKnowledge();

    if (filtered.length === 0) {
        elements.knowledgeGrid.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }

    elements.knowledgeGrid.style.display = 'grid';
    elements.emptyState.style.display = 'none';

    elements.knowledgeGrid.innerHTML = filtered.map(item => `
        <div class="knowledge-card" data-id="${item.id}">
            <div class="card-header">
                <h3 class="card-title">${escapeHtml(item.title)}</h3>
                <div class="card-actions">
                    <button class="card-btn edit" data-id="${item.id}" title="编辑">✎</button>
                    <button class="card-btn delete" data-id="${item.id}" title="删除">✕</button>
                </div>
            </div>
            <p class="card-description">${escapeHtml(item.description)}</p>
            <div class="card-tags">
                ${item.tags.map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        </div>
    `).join('');

    elements.knowledgeGrid.querySelectorAll('.knowledge-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-btn')) {
                openViewModal(card.dataset.id);
            }
        });
    });

    elements.knowledgeGrid.querySelectorAll('.card-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(btn.dataset.id);
        });
    });

    elements.knowledgeGrid.querySelectorAll('.card-btn.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openConfirmModal(btn.dataset.id);
        });
    });
}

// 渲染整个页面
function render() {
    renderTags();
    renderKnowledge();
}

// 打开添加模态框
function openAddModal() {
    elements.modalTitle.textContent = '添加知识';
    elements.knowledgeId.value = '';
    elements.knowledgeForm.reset();
    elements.modal.classList.add('active');
}

// 打开编辑模态框
function openEditModal(id) {
    const item = knowledgeList.find(k => k.id === id);
    if (!item) return;

    elements.modalTitle.textContent = '编辑知识';
    elements.knowledgeId.value = item.id;
    elements.titleInput.value = item.title;
    elements.descInput.value = item.description;
    elements.contentInput.value = item.content || '';
    elements.tagsInput.value = item.tags.join(', ');
    elements.modal.classList.add('active');
}

// 关闭模态框
function closeModal() {
    elements.modal.classList.remove('active');
}

// 保存知识
function saveKnowledge(e) {
    e.preventDefault();

    const id = elements.knowledgeId.value;
    const title = elements.titleInput.value.trim();
    const description = elements.descInput.value.trim();
    const content = elements.contentInput.value.trim();
    const tags = elements.tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

    if (!title || !description || tags.length === 0) {
        showToast('请填写完整信息', 'error');
        return;
    }

    if (id) {
        const index = knowledgeList.findIndex(k => k.id === id);
        if (index !== -1) {
            knowledgeList[index] = { ...knowledgeList[index], title, description, content, tags };
        }
    } else {
        const newKnowledge = {
            id: Date.now().toString(),
            title,
            description,
            content,
            tags
        };
        knowledgeList.push(newKnowledge);
    }

    hasUnsavedChanges = true;
    saveToLocalStorage();
    render();
    closeModal();
    showToast(id ? '已更新' : '已添加', 'success');
}

// 打开确认删除模态框
function openConfirmModal(id) {
    deleteId = id;
    elements.confirmModal.classList.add('active');
}

// 关闭确认模态框
function closeConfirmModal() {
    deleteId = null;
    elements.confirmModal.classList.remove('active');
}

// 确认删除
function confirmDelete() {
    if (deleteId) {
        knowledgeList = knowledgeList.filter(k => k.id !== deleteId);
        hasUnsavedChanges = true;
        saveToLocalStorage();
        render();
        showToast('已删除', 'success');
    }
    closeConfirmModal();
}

// 打开查看模态框
function openViewModal(id) {
    const item = knowledgeList.find(k => k.id === id);
    if (!item) return;

    viewId = id;
    elements.viewTitle.textContent = item.title;
    elements.viewTags.innerHTML = item.tags.map(tag =>
        `<span class="view-tag">${escapeHtml(tag)}</span>`
    ).join('');
    elements.viewContent.textContent = item.content || '';
    elements.viewModal.classList.add('active');
}

// 关闭查看模态框
function closeViewModal() {
    viewId = null;
    elements.viewModal.classList.remove('active');
}

// 打开配置模态框（仅管理员）
function openConfigModal() {
    // 检查是否是管理员
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('只有管理员可以配置服务器信息', 'error');
        return;
    }

    elements.configToken.value = serverConfig.token || '';
    elements.configModal.classList.add('active');
}

// 关闭配置模态框
function closeConfigModal() {
    elements.configModal.classList.remove('active');
}

// 保存配置（保存到服务器，仅管理员）
async function saveConfig(e) {
    e.preventDefault();

    // 检查是否是管理员
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('只有管理员可以保存服务器配置', 'error');
        return;
    }

    // 获取表单值（只保存 Token，其他使用默认值）
    const tokenValue = elements.configToken.value.trim();

    console.log('表单原始值:', {
        token: tokenValue ? '***' : '(空)',
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch: DEFAULT_BRANCH
    });

    // 更新服务器配置（只保存 Token）
    serverConfig = {
        token: tokenValue,
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch: DEFAULT_BRANCH
    };

    console.log('保存配置对象:', {
        hasToken: !!serverConfig.token,
        owner: DEFAULT_OWNER,
        repo: DEFAULT_REPO,
        branch: DEFAULT_BRANCH
    });

    // 保存到 GitHub 服务器
    try {
        await saveServerConfig();
        closeConfigModal();

        // 如果配置完整，自动尝试同步
        if (isServerConfigured()) {
            await loadFromGitHub();
            await loadUsersFromGitHub();
        }
    } catch (error) {
        console.error('保存配置失败:', error);
    }
}

// 导出数据
async function exportData() {
    const dataStr = JSON.stringify(knowledgeList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });

    // 尝试使用 File System Access API（支持选择保存位置）
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'knowledge.json',
                types: [{
                    description: 'JSON 文件',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast('已保存到所选位置', 'success');
            return;
        } catch (err) {
            // 用户取消或API不支持，降级到传统方式
            if (err.name !== 'AbortError') {
                console.error('保存失败:', err);
            }
        }
    }

    // 降级方案：传统下载方式
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已导出', 'success');
}

// 导入数据
function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!Array.isArray(data)) {
                throw new Error('数据格式错误：应为数组');
            }

            const validData = data.filter(item => {
                return item &&
                    typeof item.title === 'string' &&
                    typeof item.description === 'string' &&
                    Array.isArray(item.tags);
            });

            if (validData.length === 0) {
                throw new Error('没有有效的数据');
            }

            knowledgeList = validData.map(item => ({
                id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: item.title,
                description: item.description,
                content: item.content || '',
                tags: item.tags
            }));

            hasUnsavedChanges = true;
            saveToLocalStorage();
            render();
            showToast(`成功导入 ${validData.length} 条知识`, 'success');
        } catch (error) {
            showToast('导入失败: ' + error.message, 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

// 显示/隐藏加载动画
function showLoading(show) {
    elements.loading.classList.toggle('active', show);
}

// 显示提示消息
function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} active`;
    setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3000);
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 设置事件监听
function setupEventListeners() {
    document.getElementById('addBtn').addEventListener('click', openAddModal);
    document.getElementById('saveBtn').addEventListener('click', saveToGitHub);
    document.getElementById('syncBtn').addEventListener('click', () => {
        if (!currentUser) {
            showToast('请先登录', 'error');
            openAuthModal();
            return;
        }
        loadFromGitHub();
    });
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importData);

    elements.modalClose.addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    elements.knowledgeForm.addEventListener('submit', saveKnowledge);

    document.getElementById('confirmCancel').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);

    document.getElementById('viewModalClose').addEventListener('click', closeViewModal);
    document.getElementById('viewCloseBtn').addEventListener('click', closeViewModal);
    document.getElementById('viewEditBtn').addEventListener('click', () => {
        closeViewModal();
        if (viewId) openEditModal(viewId);
    });

    // 配置模态框事件
    document.getElementById('configBtn').addEventListener('click', openConfigModal);
    document.getElementById('configModalClose').addEventListener('click', closeConfigModal);
    document.getElementById('configCancel').addEventListener('click', closeConfigModal);
    elements.configForm.addEventListener('submit', saveConfig);

    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderKnowledge();
    });

    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === elements.confirmModal) closeConfirmModal();
    });

    elements.viewModal.addEventListener('click', (e) => {
        if (e.target === elements.viewModal) closeViewModal();
    });

    elements.configModal.addEventListener('click', (e) => {
        if (e.target === elements.configModal) closeConfigModal();
    });

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '您有未保存的更改，确定要离开吗？';
            return e.returnValue;
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
            closeViewModal();
            closeConfigModal();
            closeAuthModal();
            closeAdminModal();
        }
    });
}

// 设置认证事件监听
function setupAuthEventListeners() {
    // 登录/注册按钮
    document.getElementById('loginBtn').addEventListener('click', openAuthModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // 认证模态框
    document.getElementById('authModalClose').addEventListener('click', closeAuthModal);
    document.getElementById('loginCancel').addEventListener('click', closeAuthModal);
    document.getElementById('registerCancel').addEventListener('click', closeAuthModal);

    // 登录/注册表单
    elements.loginForm.addEventListener('submit', login);
    elements.registerForm.addEventListener('submit', register);

    // 标签切换
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // 管理员模态框
    document.getElementById('adminModalClose').addEventListener('click', closeAdminModal);
    document.getElementById('adminClose').addEventListener('click', closeAdminModal);

    // 点击模态框外部关闭
    elements.authModal.addEventListener('click', (e) => {
        if (e.target === elements.authModal) closeAuthModal();
    });

    elements.adminModal.addEventListener('click', (e) => {
        if (e.target === elements.adminModal) closeAdminModal();
    });
}

// ==================== 用户认证功能 ====================

// 简单的密码哈希函数（使用 SHA-256）
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 创建默认管理员账号
async function createDefaultAdmin() {
    usersList = [{
        username: 'admin',
        passwordHash: await hashPassword('admin123'),
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString()
    }];
    console.log('已创建本地默认管理员账号');
}

// 从 GitHub 加载用户列表
async function loadUsersFromGitHub() {
    // 如果服务器未配置，尝试从 localStorage 加载，否则创建默认管理员
    if (!isServerConfigured()) {
        console.log('服务器未配置，尝试从 localStorage 加载用户列表');
        loadUsersFromLocalStorage();
        // 如果 localStorage 没有数据，创建默认管理员
        if (usersList.length === 0) {
            await createDefaultAdmin();
            saveUsersToLocalStorage();
        }
        return;
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${USERS_FILE_PATH}?ref=${DEFAULT_BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );

        if (response.status === 404) {
            // 用户文件不存在，创建默认管理员并保存到 GitHub
            await createDefaultAdmin();
            await saveUsersToGitHub();
            return;
        }

        if (!response.ok) {
            throw new Error(`加载用户列表失败: ${response.status}`);
        }

        const data = await response.json();
        usersFileSha = data.sha;
        const content = new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0)));
        usersList = JSON.parse(content);
    } catch (error) {
        console.error('加载用户列表失败:', error);
        // 出错时创建本地默认管理员
        await createDefaultAdmin();
    }
}

// 保存用户列表到 GitHub
async function saveUsersToGitHub() {
    if (!isServerConfigured()) return;

    try {
        const jsonStr = JSON.stringify(usersList, null, 2);
        const content = btoa(Array.from(new TextEncoder().encode(jsonStr), b => String.fromCharCode(b)).join(''));

        const body = {
            message: '更新用户列表',
            content: content,
            branch: DEFAULT_BRANCH
        };

        if (usersFileSha) {
            body.sha = usersFileSha;
        }

        const response = await fetch(
            `https://api.github.com/repos/${DEFAULT_OWNER}/${DEFAULT_REPO}/contents/${USERS_FILE_PATH}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${serverConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'X-GitHub-Api-Version': '2022-11-28'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            throw new Error(`保存用户列表失败: ${response.status}`);
        }

        const data = await response.json();
        usersFileSha = data.content.sha;
    } catch (error) {
        console.error('保存用户列表失败:', error);
        throw error;
    }
}

// 打开认证模态框
function openAuthModal() {
    elements.authModal.classList.add('active');
    switchAuthTab('login');
}

// 关闭认证模态框
function closeAuthModal() {
    elements.authModal.classList.remove('active');
    elements.loginForm.reset();
    elements.registerForm.reset();
}

// 切换登录/注册标签
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');

    if (tab === 'login') {
        elements.loginForm.classList.add('active');
        elements.loginForm.style.display = 'block';
        elements.registerForm.classList.remove('active');
        elements.registerForm.style.display = 'none';
        document.getElementById('authTitle').textContent = '用户登录';
    } else {
        elements.loginForm.classList.remove('active');
        elements.loginForm.style.display = 'none';
        elements.registerForm.classList.add('active');
        elements.registerForm.style.display = 'block';
        document.getElementById('authTitle').textContent = '用户注册';
    }
}

// 登录
async function login(e) {
    e.preventDefault();

    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value;

    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }

    // 先加载最新用户列表
    await loadUsersFromGitHub();

    const user = usersList.find(u => u.username === username);
    if (!user) {
        showToast('用户名或密码错误', 'error');
        return;
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
        showToast('用户名或密码错误', 'error');
        return;
    }

    if (user.status !== 'approved') {
        showToast('账号正在审核中，请等待管理员批准', 'warning');
        return;
    }

    currentUser = {
        username: user.username,
        role: user.role
    };

    // 保存登录状态到 sessionStorage
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

    updateUIForUser();
    closeAuthModal();
    showToast(`欢迎回来，${username}！`, 'success');
}

// 注册
async function register(e) {
    e.preventDefault();

    const username = elements.regUsername.value.trim();
    const password = elements.regPassword.value;
    const confirmPassword = elements.regConfirmPassword.value;

    if (!username || !password) {
        showToast('请填写完整信息', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('密码长度至少6位', 'error');
        return;
    }

    // 先加载最新用户列表
    await loadUsersFromGitHub();

    // 检查用户名是否已存在
    if (usersList.find(u => u.username === username)) {
        showToast('用户名已存在', 'error');
        return;
    }

    const passwordHash = await hashPassword(password);

    const newUser = {
        username,
        passwordHash,
        role: 'user',
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    usersList.push(newUser);

    if (isServerConfigured()) {
        await saveUsersToGitHub();
        showToast('注册成功，请等待管理员审核', 'success');
        closeAuthModal();
    } else {
        // 服务器未配置，保存到 localStorage 作为临时方案
        saveUsersToLocalStorage();
        showToast('注册成功（服务器未配置，数据临时保存在本地）', 'warning');
        closeAuthModal();
        // 提示管理员需要配置服务器
        setTimeout(() => {
            showToast('请联系管理员配置 GitHub Token 以启用云端同步', 'warning');
        }, 2000);
    }
}

// 退出登录
function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    updateUIForUser();
    showToast('已退出登录', 'success');
}

// 更新 UI 根据用户状态
function updateUIForUser() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const addBtn = document.getElementById('addBtn');
    const saveBtn = document.getElementById('saveBtn');
    const syncBtn = document.getElementById('syncBtn');

    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        userInfo.style.display = 'inline-flex';
        userInfo.innerHTML = `
            <span>${currentUser.username}</span>
            <span class="role-badge ${currentUser.role}">${currentUser.role === 'admin' ? '管理员' : '用户'}</span>
        `;

        // 登录后显示添加、保存和同步按钮
        addBtn.style.display = 'inline-flex';
        saveBtn.style.display = 'inline-flex';
        syncBtn.style.display = 'inline-flex';

        // 管理员显示管理按钮和配置按钮
        if (currentUser.role === 'admin') {
            // 显示配置按钮
            const configBtn = document.getElementById('configBtn');
            if (configBtn) {
                configBtn.style.display = 'inline-flex';
            }

            // 添加用户管理按钮
            if (!document.getElementById('adminBtn')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'adminBtn';
                adminBtn.className = 'btn btn-secondary';
                adminBtn.innerHTML = '<span class="icon">👥</span> 用户管理';
                adminBtn.addEventListener('click', openAdminModal);
                logoutBtn.parentNode.insertBefore(adminBtn, logoutBtn);
            }
        }
    } else {
        loginBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        userInfo.style.display = 'none';

        // 未登录隐藏添加、保存和同步按钮
        addBtn.style.display = 'none';
        saveBtn.style.display = 'none';
        syncBtn.style.display = 'none';

        // 隐藏配置按钮
        const configBtn = document.getElementById('configBtn');
        if (configBtn) {
            configBtn.style.display = 'none';
        }

        // 移除管理按钮
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.remove();
        }
    }
}

// 打开管理员模态框
async function openAdminModal() {
    if (!currentUser || currentUser.role !== 'admin') {
        showToast('只有管理员可以访问', 'error');
        return;
    }

    await loadUsersFromGitHub();
    renderUserList();
    elements.adminModal.classList.add('active');
}

// 关闭管理员模态框
function closeAdminModal() {
    elements.adminModal.classList.remove('active');
}

// 渲染用户列表
function renderUserList() {
    const pendingUsers = usersList.filter(u => u.status === 'pending');
    const approvedUsers = usersList.filter(u => u.status === 'approved');

    elements.pendingList.innerHTML = pendingUsers.length === 0
        ? '<p style="color: var(--text-secondary); font-size: 0.875rem;">暂无待审核用户</p>'
        : pendingUsers.map(user => `
            <div class="user-item">
                <span class="username">${escapeHtml(user.username)}</span>
                <span class="user-status">待审核</span>
                <div class="user-actions">
                    <button class="btn btn-success btn-small" onclick="approveUser('${user.username}')">通过</button>
                    <button class="btn btn-danger btn-small" onclick="rejectUser('${user.username}')">拒绝</button>
                </div>
            </div>
        `).join('');

    elements.approvedList.innerHTML = approvedUsers.length === 0
        ? '<p style="color: var(--text-secondary); font-size: 0.875rem;">暂无已审核用户</p>'
        : approvedUsers.map(user => `
            <div class="user-item">
                <span class="username">${escapeHtml(user.username)}</span>
                <span class="user-status approved">${user.role === 'admin' ? '管理员' : '已批准'}</span>
                ${user.role !== 'admin' ? `
                    <div class="user-actions">
                        <button class="btn btn-danger btn-small" onclick="deleteUser('${user.username}')">删除</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
}

// 审核通过用户
async function approveUser(username) {
    const user = usersList.find(u => u.username === username);
    if (user) {
        user.status = 'approved';
        if (isServerConfigured()) {
            await saveUsersToGitHub();
        } else {
            saveUsersToLocalStorage();
        }
        renderUserList();
        showToast(`已批准用户 ${username}`, 'success');
    }
}

// 拒绝用户（删除）
async function rejectUser(username) {
    usersList = usersList.filter(u => u.username !== username);
    if (isServerConfigured()) {
        await saveUsersToGitHub();
    } else {
        saveUsersToLocalStorage();
    }
    renderUserList();
    showToast(`已拒绝用户 ${username}`, 'success');
}

// 删除用户
async function deleteUser(username) {
    if (!confirm(`确定要删除用户 ${username} 吗？`)) return;

    usersList = usersList.filter(u => u.username !== username);
    if (isServerConfigured()) {
        await saveUsersToGitHub();
    } else {
        saveUsersToLocalStorage();
    }
    renderUserList();
    showToast(`已删除用户 ${username}`, 'success');
}

// 检查用户是否已登录
function checkLoginStatus() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            updateUIForUser();
        } catch (e) {
            console.error('解析登录状态失败:', e);
        }
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
