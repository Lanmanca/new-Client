package open

import "server/internal/helper"

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

// GetAppInfo 获取应用信息（最新版本）
func (r *Repository) GetAppInfo() (*AppInfo, error) {
	db := helper.GetDB()
	var appInfo AppInfo
	if err := db.Model(&AppInfo{}).Where("status = ?", 1).Order("created_at DESC").First(&appInfo).Error; err != nil {
		return nil, err
	}
	return &appInfo, nil
}

// CreateAppInfo 创建应用
func (r *Repository) CreateAppInfo(appInfo *AppInfo) error {
	db := helper.GetDB()
	if err := db.Create(appInfo).Error; err != nil {
		return err
	}
	return nil
}

// UpdateAppInfo 更新应用
func (r *Repository) UpdateAppInfo(appInfo *AppInfo) error {
	db := helper.GetDB()
	if err := db.Model(&AppInfo{}).Where("id = ?", appInfo.ID).Updates(appInfo).Error; err != nil {
		return err
	}
	return nil
}

// DeleteAppInfo 删除应用
func (r *Repository) DeleteAppInfo(id int64) error {
	db := helper.GetDB()
	if err := db.Model(&AppInfo{}).Where("id = ?", id).Delete(&AppInfo{}).Error; err != nil {
		return err
	}
	return nil
}

// UpdateAppInfoStatus 更新应用状态（0-禁用,1-正常）
func (r *Repository) UpdateAppInfoStatus(id int64, status int) error {
	db := helper.GetDB()
	if err := db.Model(&AppInfo{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		return err
	}
	return nil
}

// GetAppVersion 获取应用版本（最新版本）
func (r *Repository) GetAppVersion() (string, error) {
	appInfo, err := r.GetAppInfo()
	if err != nil {
		return "", err
	}
	return appInfo.Version, nil
}
