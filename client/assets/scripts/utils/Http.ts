import config from '@/config';
import { i18n, uiManager, userManager } from '@/manager';
import {
    Method,
    RequestInterceptor,
    RequestOptions,
    Response,
    ResponseInterceptor,
} from '@/types/http';
import { transformKeysToCamel, transformKeysToSnake } from '@/utils';
import { AESCipher } from './AESCipher';
import { tServerErrorMessage } from './serverMessage';

/**
 * HTTP请求类
 */
export class Http {
    private abortControllers: Map<string, AbortController> = new Map();
    private requestInterceptors: RequestInterceptor[] = [];
    private responseInterceptors: ResponseInterceptor[] = [];

    constructor(private baseUrl: string) { }

    /**
     * 添加请求拦截器
     */
    public addRequestInterceptor(interceptor: RequestInterceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * 添加响应拦截器
     */
    public addResponseInterceptor(interceptor: ResponseInterceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * 取消请求
     * @param url 请求URL
     */
    public cancelRequest(url: string) {
        const controller = this.abortControllers.get(url);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(url);
        }
    }

    /**
     * 取消所有请求
     */
    public cancelAllRequests() {
        this.abortControllers.forEach((controller, url) => {
            controller.abort();
        });
        this.abortControllers.clear();
    }

    /**
     * 应用请求拦截器
     */
    private async applyRequestInterceptors(options: RequestOptions): Promise<RequestOptions> {
        let config = { ...options };

        for (const interceptor of this.requestInterceptors) {
            if (interceptor.onFulfilled) {
                config = await interceptor.onFulfilled(config);
            }
        }

        return config;
    }

    /**
     * 应用响应拦截器
     */
    private async applyResponseInterceptors<T>(response: Response<T>): Promise<Response<T>> {
        let result = response;

        for (const interceptor of this.responseInterceptors) {
            if (interceptor.onFulfilled) {
                result = await interceptor.onFulfilled(result);
            }
        }

        return result;
    }

    /**
     * 带重试和超时的请求方法
     */
    private async requestWithRetry<T>(
        requestFn: () => Promise<Response<T>>,
        retries: number = 3,
        url: string,
    ): Promise<Response<T>> {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                // 如果是取消请求，不重试
                if (error.name === 'AbortError') {
                    return {
                        status: false,
                        message: i18n.t('request.error.cancel'),
                    };
                }

                // 最后一次重试失败，返回错误
                if (i === retries - 1) {
                    return {
                        status: false,
                        message: error.message || i18n.t('request.error.fail'),
                    };
                }

                // 指数退避重试
                const delay = 1000 * Math.pow(2, i);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        return { status: false, message: lastError?.message };
    }

    /**
     * 基础请求方法
     * @param options 请求选项
     */
    private async baseRequest<T>(options: RequestOptions): Promise<Response<T>> {
        const {
            url,
            method = 'GET',
            headers = {},
            data,
            params,
            timeout = 10000,
            retries = 1,
        } = options;

        // 构建完整URL
        let fullUrl = this.baseUrl + url;
        if (params && Object.keys(params).length > 0) {
            fullUrl += `?${new URLSearchParams(params).toString()}`;
        }

        // 创建信号控制器
        const abortController = new AbortController();
        this.abortControllers.set(url, abortController);

        // 设置超时
        const timeoutId = setTimeout(() => {
            abortController.abort();
            this.abortControllers.delete(url);
        }, timeout);

        const signal = abortController.signal;

        const requestFn = async (): Promise<Response<T>> => {
            const loading = uiManager.loading();
            try {
                // 序列化请求体
                let body: string | undefined;
                if (data && method === 'POST') {
                    body = JSON.stringify(data);
                }

                // 添加用户ID头
                if (userManager.user) {
                    headers['X-User-Id'] = userManager.user.userId;
                }

                const response = await fetch(fullUrl, {
                    method,
                    body,
                    headers: {
                        ...headers,
                        'X-Device-Id': await config.DEVICE_ID(),
                        'X-Timestamp': Date.now().toString(),
                        'Content-Type': 'application/json',
                    },
                    signal,
                });

                if (!response.ok) {
                    let errorMessage = i18n.t('request.error.unknown', { error: response.status });

                    switch (response.status) {
                        case 500:
                            errorMessage = i18n.t('request.error.server');
                            break;
                        case 404:
                            errorMessage = i18n.t('request.error.not_found');
                            break;
                        case 403:
                            errorMessage = i18n.t('request.error.forbidden');
                            break;
                        case 401:
                            errorMessage = i18n.t('request.error.unauthorized');
                            break;
                    }

                    throw new Error(errorMessage);
                }

                const responseData: Response<T> = await response.json();

                // 应用响应拦截器
                const interceptedResponse = await this.applyResponseInterceptors(responseData);

                // 处理提示信息
                if (interceptedResponse.extra?.show) {
                    const raw = (interceptedResponse.message || '').trim();
                    const localized = raw ? tServerErrorMessage(raw) : '';
                    const message =
                        localized ||
                        (interceptedResponse.status
                            ? i18n.t('request.success.success')
                            : i18n.t('request.error.fail'));

                    await uiManager.alert({ content: message });
                }

                // 根据code判断请求状态
                if (interceptedResponse.status) {
                    return {
                        status: true,
                        data: transformKeysToCamel(interceptedResponse.data) as T,
                        message: interceptedResponse.message,
                    };
                }

                return {
                    status: false,
                    message: interceptedResponse.message,
                };
            } catch (error) {
                let errorMessage = error.message || error.toString();

                if (
                    (error.name === 'TypeError' && error.message === 'Failed to fetch') ||
                    (error.message && error.message.includes('NetworkError'))
                ) {
                    errorMessage = i18n.t('request.error.network');
                }
                if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
                    errorMessage = i18n.t('request.error.timeout');
                }

                await uiManager.alert({ content: errorMessage });

                return {
                    status: false,
                    message: errorMessage,
                };
            } finally {
                clearTimeout(timeoutId);
                this.abortControllers.delete(url);
                loading.hide();
            }
        };

        // 执行带重试的请求
        return this.requestWithRetry(requestFn, retries, url);
    }

    /**
     * 基础请求方法（带加密）
     * @param options 请求选项
     */
    private async baseRequestWithEncrypt<T>(options: RequestOptions): Promise<Response<T>> {
        const deviceId = await config.DEVICE_ID();

        options.headers = {
            ...options.headers,
            'X-Client-Version': await config.APP_VERSION(),
        };

        // 加密查询参数（适用于GET请求）：与 server 一致，wire 为 Base64(字节交错包)
        if (options.params && Object.keys(options.params).length > 0) {
            options.params = {
                encrypt: AESCipher.encryptToBase64(JSON.stringify(options.params), deviceId),
            };
        }

        // 加密数据体（适用于POST请求）
        if (options.data && Object.keys(options.data).length > 0) {
            options.data = {
                encrypt: AESCipher.encryptToBase64(JSON.stringify(options.data), deviceId),
            };
        }

        // 发送请求并获取加密数据
        const response = await this.baseRequest<{ encrypt: string }>(options);

        if (!response.status || !response.data) {
            return {
                status: false,
                message: response.message,
            };
        }

        try {
            const decryptedData = AESCipher.decryptFromBase64(response.data.encrypt, deviceId);

            const decryptedDataObject = JSON.parse(decryptedData);

            return {
                status: true,
                message: response.message,
                data: transformKeysToCamel(decryptedDataObject) as T,
            };
        } catch (error) {
            return {
                status: false,
                message: error.message,
            };
        }
    }

    /**
     * GET请求
     * @param url 请求地址
     * @param options 请求选项
     */
    public async get<T>(
        url: string,
        options?: Omit<RequestOptions, 'url' | 'method' | 'data'>,
    ): Promise<Response<T>> {
        // 转换参数键名为蛇形
        if (options?.params) {
            options.params = transformKeysToSnake(options.params);
        }

        const config = await this.applyRequestInterceptors({
            url,
            method: Method.GET,
            ...options,
        });

        if (options?.encrypt) {
            return this.baseRequestWithEncrypt<T>(config);
        } else {
            return this.baseRequest<T>(config);
        }
    }

    /**
     * POST请求
     * @param url 请求地址
     * @param data 请求数据
     * @param options 请求选项
     */
    public async post<T>(
        url: string,
        data?: Record<string, any>,
        options?: Omit<RequestOptions, 'url' | 'method' | 'data'>,
    ): Promise<Response<T>> {
        if (data) {
            data = transformKeysToSnake(data);
        }

        if (options?.params) {
            options.params = transformKeysToSnake(options.params);
        }

        const config = await this.applyRequestInterceptors({
            url,
            method: Method.POST,
            data,
            ...options,
        });

        if (false && options?.encrypt) {
            return this.baseRequestWithEncrypt<T>(config);
        } else {
            return this.baseRequest<T>(config);
        }
    }

    static _instance: Http;
    static get instance(): Http {
        if (!this._instance) {
            this._instance = new Http(config.SERVER_URL);
        }
        return this._instance;
    }
}
