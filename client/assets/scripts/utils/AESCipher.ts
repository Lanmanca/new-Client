import forge from 'node-forge';

/**
 * 与 server/internal/helper 一致：
 * - 内层 AES-GCM + PBKDF2(100000, SHA-256, 32B)
 * - 外层字节包：packed[2*i]=random[i], packed[2*i+1]=inner[i]；密钥材料 MD5(UTF8(deviceId)||random)
 * - JSON 传输：StdBase64(packed)
 */
export class AESCipher {
    private static fillRandomBytes(out: Uint8Array): void {
        if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
            globalThis.crypto.getRandomValues(out);
        } else {
            for (let i = 0; i < out.length; i++) out[i] = Math.floor(Math.random() * 256);
        }
    }

    private static toBase64(bytes: Uint8Array): string {
        const binary = String.fromCharCode.apply(null, Array.from(bytes));
        return btoa(binary);
    }

    private static fromBase64(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    private static uint8ArrayToForgeBytes(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    private static forgeBytesToUint8Array(binary: string): Uint8Array {
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /** 内层 [salt16][iv12][cipher+tag]，与 EncryptToBytes 一致 */
    private static encryptInner(data: string, keyMaterial: string): Uint8Array {
        const salt = new Uint8Array(16);
        const iv = new Uint8Array(12);
        this.fillRandomBytes(salt);
        this.fillRandomBytes(iv);

        const keyBytes = forge.util.createBuffer(keyMaterial, 'utf8').getBytes();
        const saltBytes = this.uint8ArrayToForgeBytes(salt);
        const derivedKeyBytes = forge.pkcs5.pbkdf2(
            keyBytes,
            saltBytes,
            100000,
            32,
            forge.md.sha256.create()
        );

        const ivBytes = this.uint8ArrayToForgeBytes(iv);
        const cipher = forge.cipher.createCipher('AES-GCM', derivedKeyBytes);
        cipher.start({
            iv: ivBytes,
            additionalData: '',
            tagLength: 128,
        });
        cipher.update(forge.util.createBuffer(data, 'utf8'));
        cipher.finish();

        const ciphertextBytes = cipher.output.getBytes();
        const tagBytes = cipher.mode.tag.getBytes();
        const combinedCiphertext = ciphertextBytes + tagBytes;
        const combinedCiphertextUint8 = this.forgeBytesToUint8Array(combinedCiphertext);

        const result = new Uint8Array(salt.length + iv.length + combinedCiphertextUint8.length);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(combinedCiphertextUint8, salt.length + iv.length);
        return result;
    }

    private static decryptInner(encrypted: Uint8Array, keyMaterial: string): string {
        const salt = encrypted.slice(0, 16);
        const iv = encrypted.slice(16, 28);
        const combinedCiphertext = encrypted.slice(28);

        const keyBytes = forge.util.createBuffer(keyMaterial, 'utf8').getBytes();
        const saltBytes = this.uint8ArrayToForgeBytes(salt);
        const derivedKeyBytes = forge.pkcs5.pbkdf2(
            keyBytes,
            saltBytes,
            100000,
            32,
            forge.md.sha256.create()
        );

        const ivBytes = this.uint8ArrayToForgeBytes(iv);
        const combinedBytes = this.uint8ArrayToForgeBytes(combinedCiphertext);
        const tagLength = 16;
        const ciphertextBytes = combinedBytes.slice(0, -tagLength);
        const tagBytes = combinedBytes.slice(-tagLength);

        const decipher = forge.cipher.createDecipher('AES-GCM', derivedKeyBytes);
        decipher.start({
            iv: ivBytes,
            additionalData: '',
            tag: forge.util.createBuffer(tagBytes),
            tagLength: 128,
        });
        decipher.update(forge.util.createBuffer(ciphertextBytes));
        if (!decipher.finish()) {
            return '';
        }
        return decipher.output.toString();
    }

    private static md5DevicePlusRandom(deviceId: string, random: Uint8Array): string {
        const dev = new TextEncoder().encode(deviceId);
        const combined = new Uint8Array(dev.length + random.length);
        combined.set(dev);
        combined.set(random, dev.length);
        const md = forge.md.md5.create();
        md.update(this.uint8ArrayToForgeBytes(combined));
        return md.digest().toHex();
    }

    private static mergeInterleaveBytes(random: Uint8Array, inner: Uint8Array): Uint8Array {
        const n = inner.length;
        if (random.length !== n) {
            throw new Error('interleave length mismatch');
        }
        const out = new Uint8Array(2 * n);
        for (let i = 0; i < n; i++) {
            out[2 * i] = random[i];
            out[2 * i + 1] = inner[i];
        }
        return out;
    }

    private static splitInterleaveBytes(packed: Uint8Array): { random: Uint8Array; inner: Uint8Array } {
        if (packed.length % 2 !== 0) {
            throw new Error('invalid packed length');
        }
        const n = packed.length / 2;
        const random = new Uint8Array(n);
        const inner = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            random[i] = packed[2 * i];
            inner[i] = packed[2 * i + 1];
        }
        return { random, inner };
    }

    /**
     * 返回字节交错包（长度 2*L），第二个参数为设备 ID（与请求头 X-Device-ID 一致）
     */
    public static encrypt(data: string, deviceId: string): Uint8Array {
        if (!deviceId) {
            throw new Error('empty device id');
        }
        const dummy = this.encryptInner(data, '0');
        const L = dummy.length;
        const random = new Uint8Array(L);
        this.fillRandomBytes(random);
        const keyMaterial = this.md5DevicePlusRandom(deviceId, random);
        const inner = this.encryptInner(data, keyMaterial);
        if (inner.length !== L) {
            throw new Error(`cipher length changed: ${inner.length} vs ${L}`);
        }
        return this.mergeInterleaveBytes(random, inner);
    }

    /**
     * 解 encrypt 产生的字节包
     */
    public static decrypt(packed: Uint8Array, deviceId: string): string {
        const { random, inner } = this.splitInterleaveBytes(packed);
        const keyMaterial = this.md5DevicePlusRandom(deviceId, random);
        return this.decryptInner(inner, keyMaterial);
    }

    /** StdBase64(encrypt(...))，供 JSON 字段 encrypt 使用 */
    public static encryptToBase64(data: string, deviceId: string): string {
        return this.toBase64(this.encrypt(data, deviceId));
    }

    public static decryptFromBase64(encrypted: string, deviceId: string): string {
        return this.decrypt(this.fromBase64(encrypted), deviceId);
    }
}
