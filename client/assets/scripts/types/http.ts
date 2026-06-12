import { IState } from './state';

/**
 * 请求方法
 */
export enum Method {
    GET = 'GET',
    POST = 'POST',
}

/**
 * 请求选项
 */
export interface RequestOptions {
    /**
     * 请求地址
     */
    url: string;
    /**
     * 请求方法
     */
    method?: Method;
    /**
     * 请求头
     */
    headers?: Record<string, string>;
    /**
     * 请求数据
     */
    data?: Record<string, any>;
    /**
     * 查询参数
     */
    params?: Record<string, any>;
    /**
     * 超时时间（毫秒）
     */
    timeout?: number;
    /**
     * 重试次数
     */
    retries?: number;
    /**
     * 是否加密
     */
    encrypt?: boolean;
}

/**
 * 原始响应数据
 */
export interface Response<T = any> {
    /**
     * 状态
     */
    status: boolean;
    /**
     * 错误信息
     */
    message: string;
    /**
     * 响应数据
     */
    data?: T;
    /**
     * 额外信息
     */
    extra?: {
        /**
         * 是否显示错误信息
         */
        show: boolean;
    }
}

/**
 * 请求拦截器
 */
export interface RequestInterceptor {
    onFulfilled?: (config: RequestOptions) => RequestOptions | Promise<RequestOptions>;
    onRejected?: (error: any) => any;
}

/**
 * 响应拦截器
 */
export interface ResponseInterceptor {
    onFulfilled?: <T>(response: Response<T>) => Response<T> | Promise<Response<T>>;
    onRejected?: (error: any) => any;
}

/**
 * 分页数据响应
 */
export interface IPageResponse<T> {
    /**
     * 总条数
     */
    count: number;
    /**
     * 列表数据
     */
    list: T[];
    /**
     * 当前页码
     */
    pageNo: number;
    /**
     * 每页条数
     */
    pageSize: number;
    /**
     * 总页数
     */
    pages: number;
}

/**
 * 分页请求参数
 */
export interface IPageRequest {
    /**
     * 当前页码
     */
    pageNo: number;
    /**
     * 每页条数
     */
    pageSize: number;
    /**
     * 过滤条件
     */
    filter?: Record<string, any[]>;
    /**
     * 排序字段
     */
    orderBy?: string[];
    /**
     * 分组字段
     */
    groupBy?: string[];
    /**
     * 分组条件
     */
    having?: Record<string, any[]>;
}
