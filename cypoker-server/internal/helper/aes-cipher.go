package helper

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"server/internal/utils"

	"golang.org/x/crypto/pbkdf2"
)

// 使用PBKDF2派生密钥
func getCryptoKey(keyMaterial string, salt []byte) ([]byte, error) {
	// PBKDF2派生密钥，与JS版本保持一致：
	// iterations: 100000, hash: SHA-256, key length: 32 bytes (256 bits)
	key := pbkdf2.Key([]byte(keyMaterial), salt, 100000, 32, sha256.New)
	return key, nil
}

// 将字节数组转换为Base64
func toBase64(bytes []byte) string {
	return base64.StdEncoding.EncodeToString(bytes)
}

// fromBase64 将Base64转换为字节数组
func fromBase64(base64Str string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(base64Str)
}

// Encrypt 加密
// data 需要加密的 JSON 字符串
// key 密钥
// 返回加密后的字符串，base64编码
// 返回错误信息
func Encrypt(data string, key string) (string, error) {
	// 准备明文数据
	plaintext := []byte(data)

	// 生成随机salt (16字节) 和 iv (12字节，AES-GCM推荐)
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}

	// 派生密钥
	cryptoKey, err := getCryptoKey(key, salt)
	if err != nil {
		return "", err
	}

	// 创建AES cipher
	block, err := aes.NewCipher(cryptoKey)
	if err != nil {
		return "", err
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 加密数据
	ciphertext := gcm.Seal(nil, iv, plaintext, nil)

	// 组装结果: [salt] + [iv] + [ciphertext]
	result := make([]byte, 0, len(salt)+len(iv)+len(ciphertext))
	result = append(result, salt...)
	result = append(result, iv...)
	result = append(result, ciphertext...)

	// 返回Base64
	return toBase64(result), nil
}

// Decrypt 解密
// encryptStr 加密字符串，base64编码
// key 密钥
// 返回解密后的 JSON 字符串
// 返回错误信息
func Decrypt(encrypted string, key string) (string, error) {
	// 将Base64转换为字节数组
	encryptedData, err := fromBase64(encrypted)
	if err != nil {
		return "", err
	}

	// 检查数据长度是否足够
	if len(encryptedData) < 28 { // 16(salt) + 12(iv)
		return "", errors.New("encrypted data too short")
	}

	// 解析salt和iv
	salt := encryptedData[:16]
	iv := encryptedData[16:28]
	ciphertext := encryptedData[28:]

	// 派生密钥
	cryptoKey, err := getCryptoKey(key, salt)
	if err != nil {
		return "", err
	}

	// 创建AES cipher
	block, err := aes.NewCipher(cryptoKey)
	if err != nil {
		return "", err
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 解密数据
	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}

	// 返回解码后的字符串
	return string(plaintext), nil
}

// EncryptToBytes 加密数据并返回字节数组
func EncryptToBytes(data string, key string) []byte {
	plaintext := []byte(data)

	// 生成随机salt (16字节) 和 iv (12字节)
	salt := make([]byte, 16)
	iv := make([]byte, 12)
	rand.Read(salt)
	rand.Read(iv)

	// 派生密钥
	cryptoKey, _ := getCryptoKey(key, salt)

	// 创建AES cipher
	block, _ := aes.NewCipher(cryptoKey)
	gcm, _ := cipher.NewGCM(block)

	// 加密数据
	ciphertext := gcm.Seal(nil, iv, plaintext, nil)

	// 组装结果: [salt] + [iv] + [ciphertext]
	result := make([]byte, 0, len(salt)+len(iv)+len(ciphertext))
	result = append(result, salt...)
	result = append(result, iv...)
	result = append(result, ciphertext...)

	return result
}

// DecryptBytes 解密字节数组
func DecryptBytes(encrypted []byte, key string) ([]byte, error) {
	// 检查数据长度
	if len(encrypted) < 28 {
		return nil, errors.New("encrypted data too short")
	}

	// 解析salt和iv
	salt := encrypted[:16]
	iv := encrypted[16:28]
	ciphertext := encrypted[28:]

	// 派生密钥
	cryptoKey, err := getCryptoKey(key, salt)
	if err != nil {
		return nil, err
	}

	// 创建AES cipher
	block, err := aes.NewCipher(cryptoKey)
	if err != nil {
		return nil, err
	}

	// 创建GCM模式
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// 解密数据
	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// mergeInterleaveBytes 与 splitInterleaveBytes 互逆：out[2*i]=random[i], out[2*i+1]=inner[i]
func mergeInterleaveBytes(random, inner []byte) []byte {
	n := len(inner)
	out := make([]byte, 2*n)
	for i := 0; i < n; i++ {
		out[2*i] = random[i]
		out[2*i+1] = inner[i]
	}
	return out
}

func splitInterleaveBytes(packed []byte) (random, inner []byte, err error) {
	if len(packed)%2 != 0 {
		return nil, nil, errors.New("invalid packed length")
	}
	n := len(packed) / 2
	random = make([]byte, n)
	inner = make([]byte, n)
	for i := 0; i < n; i++ {
		random[i] = packed[2*i]
		inner[i] = packed[2*i+1]
	}
	return random, inner, nil
}

// EncryptPackedBytes 设备端字节包：长度 2*L，L 为内层 AES 包长；密钥材料 MD5(deviceID + string(random))
func EncryptPackedBytes(plaintext, deviceID string) ([]byte, error) {
	if deviceID == "" {
		return nil, errors.New("empty device id")
	}
	dummy := EncryptToBytes(plaintext, "0")
	L := len(dummy)
	random := make([]byte, L)
	if _, err := rand.Read(random); err != nil {
		return nil, err
	}
	key := utils.MD5(deviceID + string(random))
	inner := EncryptToBytes(plaintext, key)
	if len(inner) != L {
		return nil, fmt.Errorf("cipher length changed: %d vs %d", len(inner), L)
	}
	return mergeInterleaveBytes(random, inner), nil
}

// DecryptPackedBytes 解 EncryptPackedBytes 产出
func DecryptPackedBytes(packed []byte, deviceID string) (string, error) {
	random, inner, err := splitInterleaveBytes(packed)
	if err != nil {
		return "", err
	}
	key := utils.MD5(deviceID + string(random))
	pt, err := DecryptBytes(inner, key)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}
