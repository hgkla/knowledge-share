// GitHub API 配置常量
const FILE_PATH = 'data/knowledge.json';

// GitHub 配置（从 localStorage 读取）
let githubConfig = {
    token: '',
    owner: '',
    repo: '',
    branch: 'main'
};

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
    configOwner: document.getElementById('configOwner'),
    configRepo: document.getElementById('configRepo'),
    configBranch: document.getElementById('configBranch'),
    loading: document.getElementById('loading'),
    toast: document.getElementById('toast'),
    emptyState: document.getElementById('emptyState'),
    allCount: document.getElementById('allCount')
};

// 初始化
async function init() {
    loadGitHubConfig();
    loadFromLocalStorage();
    render();
    setupEventListeners();

    if (isGitHubConfigured()) {
        await loadFromGitHub();
    }
}

// 从 localStorage 加载 GitHub 配置
function loadGitHubConfig() {
    const config = localStorage.getItem('githubConfig');
    if (config) {
        try {
            githubConfig = JSON.parse(config);
        } catch (e) {
            console.error('解析 GitHub 配置失败:', e);
        }
    }
}

// 保存 GitHub 配置到 localStorage
function saveGitHubConfig() {
    localStorage.setItem('githubConfig', JSON.stringify(githubConfig));
}

// 检查 GitHub 配置是否完整
function isGitHubConfigured() {
    return githubConfig.token && githubConfig.owner && githubConfig.repo;
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

// 从 GitHub 加载数据
async function loadFromGitHub() {
    showLoading(true);
    try {
        const response = await fetch(
            `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${FILE_PATH}?ref=${githubConfig.branch}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            }
        );

        if (response.status === 404) {
            showToast('云端暂无数据，使用本地数据', 'success');
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
        showToast('已从云端同步数据', 'success');
    } catch (error) {
        console.error('从 GitHub 加载失败:', error);
        showToast('同步失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 保存到 GitHub
async function saveToGitHub() {
    if (!isGitHubConfigured()) {
        openConfigModal();
        showToast('请先配置 GitHub 信息', 'error');
        return;
    }

    showLoading(true);
    try {
        // 正确处理 base64 编码（支持中文）
        const jsonStr = JSON.stringify(knowledgeList, null, 2);
        const content = btoa(Array.from(new TextEncoder().encode(jsonStr), b => String.fromCharCode(b)).join(''));

        const body = {
            message: '更新知识列表',
            content: content,
            branch: githubConfig.branch
        };

        if (fileSha) {
            body.sha = fileSha;
        }

        const response = await fetch(
            `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${FILE_PATH}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubConfig.token}`,
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

// 打开配置模态框
function openConfigModal() {
    elements.configToken.value = githubConfig.token || '';
    elements.configOwner.value = githubConfig.owner || '';
    elements.configRepo.value = githubConfig.repo || '';
    elements.configBranch.value = githubConfig.branch || 'main';
    elements.configModal.classList.add('active');
}

// 关闭配置模态框
function closeConfigModal() {
    elements.configModal.classList.remove('active');
}

// 保存配置
function saveConfig(e) {
    e.preventDefault();

    githubConfig = {
        token: elements.configToken.value.trim(),
        owner: elements.configOwner.value.trim(),
        repo: elements.configRepo.value.trim(),
        branch: elements.configBranch.value.trim() || 'main'
    };

    saveGitHubConfig();
    closeConfigModal();
    showToast('配置已保存', 'success');

    // 如果配置完整，自动尝试同步
    if (isGitHubConfigured()) {
        loadFromGitHub();
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
        }
    });
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);
