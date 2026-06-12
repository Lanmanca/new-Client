package utils

import (
	crand "crypto/rand"
)

// RandomString 使用 crypto/rand 生成长度为 n 的字母数字串，可选是否包含特殊字符
func RandomString(n int, hasSpecial ...bool) (string, error) {
	if n <= 0 {
		return "", nil
	}
	var charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

	// 如果包含特殊字符
	if len(hasSpecial) > 0 && hasSpecial[0] {
		charset += "!@#$%^&*()_+-=[]{}|;:,.<>?"
	}

	raw := make([]byte, n)
	if _, err := crand.Read(raw); err != nil {
		return "", err
	}
	for i := range raw {
		raw[i] = charset[int(raw[i])%len(charset)]
	}
	return string(raw), nil
}
