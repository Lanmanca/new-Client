/// 对于需要解密的请求，只要有参数（query或body），任意一个不含"encrypt"参数或“encrypt”值或类型不正确，则返回400错误，且不返回错误信息

package guard

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"server/internal/helper"
	"server/internal/utils"
	"star"
	"strings"
)

// EncryptWithInterleave HTTP/JSON 侧 wire：StdBase64(EncryptPackedBytes)；内层为字节交错包
func EncryptWithInterleave(plaintext, deviceID string) (string, error) {
	if deviceID == "" {
		return "", errors.New("empty device id")
	}
	packed, err := helper.EncryptPackedBytes(plaintext, deviceID)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(packed), nil
}

func decryptWireEncrypt(encryptStr, deviceID string) (string, error) {
	packed, err := base64.StdEncoding.DecodeString(encryptStr)
	if err != nil {
		return "", err
	}
	return helper.DecryptPackedBytes(packed, deviceID)
}

// DecryptRequestBody 解密请求参数
func DecryptRequestBody() star.BeforeRouteGuard {
	return func(ctx *star.Context) *star.Response {
		encrypt := ctx.GetMeta("encrypt")

		if encrypt == nil || encrypt == false {
			return nil
		}

		queryAll := ctx.GetQueries()
		bodyAll := ctx.GetBodyAll()

		// 如果查询参数和请求体都为空，说明没有需要解密的数据，让DTO验证去处理
		if len(queryAll) == 0 && len(bodyAll) == 0 {
			return nil
		}

		// 获取加密密钥，加密密钥即设备ID
		deviceID := ctx.GetRequestHeader("X-Device-ID")

		// 解密查询参数
		if len(queryAll) > 0 {
			encrypt, ok := queryAll["encrypt"]
			if !ok {
				star.Log.W("CRYPT", "Encrypt is not set, request id: %s", ctx.RequestID)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			encryptStr, ok := encrypt.(string)
			if !ok || strings.TrimSpace(encryptStr) == "" {
				star.Log.W("CRYPT", "Encrypt is not valid, request id: %s", ctx.RequestID)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			decryptStr, err := decryptWireEncrypt(encryptStr, deviceID)
			if err != nil {
				star.Log.W("CRYPT", "Decrypt failed, request id: %s, error: %v", ctx.RequestID, err.Error())
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			decryptMap := make(map[string]any)
			err = json.Unmarshal([]byte(decryptStr), &decryptMap)
			if err != nil {
				star.Log.W("CRYPT", "Unmarshal failed, request id: %s, error: %v", ctx.RequestID, err.Error())
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			newDecryptMap := utils.MapValuesToString(decryptMap)
			ctx.SetQueries(newDecryptMap)
		}

		// 解密请求体
		if len(bodyAll) > 0 {
			encrypt, ok := bodyAll["encrypt"]
			if !ok {
				star.Log.W("CRYPT", "Encrypt is not set, request id: %s", ctx.RequestID)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			encryptStr, ok := encrypt.(string)
			if !ok || strings.TrimSpace(encryptStr) == "" {
				star.Log.W("CRYPT", "Encrypt is not valid, request id: %s", ctx.RequestID)
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			decryptStr, err := decryptWireEncrypt(encryptStr, deviceID)
			if err != nil {
				star.Log.W("CRYPT", "Decrypt failed, request id: %s, error: %v", ctx.RequestID, err.Error())
				ctx.ResponseError(http.StatusBadRequest)
				return nil
			}

			ctx.SetBody(decryptStr)
		}

		return nil
	}
}

// EncryptResponseBody 加密响应数据
func EncryptResponseBody() star.AfterRouteGuard {
	return func(ctx *star.Context, resp *star.Response) *star.Response {
		encrypt := ctx.GetMeta("encrypt")

		if encrypt == nil || encrypt == false {
			return nil
		}

		// 如果响应数据为空，则不进行加密
		if resp.Data == nil || strings.TrimSpace(fmt.Sprintf("%v", resp.Data)) == "" {
			return nil
		}

		deviceID := ctx.GetRequestHeader("X-Device-ID")

		bodyJson, err := json.Marshal(resp.Data)
		if err != nil {
			star.Log.E("ENCRYPT", "Marshal response data failed: %v", err.Error())
			ctx.ResponseError(http.StatusInternalServerError)
			return nil
		}
		body, err := EncryptWithInterleave(string(bodyJson), deviceID)
		if err != nil {
			star.Log.E("ENCRYPT", "Encrypt response body failed: %v", err.Error())
			ctx.ResponseError(http.StatusInternalServerError)
			return nil
		}
		resp.Data = map[string]any{"encrypt": body}
		ctx.SetHeader("X-Encrypt", "true")
		return nil
	}
}

func init() {
	helper.RegisterBeforeGuard(DecryptRequestBody())
	helper.RegisterAfterGuard(EncryptResponseBody())
}
