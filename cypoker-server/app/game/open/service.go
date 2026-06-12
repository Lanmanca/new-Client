package open

import (
	"server/internal/helper"
	"star"
)

type Service struct {
	repo *Repository
}

func NewService() *Service {
	return &Service{repo: NewRepository()}
}

// GetAppVersion 获取应用版本（最新版本）
func (s *Service) GetAppVersion(ctx *star.Context) *star.Response {
	version, err := s.repo.GetAppVersion()
	if err != nil {
		star.Log.E("OPEN_SERVICE", "GetAppVersion error: %v", err.Error())
		return helper.FailWithShow("APP_VERSION_ERROR")
	}
	return helper.Success("APP_VERSION_SUCCESS", map[string]any{
		"app_version": version,
	})
}
