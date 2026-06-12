import { i18n } from '@/manager';

/**
 * 将服务端返回的错误码（如 INSUFFICIENT_STACK_TO_READY）转为语言包文案。
 * 键名：zh.json 中 `server_error.<CODE>`；无翻译时回退为原码。
 */
export function tServerErrorMessage(code: string | undefined | null): string {
    const c = typeof code === 'string' ? code.trim() : '';
    if (!c) return '';
    const text = i18n.t(`server_error.${c}`);
    return text || c;
}
