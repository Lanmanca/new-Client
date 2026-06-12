import { stateManager } from '@/manager';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import forge from 'node-forge';

/**
 * 格式化为日期时间字符串
 * @param timestamp 时间戳
 */
export function formatDate(timestamp: number, hasMillisecond = false) {
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    let result = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

    if (hasMillisecond) {
        const millisecond = date.getMilliseconds().toString().padStart(3, '0');
        result += `.${millisecond}`;
    }

    return result;
}

/**
 * 格式化时间差为可读格式（HH:MM:SS）
 * @param milliseconds 毫秒数
 */
export function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * 将驼峰命名转换为蛇形命名
 */
export function camelToSnake(camel: string): string {
    const runes = Array.from(camel);
    const result: string[] = [];

    for (let i = 0; i < runes.length; i++) {
        const r = runes[i];

        // 如果是第一个字符，直接转为小写
        if (i === 0) {
            result.push(r.toLowerCase());
            continue;
        }

        // 当前字符是大写字母时
        if (r >= 'A' && r <= 'Z') {
            const prev = runes[i - 1];

            // 条件1：前一个字符是小写字母
            // 条件2：前一个字符是大写字母，且下一个字符是小写字母
            // 条件3：前一个字符不应是点或下划线
            const isPrevLower = prev >= 'a' && prev <= 'z';
            const hasNextLower = i + 1 < runes.length && runes[i + 1] >= 'a' && runes[i + 1] <= 'z';
            const isPrevLetterOrDigit =
                (prev >= 'a' && prev <= 'z') ||
                (prev >= 'A' && prev <= 'Z') ||
                (prev >= '0' && prev <= '9');

            if ((isPrevLower || hasNextLower) && isPrevLetterOrDigit) {
                result.push('_');
            }
        }

        result.push(r.toLowerCase());
    }

    return result.join('');
}

/**
 * 将蛇形命名转换为驼峰命名
 * @param s 蛇形命名字符串
 * @param isFirstUpper 是否首字母大写
 */
export function snakeToCamel(s: string, isFirstUpper: boolean = false): string {
    if (!s) return s;

    const words = s.split('_').filter(word => word.length > 0);

    if (words.length === 0) return '';

    // 处理每个单词：首字母大写，其余小写
    const processedWords = words.map(
        word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );

    // 处理第一个单词
    if (!isFirstUpper) {
        processedWords[0] = processedWords[0].charAt(0).toLowerCase() + processedWords[0].slice(1);
    }

    return processedWords.join('');
}

/**
 * 递归转换对象的键名（从驼峰到蛇形）
 */
export function transformKeysToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
    if (Array.isArray(obj)) {
        return obj.map(item =>
            typeof item === 'object' && item !== null ? transformKeysToSnake(item) : item
        );
    }

    if (obj && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const snakeKey = camelToSnake(key);
            const value = obj[key];

            if (value && typeof value === 'object') {
                acc[snakeKey] = transformKeysToSnake(value);
            } else {
                acc[snakeKey] = value;
            }

            return acc;
        }, {} as Record<string, any>);
    }

    return obj;
}

/**
 * 递归转换对象的键名（从蛇形到驼峰）
 */
export function transformKeysToCamel<T extends Record<string, any>>(
    obj: T,
    isFirstUpper: boolean = false
): Record<string, any> {
    if (Array.isArray(obj)) {
        return obj.map(item =>
            typeof item === 'object' && item !== null
                ? transformKeysToCamel(item, isFirstUpper)
                : item
        );
    }

    if (obj && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = snakeToCamel(key, isFirstUpper);
            const value = obj[key];

            if (value && typeof value === 'object') {
                acc[camelKey] = transformKeysToCamel(value, isFirstUpper);
            } else {
                acc[camelKey] = value;
            }

            return acc;
        }, {} as Record<string, any>);
    }

    return obj;
}

/**
 * 等待 ms 毫秒
 * @param ms milliseconds
 */
export async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 判断值是否为空
 */
export function isNullOrEmpty(value: any) {
    if (Array.isArray(value)) {
        return value.length === 0;
    }

    if (typeof value === 'object') {
        return Object.keys(value).length === 0;
    }

    if (typeof value === 'string') {
        return value.trim() === '';
    }

    return value === null || value === undefined;
}

/**
 * 防抖：在指定时间内多次调用，只执行最后一次
 * @param fn 需要防抖处理的函数
 * @param delay 延迟时间（毫秒），默认 300ms
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300) {
    let timer: any = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

/**
 * 节流：在指定时间内多次调用，只执行第一次
 * @param fn 需要节流处理的函数
 * @param delay 延迟时间（毫秒），默认 300ms
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, delay: number = 300) {
    let timer: any = null;

    return function (this: any, ...args: Parameters<T>) {
        if (!timer) {
            fn.apply(this, args);
            timer = setTimeout(() => {
                timer = null;
            }, delay);
        }
    };
}

/**
 * 防并发：上一次调用未完成时，后续调用都会被忽略
 * @param fn 需要防并发控制的函数
 */
export function noConcurrent<T extends (...args: any[]) => any>(fn: T) {
    let running = false;

    return async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T> | void> {
        if (running) {
            return;
        }
        running = true;

        try {
            return await fn.apply(this, args);
        } finally {
            running = false;
        }
    };
}

/**
 * 获取设备类型
 */
export function getDeviceType(): string {
    const key = 'device_type';

    let deviceType = stateManager.getItem<string>(key);
    if (deviceType) return deviceType;

    const navigator = globalThis.navigator;

    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('android')) {
        deviceType = 'android';
    } else if (
        userAgent.includes('iphone') ||
        userAgent.includes('ipad') ||
        userAgent.includes('ipod')
    ) {
        deviceType = 'ios';
    } else if (userAgent.includes('win')) {
        deviceType = 'windows';
    } else if (userAgent.includes('mac')) {
        deviceType = 'macos';
    } else if (userAgent.includes('linux')) {
        deviceType = 'linux';
    } else {
        deviceType = 'unknown';
    }
    stateManager.setItem(key, deviceType);
    return deviceType;
}

/**
 * 生成设备唯一标识
 * @returns 设备唯一标识
 */
export async function generateDeviceId() {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
}

/**
 * 生成 UUID
 * @returns UUID
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 对 JSON 对象的键按字母顺序排序
 */
export function sortJSONKeysByFirstLetter(jsonStr: string | Record<string, any>): string {
    const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    return JSON.stringify(
        Object.keys(data)
            .sort()
            .reduce((obj: Record<string, any>, key) => {
                obj[key] = data[key];
                return obj;
            }, {})
    );
}

/**
 * 计算 MD5 值
 */
export function md5(str: string): string {
    return forge.md.md5.create().update(str).digest().toHex();
}

/**
 * 动态导入模块
 * @template T 导入模块的类型
 * @param path 模块路径
 * @param name 模块中的导出名称
 * @returns 导入模块的实例
 */
export async function dynamicsImport(path: string, name?: string) {
    const module = await import(path);
    if (name) {
        return module[name];
    }
    return module.default;
}