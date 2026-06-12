package utils

import (
	"encoding/json"
	"sort"
)

// 接收一个JSON字符串，将JSON字符串中的key按照首字母进行排序
func SortJSON(jsonStr string) (string, error) {
	// 解析JSON字符串到map
	var data map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return "", err
	}

	// 获取所有的key并排序
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	// 按照排序后的key重新构建map
	sortedData := make(map[string]any)
	for _, key := range keys {
		sortedData[key] = data[key]
	}

	// 将排序后的map转换回JSON字符串
	result, err := json.Marshal(sortedData)
	if err != nil {
		return "", err
	}

	return string(result), nil
}
