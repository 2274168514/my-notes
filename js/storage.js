// 存储模块 - 双重存储策略（Supabase + localStorage 后备）
const Storage = (function() {
    // Supabase 配置
    const SUPABASE_URL = 'https://mfqonqbufimxjvoewfaf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_ssk-Q-5wkpU0STH1Ttr5NA_18K1V7fm';

    // 状态变量
    let _client = null;
    let _useSupabase = false;  // 是否使用 Supabase（false 表示使用 localStorage）
    let _initPromise = null;
    let _syncInterval = null;  // 同步定时器

    // localStorage 键名
    const LOCAL_STORAGE_KEY = 'aonao_notes';

    // 等待 Supabase 库加载（最多等待 5 秒）
    function waitForSupabase() {
        return new Promise((resolve) => {
            if (window.supabase) {
                console.log('[Storage] Supabase 已加载');
                _useSupabase = true;
                resolve(true);
            } else {
                console.log('[Storage] 等待 Supabase 库加载...');
                let attempts = 0;
                const maxAttempts = 50;  // 5 秒
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.supabase) {
                        clearInterval(checkInterval);
                        console.log('[Storage] Supabase 库加载成功，耗时:', (attempts * 0.1).toFixed(1), '秒');
                        _useSupabase = true;
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.log('[Storage] Supabase 库加载超时，使用 localStorage');
                        _useSupabase = false;
                        resolve(false);
                    }
                }, 100);
            }
        });
    }

    // 获取 Supabase 客户端
    function getClient() {
        if (!_client && _useSupabase && window.supabase) {
            _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return _client;
    }

    // ============ localStorage 操作 ============

    // 从 localStorage 获取所有笔记
    function getLocalNotes() {
        try {
            const data = localStorage.getItem(LOCAL_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('[LocalStorage] 读取失败:', error);
            return [];
        }
    }

    // 保存笔记到 localStorage
    function saveLocalNotes(notes) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
        } catch (error) {
            console.error('[LocalStorage] 保存失败:', error);
        }
    }

    // ============ 图片处理 ============

    // 将图片转换为 Base64
    function imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    // 压缩图片（减少存储空间）
    function compressImage(base64, maxSize = 500) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 按比例缩放
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 压缩为 JPEG，质量 0.8
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };

            img.onerror = () => resolve(base64);
            img.src = base64;
        });
    }

    // ============ 公共接口 ============

    return {
        // 初始化
        async init() {
            if (!_initPromise) {
                _initPromise = waitForSupabase().then(async (success) => {
                    if (success && window.supabase) {
                        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                        console.log('[Storage] 使用 Supabase 存储');

                        // 检查是否有本地未同步的数据
                        const localNotes = getLocalNotes();
                        if (localNotes.length > 0) {
                            console.log('[Storage] 发现', localNotes.length, '条本地数据，尝试同步到云端...');
                            try {
                                for (const note of localNotes) {
                                    await _client.from('notes').insert(note).select().single();
                                }
                                // 同步成功后清空本地数据
                                saveLocalNotes([]);
                                console.log('[Storage] 本地数据已同步到云端');
                            } catch (error) {
                                console.log('[Storage] 同步失败，保留本地数据');
                            }
                        }
                    } else {
                        console.log('[Storage] Supabase 加载超时，使用 localStorage 存储（数据不会同步到云端）');
                        // 启动定时重试，每 10 秒尝试连接一次 Supabase
                        if (!_syncInterval) {
                            _syncInterval = setInterval(async () => {
                                if (window.supabase && !_useSupabase) {
                                    console.log('[Storage] 尝试重新连接 Supabase...');
                                    try {
                                        _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                                        // 测试连接
                                        const { error } = await _client.from('notes').select('id').limit(1);
                                        if (!error) {
                                            console.log('[Storage] 重新连接成功，切换到 Supabase 存储');
                                            _useSupabase = true;
                                            // 同步本地数据
                                            const localNotes = getLocalNotes();
                                            if (localNotes.length > 0) {
                                                console.log('[Storage] 发现', localNotes.length, '条本地数据，尝试同步到云端...');
                                                for (const note of localNotes) {
                                                    await _client.from('notes').insert(note).select().single();
                                                }
                                                saveLocalNotes([]);
                                                console.log('[Storage] 本地数据已同步到云端');
                                            }
                                            // 停止定时器
                                            if (_syncInterval) {
                                                clearInterval(_syncInterval);
                                                _syncInterval = null;
                                            }
                                            // 刷新页面数据
                                            window.location.reload();
                                        }
                                    } catch (error) {
                                        console.log('[Storage] 重新连接失败，稍后重试');
                                    }
                                }
                            }, 10000);
                        }
                    }
                });
            }
            return _initPromise;
        },

        // 添加笔记
        async addNote(note) {
            const noteData = {
                id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                text: String(note.text || ''),
                images: Array.isArray(note.images) ? note.images : (note.image ? [note.image] : []),
                tags: Array.isArray(note.tags) ? note.tags : (note.tags ? String(note.tags).split(',').filter(t => t) : []),
                timestamp: note.timestamp || Date.now(),
                favorite: false,
                liked: false
            };

            if (_useSupabase) {
                try {
                    const client = getClient();
                    const { data, error } = await client
                        .from('notes')
                        .insert(noteData)
                        .select()
                        .single();

                    if (error) throw error;
                    console.log('[Storage] 笔记已保存到 Supabase');
                    return data;
                } catch (error) {
                    console.error('[Storage] Supabase 保存失败，降级到 localStorage:', error);
                    _useSupabase = false;
                }
            }

            // 使用 localStorage
            const notes = getLocalNotes();
            notes.unshift(noteData);
            saveLocalNotes(notes);
            console.log('[Storage] 笔记已保存到 localStorage');
            return noteData;
        },

        // 获取所有笔记（按时间倒序）
        async getAllNotes() {
            if (_useSupabase) {
                try {
                    const client = getClient();
                    const { data, error } = await client
                        .from('notes')
                        .select('*')
                        .order('timestamp', { ascending: false });

                    if (error) throw error;
                    console.log('[Storage] 从 Supabase 加载了', data?.length || 0, '条笔记');
                    return data || [];
                } catch (error) {
                    console.error('[Storage] Supabase 加载失败，降级到 localStorage:', error);
                    _useSupabase = false;
                }
            }

            // 使用 localStorage
            const notes = getLocalNotes();
            notes.sort((a, b) => b.timestamp - a.timestamp);
            console.log('[Storage] 从 localStorage 加载了', notes.length, '条笔记');
            return notes;
        },

        // 更新笔记
        async updateNote(id, updates) {
            if (_useSupabase) {
                try {
                    const client = getClient();
                    const { data, error } = await client
                        .from('notes')
                        .update(updates)
                        .eq('id', id)
                        .select()
                        .single();

                    if (error) throw error;
                    return data;
                } catch (error) {
                    console.error('[Storage] Supabase 更新失败，降级到 localStorage:', error);
                    _useSupabase = false;
                }
            }

            // 使用 localStorage
            const notes = getLocalNotes();
            const index = notes.findIndex(n => n.id === id);
            if (index !== -1) {
                notes[index] = { ...notes[index], ...updates };
                saveLocalNotes(notes);
                return notes[index];
            }
            throw new Error('笔记不存在');
        },

        // 删除笔记
        async deleteNote(id) {
            if (_useSupabase) {
                try {
                    const client = getClient();
                    const { error } = await client
                        .from('notes')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    return;
                } catch (error) {
                    console.error('[Storage] Supabase 删除失败，降级到 localStorage:', error);
                    _useSupabase = false;
                }
            }

            // 使用 localStorage
            const notes = getLocalNotes();
            const filteredNotes = notes.filter(n => n.id !== id);
            saveLocalNotes(filteredNotes);
        },

        // 清空所有笔记
        async clearAll() {
            if (_useSupabase) {
                try {
                    const client = getClient();
                    const { error } = await client
                        .from('notes')
                        .delete()
                        .neq('id', 0);

                    if (error) throw error;
                    return;
                } catch (error) {
                    console.error('[Storage] Supabase 清空失败，降级到 localStorage:', error);
                    _useSupabase = false;
                }
            }

            // 使用 localStorage
            saveLocalNotes([]);
        },

        // 暴露图片处理函数（外部使用）
        imageToBase64: imageToBase64,
        compressImage: compressImage,

        // 暴露当前使用的存储类型
        getStorageType() {
            return _useSupabase ? 'supabase' : 'local';
        }
    };
})();

// 全局函数（兼容外部调用）
function imageToBase64(file) {
    return Storage.imageToBase64(file);
}

function compressImage(base64, maxSize) {
    return Storage.compressImage(base64, maxSize);
}
