package utils

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

// ToString 将任意值转为字符串：nil 为空串；标量与时间有稳定格式；其余优先 JSON，失败则用 fmt.Sprint。
func ToString(v any) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case []byte:
		return string(x)
	case []rune:
		return string(x)
	case bool:
		return strconv.FormatBool(x)
	case int:
		return strconv.FormatInt(int64(x), 10)
	case int8:
		return strconv.FormatInt(int64(x), 10)
	case int16:
		return strconv.FormatInt(int64(x), 10)
	case int32:
		return strconv.FormatInt(int64(x), 10)
	case int64:
		return strconv.FormatInt(x, 10)
	case uint:
		return strconv.FormatUint(uint64(x), 10)
	case uint8:
		return strconv.FormatUint(uint64(x), 10)
	case uint16:
		return strconv.FormatUint(uint64(x), 10)
	case uint32:
		return strconv.FormatUint(uint64(x), 10)
	case uint64:
		return strconv.FormatUint(x, 10)
	case uintptr:
		return strconv.FormatUint(uint64(x), 10)
	case float32:
		return strconv.FormatFloat(float64(x), 'f', -1, 32)
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case time.Time:
		return x.Format(time.RFC3339Nano)
	case json.Number:
		return x.String()
	case error:
		return x.Error()
	case fmt.Stringer:
		return x.String()
	default:
		b, err := json.Marshal(x)
		if err != nil {
			return fmt.Sprint(x)
		}
		return string(b)
	}
}

// MapValuesToString 将 map[string]any 中的值转为字符串
func MapValuesToString(m map[string]any) map[string]string {
	if m == nil {
		return nil
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = ToString(v)
	}
	return out
}
