// Supabase 存储模块 - 纯云端存储
const Storage = (function() {
    // Supabase 配置
    const SUPABASE_URL = 'https://mfqonqbufimxjvoewfaf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_ssk-Q-5wkpU0STH1Ttr5NA_18K1V7fm';

    // Supabase 客户端实例
    let _client = null;
    let _initPromise = null;

    // 等待 Supabase 库加载（最多等待 10 秒）
    function waitForSupabase() {
        return new Promise((resolve, reject) => {
            if (window.supabase) {
                console.log('[Storage] Supabase 已加载');
                resolve();
            } else {
                console.log('[Storage] 等待 Supabase 库加载...');
                let attempts = 0;
                const maxAttempts = 100;  // 10 秒
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.supabase) {
                        clearInterval(checkInterval);
                        console.log('[Storage] Supabase 库加载成功，耗时:', (attempts * 0.1).toFixed(1), '秒');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        reject(new Error('Supabase 库加载超时，请检查网络连接'));
                    }
                }, 100);
            }
        });
    }

    // 获取 Supabase 客户端
    function getClient() {
        if (!_client) {
            throw new Error('Supabase 未初始化');
        }
        return _client;
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
                _initPromise = waitForSupabase().then(() => {
                    if (!window.supabase) {
                        throw new Error('Supabase 库加载失败');
                    }
                    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                    console.log('[Storage] Supabase 初始化成功');
                });
            }
            return _initPromise;
        },

        // 添加笔记
        async addNote(note) {
            const noteData = {
                text: String(note.text || ''),
                images: Array.isArray(note.images) ? note.images : (note.image ? [note.image] : []),
                tags: Array.isArray(note.tags) ? note.tags : (note.tags ? String(note.tags).split(',').filter(t => t) : []),
                timestamp: note.timestamp || Date.now(),
                favorite: false,
                liked: false
            };

            const client = getClient();
            const { data, error } = await client
                .from('notes')
                .insert(noteData)
                .select()
                .single();

            if (error) throw error;
            console.log('[Storage] 笔记已保存到 Supabase');
            return data;
        },

        // 获取所有笔记（按时间倒序）
        async getAllNotes() {
            const client = getClient();
            const { data, error } = await client
                .from('notes')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;
            console.log('[Storage] 从 Supabase 加载了', data?.length || 0, '条笔记');
            return data || [];
        },

        // 更新笔记
        async updateNote(id, updates) {
            const client = getClient();
            const { data, error } = await client
                .from('notes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        // 删除笔记
        async deleteNote(id) {
            const client = getClient();
            const { error } = await client
                .from('notes')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },

        // 清空所有笔记
        async clearAll() {
            const client = getClient();
            const { error } = await client
                .from('notes')
                .delete()
                .neq('id', 0);

            if (error) throw error;
        },

        // 暴露图片处理函数（外部使用）
        imageToBase64: imageToBase64,
        compressImage: compressImage
    };
})();

// 全局函数（兼容外部调用）
function imageToBase64(file) {
    return Storage.imageToBase64(file);
}

function compressImage(base64, maxSize) {
    return Storage.compressImage(base64, maxSize);
}
