package admin

import (
	"server/internal/helper"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

// GetAdminByUsername 根据用户名获取用户
func (r *Repository) GetAdminByUsername(username string) (*Admin, error) {
	db := helper.GetDB()

	var admin Admin
	if err := db.Where("username = ?", username).First(&admin).Error; err != nil {
		return nil, err
	}
	return &admin, nil
}

// CreateAdmin 创建管理员
func (r *Repository) CreateAdmin(admin *Admin) error {
	db := helper.GetDB()

	if err := db.Create(admin).Error; err != nil {
		return err
	}

	return nil
}
