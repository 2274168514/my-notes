// Supabase 存储模块 - 纯云端存储
const Storage = (function() {
    // Supabase 配置
    const SUPABASE_URL = 'https://mfqonqbufimxjvoewfaf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_ssk-Q-5wkpU0STH1Ttr5NA_18K1V7fm';

    // Supabase 客户端实例
    let _client = null;
    let _initPromise = null;

    // 等待 Supabase 库加载（最多等待 5 秒）
    function waitForSupabase() {
        return new Promise((resolve, reject) => {
            if (window.supabase) {
                console.log('[Storage] Supabase 已加载');
                resolve();
            } else {
                console.log('[Storage] 等待 Supabase 库加载...');
                let attempts = 0;
                const maxAttempts = 50;  // 5 秒
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (window.supabase) {
                        clearInterval(checkInterval);
                        const duration = (attempts * 0.1).toFixed(1);
                        console.log('[Storage] Supabase 库加载成功，耗时:', duration, '秒');
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
    // ============ Storage 上传 ============

    // 上传图片到 Supabase Storage
    async function uploadImage(file) {
        const client = getClient();
        
        // 生成唯一文件名: timestamp_random.ext
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${random}.${ext}`;

        // 上传文件
        const { data, error } = await client
            .storage
            .from('images')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('[Storage] 上传失败:', error);
            throw error;
        }

        // 获取公开 URL
        const { data: { publicUrl } } = client
            .storage
            .from('images')
            .getPublicUrl(fileName);

        return publicUrl;
    }

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
            // 处理图片上传
            let imageUrls = [];
            
            // 检查 images 数组
            if (note.images && Array.isArray(note.images)) {
                // 并行上传所有新图片
                const uploadPromises = note.images.map(async (img) => {
                    // 如果包含 file 对象，说明是新上传的图片
                    if (img.file) {
                        try {
                            return await uploadImage(img.file);
                        } catch (e) {
                            console.error('图片上传失败，降级使用预览图:', e);
                            return img.data || img.preview; // 降级处理
                        }
                    }
                    // 否则可能是旧的 Base64 字符串或者已经是 URL
                    return img.data || img; 
                });
                
                imageUrls = await Promise.all(uploadPromises);
            } 
            // 兼容旧格式（单张图片）
            else if (note.image) {
                imageUrls = [note.image];
            }

            const noteData = {
                text: String(note.text || ''),
                images: imageUrls,
                tags: Array.isArray(note.tags) ? note.tags : (note.tags ? String(note.tags).split(',').filter(t => t) : []),
                timestamp: note.timestamp || Date.now(),
                favorite: false,
                likecount: 0
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

        // 获取所有笔记（按时间倒序）- 兼容旧调用，但建议用分页
        async getAllNotes() {
            return this.getNotesPaging(0, 100); // 默认获取前100条防止卡死
        },

        // 分页获取笔记
        async getNotesPaging(page = 0, pageSize = 20) {
            const client = getClient();
            const from = page * pageSize;
            const to = from + pageSize - 1;
            
            const { data, error, count } = await client
                .from('notes')
                .select('*', { count: 'exact' })
                .order('timestamp', { ascending: false })
                .range(from, to);

            if (error) throw error;
            console.log(`[Storage] 加载第 ${page + 1} 页 (${data?.length}条)`);
            return { 
                data: data || [], 
                total: count || 0,
                hasMore: (data?.length === pageSize)
            };
        },

        // 更新笔记
        async updateNote(id, updates) {
            const client = getClient();
            const { data, error } = await client
                .from('notes')
                .update(updates)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        },

        // 点赞/取消点赞（单独的函数）
        async toggleLike(id, isLiking) {
            const client = getClient();

            // 先获取当前点赞数
            const { data: current, error: fetchError } = await client
                .from('notes')
                .select('likecount')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            const currentCount = current.data?.likecount || 0;
            const newCount = isLiking ? currentCount + 1 : currentCount - 1;

            // 更新点赞数
            const { data, error } = await client
                .from('notes')
                .update({ likecount: newCount })
                .eq('id', id)
                .select('*')
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
