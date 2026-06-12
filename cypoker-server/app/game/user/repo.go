package user

import (
	"errors"
	"server/internal/helper"
	"time"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

// CreateUser 创建用户
func (r *Repository) CreateUser(user *User) error {
	db := helper.GetDB()
	if err := db.Create(user).Error; err != nil {
		return err
	}
	return nil
}

// GetUserInfo 获取用户信息
func (r *Repository) GetUserInfo(userId string) (*User, error) {
	db := helper.GetDB()
	var user User
	if err := db.Where("user_id = ?", userId).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByDeviceId 根据设备ID获取用户
func (r *Repository) GetUserByDeviceId(deviceId string) (*User, error) {
	db := helper.GetDB()
	var user User
	if err := db.Where("device_id = ?", deviceId).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) GetUserByUserID(userID string) (*User, error) {
	db := helper.GetDB()
	var user User
	if err := db.Where("user_id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) SaveUser(user *User) error {
	db := helper.GetDB()
	return db.Save(user).Error
}

func (r *Repository) TouchLogin(user *User, ip string) error {
	now := time.Now()
	user.LastLoginAt = &now
	user.LastLoginIP = ip
	user.LoginCount += 1
	return r.SaveUser(user)
}

// GetUserList 获取用户列表
// TODO: 添加过滤条件、排序条件
func (r *Repository) GetUserList(param *helper.PageParam) ([]User, int64, error) {
	db := helper.GetDB()
	var users []User
	var total int64
	if err := db.Model(&User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Model(&User{}).Order("id DESC").Offset((param.PageNo - 1) * param.PageSize).Limit(param.PageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// UpdateUserStatus 更新用户状态
func (r *Repository) UpdateUserStatus(userId string) error {
	db := helper.GetDB()

	user, err := r.GetUserInfo(userId)
	if err != nil {
		return err
	}
	if user.Status == 0 {
		user.Status = 1
	} else {
		user.Status = 0
	}
	if err := db.Save(user).Error; err != nil {
		return err
	}
	return nil
}

// UpdateUserIsVip 更新用户特权
func (r *Repository) UpdateUserIsVip(userId string) error {
	db := helper.GetDB()

	user, err := r.GetUserInfo(userId)
	if err != nil {
		return err
	}
	if user.IsVip == 0 {
		user.IsVip = 1
	} else {
		user.IsVip = 0
	}
	if err := db.Save(user).Error; err != nil {
		return err
	}
	return nil
}

// UpdateUserLevel 更新用户等级
func (r *Repository) UpdateUserLevel(userId string, experience int) error {
	db := helper.GetDB()

	user, err := r.GetUserInfo(userId)
	if err != nil {
		return err
	}

	if user.NextLevelExperience <= 0 {
		user.NextLevelExperience = 1000 // 1000 为初始经验
	}

	user.Experience += experience
	for user.Experience >= user.NextLevelExperience {
		user.Experience -= user.NextLevelExperience
		prevNeed := user.NextLevelExperience
		user.Level++
		user.NextLevelExperience = prevNeed * 2 * user.Level
	}

	if err := db.Save(user).Error; err != nil {
		return err
	}

	return nil
}

// UpdateUserWallet 更新用户钱包
func (r *Repository) UpdateUserWallet(userId string, amount float64) error {
	db := helper.GetDB()

	user, err := r.GetUserInfo(userId)
	if err != nil {
		return err
	}

	if amount < 0 && user.Wallet+amount < 0 {
		return errors.New("USER_WALLET_NOT_ENOUGH")
	}
	user.Wallet += amount
	if err := db.Save(user).Error; err != nil {
		return err
	}
	return nil
}
