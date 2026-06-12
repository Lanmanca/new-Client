package helper

import "star"

// Layer 弹窗类型
type Layer string

const (
	LayerMessage Layer = "message" // 消息弹窗，位于顶部出现，用于轻提示
	LayerAlert   Layer = "alert"   // 带确认按钮的模态框
	LayerConfirm Layer = "confirm" // 带确认和取消按钮的模态框
)

// ResponseOption 响应选项
type ResponseOption struct {
	Show  bool  `json:"show"`  // 是否显示响应内容
	Layer Layer `json:"layer"` // 弹窗类型，默认为 message
}

// PageParam 分页参数
type PageParam struct {
	PageNo   int            `json:"page_no"`   // 当前页码
	PageSize int            `json:"page_size"` // 每页条数
	Filter   map[string]any `json:"filter"`    // 过滤条件
	OrderBy  []string       `json:"order_by"`  // 排序字段
	GroupBy  []string       `json:"group_by"`  // 分组字段
	Having   map[string]any `json:"having"`    // 分组条件
}

// Validate 校验分页参数
func (p *PageParam) Validate(ctx *star.Context) error {
	if p.PageNo < 1 {
		p.PageNo = 1
	}
	if p.PageSize < 1 {
		p.PageSize = 20
	}
	return nil
}

// PageResponse 分页响应
type PageResponse struct {
	PageNo   int `json:"page_no"`   // 当前页码
	PageSize int `json:"page_size"` // 每页条数
	Count    int `json:"count"`     // 总条数
	Pages    int `json:"pages"`     // 总页数
	List     any `json:"list"`      // 列表数据
}

// Success 成功响应
func Success(message string, data any, options ...*ResponseOption) *star.Response {
	var extra *ResponseOption
	if len(options) > 0 {
		extra = options[0]
		if extra.Show {
			extra.Layer = LayerMessage
		}
	}

	response := &star.Response{
		Status:  true,
		Message: message,
		Data:    data,
	}

	if extra != nil {
		response.Extra = extra
	}

	return response
}

// Fail 失败响应
func Fail(message string, options ...*ResponseOption) *star.Response {
	var extra *ResponseOption
	if len(options) > 0 {
		extra = options[0]
		if extra.Show {
			extra.Layer = LayerMessage
		}
	}

	response := &star.Response{
		Status:  false,
		Message: message,
	}

	if extra != nil {
		response.Extra = extra
	}

	return response
}

// SuccessWithShow 成功响应，并显示响应内容
func SuccessWithShow(message string, data any, layer ...Layer) *star.Response {
	var extra = &ResponseOption{Show: true, Layer: LayerMessage}
	if len(layer) > 0 {
		extra.Layer = Layer(layer[0])
	}
	return Success(message, data, extra)
}

// FailWithShow 失败响应，并显示响应内容
func FailWithShow(message string, layer ...Layer) *star.Response {
	var extra = &ResponseOption{Show: true, Layer: LayerMessage}
	if len(layer) > 0 {
		extra.Layer = Layer(layer[0])
	}
	return Fail(message, extra)
}
