package helper

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateJWT 生成 JWT
// data 必须是可 JSON 序列化的结构体或结构体指针
func GenerateJWT[T any](data T) (string, error) {
	secret := Config.JWT.Secret
	expiresIn := Config.JWT.ExpiresIn

	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	claims := jwt.MapClaims{
		"data": string(jsonData),
		"exp":  time.Now().Add(time.Duration(expiresIn) * time.Second).Unix(),
		"iat":  time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ParseJWT 解析 JWT
func ParseJWT[T any](tokenString string) (T, error) {
	var data T
	secret := Config.JWT.Secret
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return data, err
	}

	if !token.Valid {
		return data, errors.New("invalid token")
	}

	claims := token.Claims.(jwt.MapClaims)

	err = json.Unmarshal([]byte(claims["data"].(string)), &data)
	if err != nil {
		return data, err
	}

	return data, nil
}

// VerifyJWT 验证 JWT
func VerifyJWT(tokenString string) bool {
	_, err := ParseJWT[any](tokenString)
	if err != nil {
		return false
	}
	return true
}
