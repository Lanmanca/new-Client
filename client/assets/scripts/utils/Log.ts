import { formatDate } from './index';

/**
 * Log Util
 */
export default class Log {
    // Log
    private static log(level: 'D' | 'I' | 'W' | 'E', tag: string, msg: string) {
        const timestamp = formatDate(Date.now(), true);
        const logMessage = `[${timestamp}] [${level}] [${tag}] ${msg}`;

        switch (level) {
            case 'D':
                console.log(`%c${logMessage}`, 'color: #9E9E9E; font-weight: normal;');
                break;
            case 'I':
                console.log(`%c${logMessage}`, 'color: #2196F3; font-weight: bold;');
                break;
            case 'W':
                console.log(`%c${logMessage}`, 'color: #FF9800; font-weight: bold;');
                break;
            case 'E':
                console.log(`%c${logMessage}`, 'color: #F44336; font-weight: bold;');
                break;
        }
    }

    /**
     * Debug
     */
    static d(tag: string, msg: string) {
        this.log('D', tag, msg);
    }

    /**
     * Info
     */
    static i(tag: string, msg: string) {
        this.log('I', tag, msg);
    }

    /**
     * Warning
     */
    static w(tag: string, msg: string) {
        this.log('W', tag, msg);
    }

    /**
     * Error
     */
    static e(tag: string, msg: string) {
        this.log('E', tag, msg);
    }
}
