// Vue 应用 - iOS 17 风格时间线笔记
const { createApp } = Vue;

createApp({
    data() {
        return {
            notes: [],
            showComposeModal: false,
            showDetailModal: false,
            showFilterModal: false,
            selectedNote: null,
            tagInput: '',
            detailTagInput: '',
            isLoading: true,
            loadError: null,
            newNote: {
                text: '',
                images: [],  // 改为数组存储多张图片
                tags: []
            },
            // 默认标签配置
            defaultTags: [
                { name: '生活', color: '#34C759' },      // 绿色
                { name: '学习', color: '#007AFF' },      // 蓝色
                { name: '工作', color: '#FF9500' },      // 橙色
                { name: '女朋友', color: '#FF3B30' }     // 红色
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
            filteredNotes: []
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
            // 等待 Supabase 初始化完成
            await Storage.init();

            // 加载笔记
            await this.loadNotes();
        } catch (error) {
            console.error('初始化失败:', error);
            this.loadError = '加载失败，请刷新页面重试';
            this.isLoading = false;
        }
    },

    methods: {
        // 加载所有笔记
        async loadNotes() {
            try {
                this.notes = await Storage.getAllNotes();
                this.isLoading = false;
                this.loadError = null;
            } catch (error) {
                console.error('加载笔记失败:', error);
                this.loadError = '加载失败: ' + error.message;
                this.isLoading = false;
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
            });
        },

        // 关闭发布弹窗
        closeComposeModal() {
            this.showComposeModal = false;
            this.resetNewNote();
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
                    let base64 = await imageToBase64(file);
                    base64 = await compressImage(base64);

                    this.newNote.images.push({
                        preview: base64,
                        data: base64
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
            if (!this.newNote.text.trim()) return;

            try {
                const noteData = {
                    text: this.newNote.text.trim(),
                    images: this.newNote.images.map(img => img.data),
                    tags: [...this.newNote.tags],
                    timestamp: Date.now()
                };

                await Storage.addNote(noteData);
                await this.loadNotes();
                this.closeComposeModal();
            } catch (error) {
                console.error('保存笔记失败:', error);
                alert('保存失败，请重试');
            }
        },

        // 删除当前笔记
        async deleteCurrentNote() {
            if (!this.selectedNote) return;

            if (confirm('确定要删除这条笔记吗？')) {
                try {
                    await Storage.deleteNote(this.selectedNote.id);
                    await this.loadNotes();
                    this.closeDetailModal();
                } catch (error) {
                    console.error('删除失败:', error);
                    alert('删除失败，请重试');
                }
            }
        },

        // 收藏/取消收藏笔记
        async toggleFavorite(note) {
            try {
                const newFavoriteStatus = !note.favorite;
                await Storage.updateNote(note.id, { favorite: newFavoriteStatus });
                await this.loadNotes();
            } catch (error) {
                console.error('收藏操作失败:', error);
                alert('操作失败，请重试');
            }
        },

        // 阻止点击皇冠时打开卡片详情
        onFavoriteClick(event, note) {
            event.stopPropagation();
            this.toggleFavorite(note);
        },

        // 重置新笔记表单
        resetNewNote() {
            this.newNote = {
                text: '',
                images: [],
                tags: []
            };
            this.tagInput = '';
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
        }
    }
}).mount('#app');
