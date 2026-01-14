// Supabase 存储模块
const SUPABASE_URL = 'https://mfqonqbufimxjvoewfaf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ssk-Q-5wkpU0STH1Ttr5NA_18K1V7fm';

// 初始化 Supabase 客户端
let supabase = null;

// 初始化函数
function initSupabase() {
    if (!supabase && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return supabase;
}

const Storage = {
    // 初始化（兼容原接口）
    async init() {
        initSupabase();
        return Promise.resolve();
    },

    // 添加笔记
    async addNote(note) {
        try {
            const client = initSupabase();
            const noteData = {
                text: String(note.text || ''),
                images: Array.isArray(note.images) ? note.images : (note.image ? [note.image] : []),
                tags: Array.isArray(note.tags) ? note.tags : (note.tags ? String(note.tags).split(',').filter(t => t) : []),
                timestamp: note.timestamp || Date.now(),
                favorite: false
            };

            const { data, error } = await client
                .from('notes')
                .insert(noteData)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('添加笔记失败:', error);
            throw error;
        }
    },

    // 获取所有笔记（按时间倒序）
    async getAllNotes() {
        try {
            const client = initSupabase();
            const { data, error } = await client
                .from('notes')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('加载笔记失败:', error);
            throw error;
        }
    },

    // 更新笔记
    async updateNote(id, updates) {
        try {
            const client = initSupabase();
            const { data, error } = await client
                .from('notes')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('更新笔记失败:', error);
            throw error;
        }
    },

    // 删除笔记
    async deleteNote(id) {
        try {
            const client = initSupabase();
            const { error } = await client
                .from('notes')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('删除笔记失败:', error);
            throw error;
        }
    },

    // 清空所有笔记
    async clearAll() {
        try {
            const client = initSupabase();
            const { error } = await client
                .from('notes')
                .delete()
                .neq('id', 0); // 删除所有记录

            if (error) throw error;
        } catch (error) {
            console.error('清空笔记失败:', error);
            throw error;
        }
    }
};

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
