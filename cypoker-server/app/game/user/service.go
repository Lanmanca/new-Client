package user

import (
	"fmt"
	"strings"

	"server/internal/helper"
	"star"
)

type Service struct {
	repo *Repository
}

func NewService() *Service {
	return &Service{repo: NewRepository()}
}

func requireUserID(raw string) (string, bool) {
	userID := strings.TrimSpace(raw)
	return userID, userID != ""
}

// Register 注册用户
func (s *Service) Register(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*RegisterDTO)
	existing, _ := s.repo.GetUserByUserID(in.UserId)
	if existing != nil {
		return helper.FailWithShow("USER_ALREADY_EXISTS")
	}
	user := &User{
		UserId:    in.UserId,
		DeviceId:  in.UserId,
		Nickname:  in.Nickname,
		AvatarUrl: in.AvatarUrl,
		Level:     0,
		Wallet:    99999,
		Status:    1,
	}
	if err := s.repo.CreateUser(user); err != nil {
		return helper.FailWithShow("USER_REGISTER_FAILED")
	}
	_ = s.repo.TouchLogin(user, "")
	return helper.Success("USER_REGISTER_SUCCESS", user)
}

// Login 登录
func (s *Service) Login(ctx *star.Context) *star.Response {
	userId := strings.TrimSpace(ctx.GetRequestHeader("X-User-ID"))
	if userId == "" {
		return helper.FailWithShow("USER_ID_REQUIRED")
	}
	user, err := s.repo.GetUserByUserID(userId)
	if err != nil || user == nil {
		return helper.FailWithShow("USER_NOT_FOUND")
	}
	_ = s.repo.TouchLogin(user, "")
	return helper.Success("USER_LOGIN_SUCCESS", user)
}

func (s *Service) LoginTelegram(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*TelegramLoginDTO)
	tgUser, err := verifyTelegramInitData(in.InitData, telegramInitDataMaxAgeSec())
	if err != nil {
		return helper.FailWithShow(err.Error())
	}
	deviceID := fmt.Sprintf("tg_%d", tgUser.ID)
	user, err := s.repo.GetUserByDeviceId(deviceID)
	if err != nil || user == nil {
		user = &User{
			UserId:      deviceID,
			DeviceId:    deviceID,
			Nickname:    strings.TrimSpace(strings.TrimSpace(tgUser.FirstName + " " + tgUser.LastName)),
			AvatarUrl:   tgUser.PhotoURL,
			Level:       0,
			Wallet:      0,
			Status:      1,
			LastLoginAt: nil,
			LastLoginIP: "",
			LoginCount:  0,
		}
		if user.Nickname == "" {
			if strings.TrimSpace(tgUser.Username) != "" {
				user.Nickname = tgUser.Username
			} else {
				user.Nickname = fmt.Sprintf("tg_%d", tgUser.ID)
			}
		}
		if err := s.repo.CreateUser(user); err != nil {
			return helper.FailWithShow("USER_TELEGRAM_LOGIN_FAILED")
		}
	} else {
		changed := false
		if strings.TrimSpace(user.AvatarUrl) != strings.TrimSpace(tgUser.PhotoURL) && strings.TrimSpace(tgUser.PhotoURL) != "" {
			user.AvatarUrl = tgUser.PhotoURL
			changed = true
		}
		newNickname := strings.TrimSpace(strings.TrimSpace(tgUser.FirstName + " " + tgUser.LastName))
		if newNickname == "" {
			newNickname = strings.TrimSpace(tgUser.Username)
		}
		if newNickname != "" && strings.TrimSpace(user.Nickname) != newNickname {
			user.Nickname = newNickname
			changed = true
		}
		if changed {
			_ = s.repo.SaveUser(user)
		}
	}
	_ = s.repo.TouchLogin(user, "")
	return helper.Success("USER_LOGIN_SUCCESS", user)
}

// GetUserInfo 获取用户信息
func (s *Service) GetUserInfo(ctx *star.Context) *star.Response {
	userId, ok := requireUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}

	user, err := s.repo.GetUserInfo(userId)
	if err != nil {
		return helper.FailWithShow("USER_NOT_FOUND")
	}

	return helper.Success("USER_GET_SUCCESS", user)
}

// UpdateUserStatus 更新用户状态
func (s *Service) UpdateUserStatus(ctx *star.Context) *star.Response {
	userId, ok := requireUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	if err := s.repo.UpdateUserStatus(userId); err != nil {
		return helper.FailWithShow("USER_UPDATE_STATUS_FAILED")
	}
	return helper.SuccessWithShow("USER_UPDATE_STATUS_SUCCESS", nil)
}

// UpdateUserIsVip 更新用户特权
func (s *Service) UpdateUserIsVip(ctx *star.Context) *star.Response {
	userId, ok := requireUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	if err := s.repo.UpdateUserIsVip(userId); err != nil {
		return helper.FailWithShow("USER_UPDATE_IS_VIP_FAILED")
	}
	return helper.SuccessWithShow("USER_UPDATE_IS_VIP_SUCCESS", nil)
}

// UpdateUserLevel 更新用户等级
func (s *Service) UpdateUserLevel(ctx *star.Context) *star.Response {
	userId, ok := requireUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	in := ctx.GetBodyModel().(*UpdateUserLevelDTO)

	if err := s.repo.UpdateUserLevel(userId, in.Experience); err != nil {
		return helper.FailWithShow("USER_UPDATE_LEVEL_FAILED")
	}
	return helper.SuccessWithShow("USER_UPDATE_LEVEL_SUCCESS", nil)
}

// GetUserList 用户分页列表
func (s *Service) GetUserList(ctx *star.Context) *star.Response {
	param := ctx.GetBodyModel().(*helper.PageParam)
	users, total, err := s.repo.GetUserList(param)
	if err != nil {
		return helper.FailWithShow("GET_USER_LIST_FAILED")
	}
	pages := int((total + int64(param.PageSize) - 1) / int64(param.PageSize))
	data := helper.PageResponse{
		PageNo:   param.PageNo,
		PageSize: param.PageSize,
		Count:    int(total),
		Pages:    pages,
		List:     users,
	}
	return helper.Success("GET_USER_LIST_SUCCESS", data)
}

// UpdateUserWallet 更新用户钱包，传入负数表示扣除
func (s *Service) UpdateUserWallet(ctx *star.Context) *star.Response {
	userId, ok := requireUserID(ctx.GetRequestHeader("X-User-ID"))
	if !ok {
		return helper.FailWithShow("USER_TELEGRAM_ONLY")
	}
	in := ctx.GetBodyModel().(*UpdateUserWalletDTO)

	if err := s.repo.UpdateUserWallet(userId, in.Amount); err != nil {
		return helper.FailWithShow("USER_UPDATE_WALLET_FAILED")
	}
	return helper.SuccessWithShow("USER_UPDATE_WALLET_SUCCESS", nil)
}
