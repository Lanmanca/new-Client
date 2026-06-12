package helper

import (
	"server/internal/utils"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword 哈希密码
func HashPassword(password string) (string, string, error) {
	salt, err := utils.RandomString(16)
	if err != nil {
		return "", "", err
	}

	hashedPassword := utils.MD5(password + salt)
	hashedPasswordBytes := []byte(hashedPassword)
	newHashedPassword, err := bcrypt.GenerateFromPassword(hashedPasswordBytes, bcrypt.DefaultCost)
	if err != nil {
		return "", "", err
	}

	return string(newHashedPassword), salt, nil
}

// VerifyPassword 验证密码
func VerifyPassword(password, salt, hash string) bool {
	hashedPassword := utils.MD5(password + salt)
	hashedPasswordBytes := []byte(hashedPassword)
	err := bcrypt.CompareHashAndPassword([]byte(hash), hashedPasswordBytes)
	if err != nil {
		return false
	}
	return true
}
