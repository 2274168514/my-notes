// Vue 应用 - iOS 17 风格时间线笔记
const { createApp } = Vue;

// 全局未捕获 Promise 处理
window.addEventListener('unhandledrejection', (event) => {
    // 阻止错误输出到控制台
    event.preventDefault();
    // 可选：记录错误到控制台（不会显示为未捕获错误）
    console.warn('未处理的 Promise 已被捕获:', event.reason);
});

createApp({
    data() {
        return {
            notes: [],
            showComposeModal: false,
            showDetailModal: false,
            showFilterModal: false,
            // 心情选择气泡显示状态
            showMoodSelector: false,
            selectedNote: null,
            tagInput: '',
            detailTagInput: '',
            isLoading: true,
            loadError: null,
            isSaving: false,
            loadingText: '正在加载...',
            newNote: {
                text: '',
                images: [],  // 改为数组存储多张图片
                tags: [],
                mood: 'cloudy' // 默认心情：阴天
            },
            // 默认标签配置
            defaultTags: [
                { name: '生活', color: '#34C759' },      // 绿色
                { name: '学习', color: '#007AFF' },      // 蓝色
                { name: '工作', color: '#FF9500' },      // 橙色
                { name: '女朋友', color: '#FF3B30' },    // 红色
                { name: '男朋友', color: '#00BFFF' }     // 海蓝色
            ],
            // 筛选条件
            filter: {
                time: 'all',      // all, today, yesterday, week, month
                tags: [],          // 选中的标签
                favorite: false    // 是否只显示收藏的
            },
            // 时间筛选选项
            timeFilterOptions: [
                { label: '全部', value: 'all' },
                { label: '今天', value: 'today' },
                { label: '昨天', value: 'yesterday' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' }
            ],
            filteredNotes: [],
            // 本地点赞状态（存储当前设备点赞的笔记 ID）
            localLikedNotes: new Set(),
            
            // 分页状态
            page: 0,
            pageSize: 10,
            hasMore: true,
            isLoadingMore: false,

            // 评论功能
            commentsExpanded: false,
            newCommentText: '',
            commentSortOrder: 'newest', // 'newest' 或 'oldest'

            // 图片拖拽排序实例
            imageSortable: null,

            // 图片查看器状态
            showImageViewer: false,
            viewerImages: [],
            viewerIndex: 0,

            // 下拉刷新状态
            pullRefreshTranslateY: -60,
            pullRefreshRotate: false,
            isPullRefreshing: false,
            pullRefreshText: '下拉刷新',
            pullRefreshStartY: 0,
            pullRefreshCurrentY: 0,
            isPulling: false,
            pullRefreshCount: 0,          // 下拉次数计数器
            pullRefreshTimer: null,        // 重置计时器
            pullRefreshRequiredCount: 2    // 需要下拉的次数
        };
    },

    computed: {
        canPost() {
            return this.newNote.text.trim().length > 0;
        },

        // 获取所有使用过的标签（去重）
        allTags() {
            const tagSet = new Set();
            this.notes.forEach(note => {
                if (note.tags && Array.isArray(note.tags)) {
                    note.tags.forEach(tag => tagSet.add(tag));
                }
            });
            return Array.from(tagSet).sort();
        },

        // 显示的笔记（根据筛选条件过滤）
        displayNotes() {
            let result = [...this.notes];

            // 时间筛选
            if (this.filter.time !== 'all') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                result = result.filter(note => {
                    const noteDate = new Date(note.timestamp);
                    const noteDay = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());

                    switch (this.filter.time) {
                        case 'today':
                            return noteDay.getTime() === today.getTime();
                        case 'yesterday':
                            const yesterday = new Date(today);
                            yesterday.setDate(yesterday.getDate() - 1);
                            return noteDay.getTime() === yesterday.getTime();
                        case 'week':
                            const weekAgo = new Date(today);
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            return noteDay >= weekAgo;
                        case 'month':
                            const monthAgo = new Date(today);
                            monthAgo.setMonth(monthAgo.getMonth() - 1);
                            return noteDay >= monthAgo;
                        default:
                            return true;
                    }
                });
            }

            // 标签筛选
            if (this.filter.tags.length > 0) {
                result = result.filter(note => {
                    if (!note.tags || !Array.isArray(note.tags)) return false;
                    return this.filter.tags.some(tag => note.tags.includes(tag));
                });
            }

            // 收藏筛选
            if (this.filter.favorite) {
                result = result.filter(note => note.favorite);
            }

            return result;
        }
    },

    async mounted() {
        try {
            // 加载本地点赞状态
            this.loadingText = '正在启动...';
            this.loadLocalLikedNotes();

            // 等待 Supabase 初始化完成（添加超时处理）
            this.loadingText = '正在连接数据库...';

            // 设置超时：如果 10 秒内无法连接，显示错误
            const initTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('连接超时')), 10000)
            );

            await Promise.race([Storage.init(), initTimeout]);

            // 加载笔记
            this.loadingText = '正在加载笔记...';
            await this.loadNotes();

            // 添加滚动监听实现无限加载
            window.addEventListener('scroll', this.handleScroll);

            // 添加键盘事件监听（图片查看器）
            window.addEventListener('keydown', this.handleKeydown);

            // 添加下拉刷新 touch 事件监听
            this.setupPullToRefresh();
        } catch (error) {
            console.error('初始化失败:', error);
            if (error.message === '连接超时') {
                this.loadError = '数据库连接超时，请检查网络或稍后重试';
            } else if (error.message && error.message.includes('Supabase')) {
                this.loadError = '无法连接到数据库，请稍后重试';
            } else {
                this.loadError = '加载失败，请检查网络连接';
            }
            this.isLoading = false;
        }
    },

    unmounted() {
        window.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('keydown', this.handleKeydown);
        this.removePullToRefresh();
    },

    methods: {
        // 加载本地点赞状态
        loadLocalLikedNotes() {
            try {
                const stored = localStorage.getItem('aonao_liked_notes');
                if (stored) {
                    this.localLikedNotes = new Set(JSON.parse(stored));
                }
            } catch (error) {
                console.error('加载本地点赞状态失败:', error);
            }
        },

        // 保存本地点赞状态
        saveLocalLikedNotes() {
            try {
                localStorage.setItem('aonao_liked_notes', JSON.stringify([...this.localLikedNotes]));
            } catch (error) {
                console.error('保存本地点赞状态失败:', error);
            }
        },

        // 加载笔记（第一页）
        async loadNotes() {
            // 0. 优先加载本地缓存，实现"秒开"体验
            try {
                const cached = localStorage.getItem('aonao_notes_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    // 只有当本地没有数据时，才使用缓存填充，或者总是优先显示缓存
                    if (parsed && parsed.length > 0) {
                        console.log('加载本地缓存笔记:', parsed.length);
                        // 恢复 liked 状态
                        this.notes = parsed.map(note => ({
                            ...note,
                            liked: this.localLikedNotes.has(note.id)
                        }));
                        this.loadingText = '正在更新最新数据...';
                    }
                }
            } catch (e) {
                console.warn('读取缓存失败:', e);
            }

            // 尝试确保 Supabase 已初始化
            try {
                await Storage.init();
            } catch (e) {
                console.warn('尝试初始化 Supabase 失败:', e);
                // 不阻断，让下面的 fetchNotes 报更具体的错，或者在这里显示错误
                // 如果有缓存，就不显示全屏错误，而是静默失败或顶部提示
                if (this.notes.length === 0) {
                    this.loadError = '初始化失败: ' + (e.message || '网络异常');
                    this.isLoading = false;
                }
                return; 
            }

            this.page = 0;
            this.hasMore = true;
            // 注意：这里不要立即清空 this.notes，否则会闪屏。
            // 应该在 fetchNotes 成功后再替换。
            await this.fetchNotes();
        },

        // 加载更多笔记
        async loadMoreNotes() {
            if (this.isLoadingMore || !this.hasMore) return;
            
            this.isLoadingMore = true;
            this.page++;
            await this.fetchNotes(true);
            this.isLoadingMore = false;
        },

        // 获取笔记核心逻辑
        async fetchNotes(isAppend = false) {
            try {
                const result = await Storage.getNotesPaging(this.page, this.pageSize);
                const newNotes = result.data.map(note => ({
                    ...note,
                    liked: this.localLikedNotes.has(note.id),
                    likecount: note.likecount || 0
                }));

                if (isAppend) {
                    this.notes = [...this.notes, ...newNotes];
                } else {
                    this.notes = newNotes;
                    // 刷新成功后，更新本地缓存（只缓存第一页，防止数据过大）
                    try {
                        localStorage.setItem('aonao_notes_cache', JSON.stringify(this.notes));
                    } catch (e) {
                        console.warn('写入缓存失败:', e);
                    }
                }
                
                this.hasMore = result.hasMore;
                this.isLoading = false;
                this.loadError = null;
            } catch (error) {
                console.error('加载笔记失败:', error);
                if (!isAppend) {
                    // 如果是第一页加载失败
                    if (this.notes.length > 0) {
                        // 如果有缓存数据，则不显示全屏错误，而是改为 Toast 提示（这里简单用 console）
                        console.log('使用离线缓存数据展示');
                        this.isLoading = false; 
                    } else {
                        this.loadError = '加载失败: ' + error.message;
                        this.isLoading = false;
                    }
                }
            }
        },

        // 打开发布弹窗
        openComposeModal() {
            this.showComposeModal = true;
            this.resetNewNote();
            this.$nextTick(() => {
                if (this.$refs.composeTextarea) {
                    this.$refs.composeTextarea.focus();
                }
                // 初始化图片拖拽排序
                this.initImageSortable();
            });
        },

        // 关闭发布弹窗
        closeComposeModal() {
            this.showComposeModal = false;
            this.resetNewNote();
            // 销毁图片拖拽排序实例
            if (this.imageSortable) {
                this.imageSortable.destroy();
                this.imageSortable = null;
            }
        },

        // 打开笔记详情
        openNoteDetail(note) {
            this.selectedNote = note;
            this.showDetailModal = true;
        },

        // 关闭详情弹窗
        closeDetailModal() {
            this.showDetailModal = false;
            this.selectedNote = null;
            this.detailTagInput = '';
        },

        // 详情页添加标签
        async addDetailTag() {
            if (!this.selectedNote) return;

            const tag = this.detailTagInput.trim().replace(/^#/, '');

            if (!tag) return;

            if (!this.selectedNote.tags) {
                this.selectedNote.tags = [];
            }

            if (this.selectedNote.tags.includes(tag)) {
                this.detailTagInput = '';
                return;
            }

            if (this.selectedNote.tags.length >= 5) {
                alert('最多只能添加 5 个标签');
                return;
            }

            this.selectedNote.tags.push(tag);
            this.detailTagInput = '';

            // 保存到数据库
            try {
                await Storage.updateNote(this.selectedNote.id, { tags: [...this.selectedNote.tags] });
                await this.loadNotes();
            } catch (error) {
                console.error('保存标签失败:', error);
                alert('保存失败，请重试');
            }
        },

        // 详情页删除标签
        async removeDetailTag(tag) {
            if (!this.selectedNote) return;

            const index = this.selectedNote.tags.indexOf(tag);
            if (index > -1) {
                this.selectedNote.tags.splice(index, 1);

                // 保存到数据库
                try {
                    await Storage.updateNote(this.selectedNote.id, { tags: [...this.selectedNote.tags] });
                    await this.loadNotes();
                } catch (error) {
                    console.error('删除标签失败:', error);
                    alert('删除失败，请重试');
                }
            }
        },

        // 处理图片上传 - 支持多张
        async handleImageUpload(event) {
            const files = Array.from(event.target.files);

            if (!files.length) return;

            // 检查文件数量
            if (this.newNote.images.length + files.length > 9) {
                alert('最多只能上传9张图片');
                return;
            }

            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    alert('请选择图片文件');
                    continue;
                }

                if (file.size > 5 * 1024 * 1024) {
                    alert('图片大小不能超过 5MB');
                    continue;
                }

                try {
                    // 生成预览图（压缩 Base64 用于立即显示）
                    let base64 = await imageToBase64(file);
                    base64 = await compressImage(base64, 300); // 仅用于预览，压得小一点

                    this.newNote.images.push({
                        preview: base64, // 界面显示用
                        data: base64,    // 兼容字段
                        file: file       // 原始文件对象，用于上传
                    });
                } catch (error) {
                    console.error('图片处理失败:', error);
                }
            }

            event.target.value = '';
        },

        // 移除图片
        removeImage(index) {
            this.newNote.images.splice(index, 1);
            // 重新初始化拖拽排序
            this.$nextTick(() => {
                this.initImageSortable();
            });
        },

        // 触发图片上传
        triggerImageUpload() {
            this.$refs.fileInput.click();
        },

        // 初始化图片拖拽排序
        initImageSortable() {
            // 先销毁旧实例
            if (this.imageSortable) {
                this.imageSortable.destroy();
            }

            // 找到图片容器
            const container = document.querySelector('.images-attachment');
            if (!container) return;

            // 初始化 Sortable
            this.imageSortable = new Sortable(container, {
                animation: 200, // 动画时长
                handle: '.image-preview-item', // 整个图片项都可拖拽
                ghostClass: 'sortable-ghost', // 拖拽占位符样式
                dragClass: 'sortable-drag', // 拖拽元素样式
                onEnd: (evt) => {
                    // 拖拽结束后更新数据
                    const { oldIndex, newIndex } = evt;
                    if (oldIndex !== newIndex) {
                        // 移动数组元素
                        const item = this.newNote.images.splice(oldIndex, 1)[0];
                        this.newNote.images.splice(newIndex, 0, item);
                    }
                }
            });
        },

        // 添加标签
        addTag() {
            const tag = this.tagInput.trim().replace(/^#/, '');

            if (!tag) return;

            if (this.newNote.tags.includes(tag)) {
                this.tagInput = '';
                return;
            }

            if (this.newNote.tags.length >= 5) {
                alert('最多只能添加 5 个标签');
                return;
            }

            this.newNote.tags.push(tag);
            this.tagInput = '';
        },

        // 检查是否是自定义标签
        isCustomTag(tagName) {
            return !this.defaultTags.find(t => t.name === tagName);
        },

        // 打开筛选弹窗
        openFilterModal() {
            this.showFilterModal = true;
        },

        // 切换心情选择器显示状态
        toggleMoodSelector() {
            this.showMoodSelector = !this.showMoodSelector;
        },

        // 选择心情
        selectMood(mood) {
            this.newNote.mood = mood;
            // 稍等一下再关闭气泡，给用户视觉反馈
            setTimeout(() => {
                this.showMoodSelector = false;
            }, 200);
        },

        // 关闭筛选弹窗
        closeFilterModal() {
            this.showFilterModal = false;
        },

        // 重置筛选条件
        resetFilters() {
            this.filter = {
                time: 'all',
                tags: [],
                favorite: false
            };
        },

        // 应用筛选
        applyFilters() {
            this.closeFilterModal();
        },

        // 切换标签筛选
        toggleTagFilter(tag) {
            const index = this.filter.tags.indexOf(tag);
            if (index > -1) {
                this.filter.tags.splice(index, 1);
            } else {
                this.filter.tags.push(tag);
            }
        },

        // 移除标签
        removeTag(index) {
            this.newNote.tags.splice(index, 1);
        },

        // 聚焦标签输入框
        focusTagInput() {
            this.tagInput = ' ';
            this.$nextTick(() => {
                const tagInput = document.querySelector('.tag-input-field');
                if (tagInput) {
                    tagInput.focus();
                    tagInput.setSelectionRange(1, 1);
                }
            });
        },

        // 保存笔记
        async saveNote() {
            if (!this.newNote.text.trim() || this.isSaving) return;

            this.isSaving = true;

            const noteData = {
                text: this.newNote.text.trim(),
                images: this.newNote.images, // 传递完整对象，包含 file 属性
                tags: [...this.newNote.tags],
                mood: this.newNote.mood || 'cloudy', // 确保有默认值
                timestamp: Date.now()
            };

            // 先保存原始数据副本，用于失败时回滚
            const originalNote = JSON.parse(JSON.stringify(this.newNote));

            // 乐观更新：立即添加到本地显示
            // 如果有图片，使用第一张的预览图作为缩略图
            const firstImagePreview = noteData.images && noteData.images.length > 0
                ? (noteData.images[0].preview || noteData.images[0].data || noteData.images[0])
                : null;

            const tempNote = {
                id: 'temp_' + Date.now(),  // 临时ID
                ...noteData,
                // 覆盖 images 为兼容格式：第一张用预览图，其余保持原样
                images: firstImagePreview
                    ? [firstImagePreview, ...(noteData.images.slice(1).map(img =>
                        typeof img === 'string' ? img : (img.preview || img.data || img)
                      ))]
                    : noteData.images
            };
            this.notes.unshift(tempNote);

            // 立即关闭弹窗和重置表单
            this.closeComposeModal();

            try {
                // 后台保存到数据库
                const savedNote = await Storage.addNote(noteData);
                // 替换临时笔记为真实笔记
                const index = this.notes.findIndex(n => n.id === tempNote.id);
                if (index !== -1) {
                    this.notes[index] = savedNote;
                }
            } catch (error) {
                console.error('保存笔记失败:', error);
                // 保存失败，移除临时添加的笔记
                const index = this.notes.findIndex(n => n.id === tempNote.id);
                if (index !== -1) {
                    this.notes.splice(index, 1);
                }
                // 显示详细错误信息
                const errorMsg = error.message || error.toString() || '未知错误';
                if (errorMsg.includes('网络') || errorMsg.includes('fetch')) {
                    alert('网络连接异常，请刷新重试');
                } else {
                    alert('保存失败: ' + errorMsg);
                }
                // 恢复表单数据
                this.newNote = originalNote;
                this.showComposeModal = true;
            } finally {
                this.isSaving = false;
            }
        },

        // 删除当前笔记
        async deleteCurrentNote() {
            if (!this.selectedNote) return;

            const noteId = String(this.selectedNote.id); // 确保是字符串
            // 保留原始 ID 用于 Supabase 删除（可能是数字）
            const originalId = this.selectedNote.id;

            // 乐观更新：立即从本地移除
            const index = this.notes.findIndex(n => String(n.id) === noteId);
            if (index > -1) {
                this.notes.splice(index, 1);
            }

            // 关闭详情弹窗（这会将 selectedNote 置为 null）
            this.closeDetailModal();

            // 如果是临时笔记，不需要删除数据库
            if (noteId.startsWith('temp_')) {
                return;
            }

            // 后台删除数据库中的笔记
            try {
                // 使用之前保存的 originalId，不能再访问 this.selectedNote.id
                await Storage.deleteNote(originalId);
            } catch (error) {
                console.error('删除失败:', error);
                // 回滚：恢复笔记
                await this.loadNotes();
                alert('删除失败，请重试');
            }
        },

        // 收藏/取消收藏笔记
        async toggleFavorite(note) {
            // 1. 立即执行乐观更新（UI 立即响应）
            const originalStatus = note.favorite;
            const newFavoriteStatus = !originalStatus;
            
            // 更新 UI 显示
            const index = this.notes.findIndex(n => n.id === note.id);
            if (index !== -1) {
                this.notes[index].favorite = newFavoriteStatus;
            }

            // 2. 后台发送网络请求
            try {
                await Storage.updateNote(note.id, { favorite: newFavoriteStatus });
            } catch (error) {
                // 3. 如果失败，回滚状态
                console.error('收藏操作失败，正在回滚:', error);
                
                // 回滚 UI 显示
                if (index !== -1) {
                    this.notes[index].favorite = originalStatus;
                }

                // 提示用户
                console.error('收藏操作失败:', error);
                if (error.message.includes('网络')) {
                    alert('网络连接异常，请刷新重试');
                } else {
                    alert('操作失败，请重试');
                }
            }
        },

        // 阻止点击皇冠时打开卡片详情
        onFavoriteClick(event, note) {
            event.stopPropagation();
            this.toggleFavorite(note);
        },

        // 点赞/取消点赞笔记
        async toggleLike(note) {
            // 1. 立即执行乐观更新（UI 立即响应）
            const originalStatus = note.liked;
            const originalCount = note.likecount;
            const newLikeStatus = !originalStatus;
            
            // 更新本地点赞状态记录
            if (newLikeStatus) {
                this.localLikedNotes.add(note.id);
            } else {
                this.localLikedNotes.delete(note.id);
            }
            this.saveLocalLikedNotes();

            // 更新 UI 显示
            const index = this.notes.findIndex(n => n.id === note.id);
            if (index !== -1) {
                this.notes[index].liked = newLikeStatus;
                this.notes[index].likecount = (this.notes[index].likecount || 0) + (newLikeStatus ? 1 : -1);
            }

            // 2. 后台发送网络请求
            try {
                // 使用专门的点赞函数更新云端点赞数
                await Storage.toggleLike(note.id, newLikeStatus);
            } catch (error) {
                // 3. 如果失败，回滚状态
                console.error('点赞操作失败，正在回滚:', error);
                
                // 回滚本地点赞状态记录
                if (originalStatus) {
                    this.localLikedNotes.add(note.id);
                } else {
                    this.localLikedNotes.delete(note.id);
                }
                this.saveLocalLikedNotes();

                // 回滚 UI 显示
                if (index !== -1) {
                    this.notes[index].liked = originalStatus;
                    this.notes[index].likecount = originalCount;
                }
                
                // 提示用户
                console.error('点赞操作失败:', error);
                const errorMsg = error.message || error.toString() || '未知错误';
                if (errorMsg.includes('网络') || errorMsg.includes('fetch')) {
                    alert('网络连接异常，请刷新重试');
                } else {
                    alert('点赞失败: ' + errorMsg);
                }
            }
        },

        // 阻止点赞时打开卡片详情
        onLikeClick(event, note) {
            event.stopPropagation();
            this.toggleLike(note);
        },

        // 重置新笔记表单
        resetNewNote() {
            this.newNote = {
                text: '',
                images: [],
                tags: [],
                mood: 'cloudy'
            };
            this.tagInput = '';
            this.showMoodSelector = false;
        },

        // 格式化时间（简短版，用于时间线）
        formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;

            // 1分钟内
            if (diff < 60000) {
                return '刚刚';
            }

            // 1小时内
            if (diff < 3600000) {
                return `${Math.floor(diff / 60000)}分钟前`;
            }

            // 今天
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            if (noteDate.getTime() === today.getTime()) {
                return '今天';
            }

            // 昨天
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (noteDate.getTime() === yesterday.getTime()) {
                return '昨天';
            }

            // 本周
            const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return weekdays[date.getDay()];
        },

        // 格式化时间（详细版，用于详情）
        formatDetailTime(timestamp) {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}`;
        },

        // 获取标签颜色
        getTagColor(tagName) {
            const defaultTag = this.defaultTags.find(t => t.name === tagName);
            // 自定义标签使用黄色
            return defaultTag ? defaultTag.color : '#FFCC00';
        },

        // 选择默认标签
        selectDefaultTag(tagName) {
            if (this.newNote.tags.includes(tagName)) {
                // 如果已选中，则移除
                const index = this.newNote.tags.indexOf(tagName);
                this.newNote.tags.splice(index, 1);
            } else {
                // 否则添加
                this.newNote.tags.push(tagName);
            }
        },

        // 检查标签是否被选中
        isTagSelected(tagName) {
            return this.newNote.tags.includes(tagName);
        },

        // 滚动监听
        handleScroll() {
            // 距离底部 200px 时加载更多
            const bottomOfWindow = document.documentElement.scrollTop + window.innerHeight >= document.documentElement.offsetHeight - 200;

            if (bottomOfWindow && this.hasMore && !this.isLoadingMore && !this.isLoading) {
                this.loadMoreNotes();
            }
        },

        // ==================== 评论功能 ====================

        // 切换评论区展开/收起
        toggleComments() {
            this.commentsExpanded = !this.commentsExpanded;

            // 如果是展开，自动滚动到评论区
            if (this.commentsExpanded) {
                this.$nextTick(() => {
                    const commentsSection = document.querySelector('.detail-comments-section');
                    if (commentsSection) {
                        commentsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            }
        },

        // 获取当前选中笔记的评论列表
        getSelectedNoteComments() {
            if (!this.selectedNote || !this.selectedNote.comments) {
                return [];
            }
            return this.selectedNote.comments;
        },

        // 获取排序后的评论列表
        getSortedComments() {
            const comments = [...this.getSelectedNoteComments()];
            if (this.commentSortOrder === 'newest') {
                return comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            } else {
                return comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }
        },

        // 格式化评论时间
        formatCommentTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;

            // 1分钟内
            if (diff < 60000) {
                return '刚刚';
            }

            // 1小时内
            if (diff < 3600000) {
                return `${Math.floor(diff / 60000)}分钟前`;
            }

            // 今天
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const commentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            if (commentDate.getTime() === today.getTime()) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `今天 ${hours}:${minutes}`;
            }

            // 昨天
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (commentDate.getTime() === yesterday.getTime()) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `昨天 ${hours}:${minutes}`;
            }

            // 更早的日期
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}`;
        },

        // 添加评论
        async addComment() {
            const text = this.newCommentText.trim();
            if (!text || !this.selectedNote) return;

            const newComment = {
                id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                text: text,
                timestamp: new Date().toISOString()
            };

            // 确保评论数组存在
            if (!this.selectedNote.comments) {
                this.selectedNote.comments = [];
            }

            // 乐观更新：立即添加到本地显示
            this.selectedNote.comments.push(newComment);
            this.newCommentText = '';

            // 同时更新 notes 数组中的对应笔记
            const noteIndex = this.notes.findIndex(n => n.id === this.selectedNote.id);
            if (noteIndex > -1) {
                this.notes[noteIndex].comments = [...this.selectedNote.comments];
            }

            // 保存到数据库（后台执行，不阻塞界面）
            try {
                await Storage.updateNote(this.selectedNote.id, {
                    comments: [...this.selectedNote.comments]
                });
            } catch (error) {
                console.error('添加评论失败:', error);
                // 回滚：移除刚刚添加的评论
                const index = this.selectedNote.comments.findIndex(c => c.id === newComment.id);
                if (index > -1) {
                    this.selectedNote.comments.splice(index, 1);
                }
                if (noteIndex > -1) {
                    this.notes[noteIndex].comments = [...this.selectedNote.comments];
                }
                this.newCommentText = text; // 恢复输入内容
                alert('添加评论失败，请重试');
            }
        },

        // 删除评论
        async deleteComment(commentId) {
            if (!this.selectedNote || !this.selectedNote.comments) return;

            // 找到要删除的评论
            const commentIndex = this.selectedNote.comments.findIndex(c => c.id === commentId);
            if (commentIndex === -1) return;

            // 保存原评论用于回滚
            const deletedComment = this.selectedNote.comments[commentIndex];

            // 乐观更新：立即从本地移除
            this.selectedNote.comments.splice(commentIndex, 1);

            // 同时更新 notes 数组中的对应笔记
            const noteIndex = this.notes.findIndex(n => n.id === this.selectedNote.id);
            if (noteIndex > -1) {
                this.notes[noteIndex].comments = [...this.selectedNote.comments];
            }

            // 保存到数据库（后台执行，不阻塞界面）
            try {
                await Storage.updateNote(this.selectedNote.id, {
                    comments: [...this.selectedNote.comments]
                });
            } catch (error) {
                console.error('删除评论失败:', error);
                // 回滚：恢复评论
                this.selectedNote.comments.splice(commentIndex, 0, deletedComment);
                if (noteIndex > -1) {
                    this.notes[noteIndex].comments = [...this.selectedNote.comments];
                }
                alert('删除评论失败，请重试');
            }
        },

        // ==================== 图片查看器 ====================

        // 打开图片查看器
        openImageViewer(images, index) {
            this.viewerImages = images;
            this.viewerIndex = index;
            this.showImageViewer = true;

            // 禁止背景滚动
            document.body.style.overflow = 'hidden';
        },

        // 关闭图片查看器
        closeImageViewer() {
            this.showImageViewer = false;
            this.viewerImages = [];
            this.viewerIndex = 0;

            // 恢复背景滚动
            document.body.style.overflow = '';
        },

        // 上一张图片
        viewerPrev() {
            if (this.viewerIndex > 0) {
                this.viewerIndex--;
            }
        },

        // 下一张图片
        viewerNext() {
            if (this.viewerIndex < this.viewerImages.length - 1) {
                this.viewerIndex++;
            }
        },

        // 处理键盘事件（图片查看器）
        handleKeydown(event) {
            // 只有在图片查看器打开时才处理
            if (!this.showImageViewer) return;

            switch (event.key) {
                case 'Escape':
                    this.closeImageViewer();
                    event.preventDefault();
                    break;
                case 'ArrowLeft':
                    this.viewerPrev();
                    event.preventDefault();
                    break;
                case 'ArrowRight':
                    this.viewerNext();
                    event.preventDefault();
                    break;
            }
        },

        // ==================== 下拉刷新 ====================

        // 设置下拉刷新事件监听
        setupPullToRefresh() {
            const container = this.$refs.mainContainer;
            if (!container) return;

            container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        },

        // 移除下拉刷新事件监听
        removePullToRefresh() {
            const container = this.$refs.mainContainer;
            if (!container) return;

            container.removeEventListener('touchstart', this.handleTouchStart);
            container.removeEventListener('touchmove', this.handleTouchMove);
            container.removeEventListener('touchend', this.handleTouchEnd);
        },

        // Touch 开始
        handleTouchStart(event) {
            // 只在顶部时启用下拉刷新
            const container = this.$refs.mainContainer;
            if (container.scrollTop === 0) {
                this.pullRefreshStartY = event.touches[0].clientY;
                this.isPulling = true;
            }
        },

        // Touch 移动
        handleTouchMove(event) {
            if (!this.isPulling || this.isPullRefreshing) return;

            const currentY = event.touches[0].clientY;
            const diff = currentY - this.pullRefreshStartY;

            // 只在向下拉动且在顶部时响应
            if (diff > 0 && this.$refs.mainContainer.scrollTop === 0) {
                event.preventDefault(); // 阻止默认滚动

                // 限制最大下拉距离
                const pullDistance = Math.min(diff * 0.5, 100);
                this.pullRefreshTranslateY = -60 + pullDistance;

                // 更新状态
                if (pullDistance >= 60) {
                    if (this.pullRefreshCount + 1 >= this.pullRefreshRequiredCount) {
                        this.pullRefreshText = '释放立即刷新';
                    } else {
                        this.pullRefreshText = `再下拉${this.pullRefreshRequiredCount - this.pullRefreshCount - 1}次即可刷新`;
                    }
                    this.pullRefreshRotate = true;
                } else {
                    if (this.pullRefreshCount > 0) {
                        this.pullRefreshText = `已下拉${this.pullRefreshCount}次，再下拉${this.pullRefreshRequiredCount - this.pullRefreshCount}次`;
                    } else {
                        this.pullRefreshText = '下拉刷新';
                    }
                    this.pullRefreshRotate = false;
                }
            }
        },

        // Touch 结束
        async handleTouchEnd() {
            if (!this.isPulling) return;

            this.isPulling = false;

            // 如果拉动距离足够，增加计数
            if (this.pullRefreshTranslateY >= 0) {
                this.pullRefreshCount++;

                // 如果达到所需次数，执行刷新
                if (this.pullRefreshCount >= this.pullRefreshRequiredCount) {
                    await this.doPullRefresh();
                } else {
                    // 未达到次数，重置位置但保留计数
                    this.pullRefreshTranslateY = -60;

                    // 设置3秒后重置计数器
                    if (this.pullRefreshTimer) {
                        clearTimeout(this.pullRefreshTimer);
                    }
                    this.pullRefreshTimer = setTimeout(() => {
                        this.pullRefreshCount = 0;
                        this.pullRefreshText = '下拉刷新';
                    }, 3000);
                }
            } else {
                // 未达到阈值，重置状态
                this.resetPullRefresh();
            }
        },

        // 执行下拉刷新
        async doPullRefresh() {
            this.isPullRefreshing = true;
            this.pullRefreshText = '正在刷新...';
            this.pullRefreshTranslateY = 0;

            try {
                // 重新加载笔记
                await this.loadNotes();
                this.pullRefreshText = '刷新成功';

                // 1秒后重置
                setTimeout(() => {
                    this.resetPullRefresh();
                }, 1000);
            } catch (error) {
                console.error('刷新失败:', error);
                this.pullRefreshText = '刷新失败';

                // 1.5秒后重置
                setTimeout(() => {
                    this.resetPullRefresh();
                }, 1500);
            }
        },

        // 重置下拉刷新状态
        resetPullRefresh() {
            this.isPullRefreshing = false;
            this.pullRefreshTranslateY = -60;
            this.pullRefreshRotate = false;
            this.pullRefreshText = '下拉刷新';
            this.pullRefreshCount = 0;

            // 清除计时器
            if (this.pullRefreshTimer) {
                clearTimeout(this.pullRefreshTimer);
                this.pullRefreshTimer = null;
            }
        }
    }
}).mount('#app');
