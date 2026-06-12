package admin

import (
	"server/internal/helper"
	"star"
)

type Service struct {
	repo *Repository
}

func NewService() *Service {
	repo := NewRepository()
	return &Service{repo: repo}
}

// Login 登录
func (s *Service) Login(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*LoginDTO)
	admin, err := s.repo.GetAdminByUsername(in.Username)
	if err != nil {
		return helper.FailWithShow("USER_NOT_FOUND")
	}

	if admin.Status != 1 {
		return helper.FailWithShow("USER_DISABLED")
	}

	if !helper.VerifyPassword(in.Password, admin.Salt, admin.Password) {
		return helper.FailWithShow("USER_OR_PASSWORD_INVALID")
	}

	userInfo := &UserInfo{
		ID:       admin.ID,
		Username: admin.Username,
		Nickname: admin.Nickname,
		Avatar:   admin.Avatar,
		Email:    admin.Email,
		Phone:    admin.Phone,
	}

	token, err := helper.GenerateJWT(*userInfo)
	if err != nil {
		return helper.FailWithShow("TOKEN_GENERATE_ERROR")
	}

	expires := helper.Config.JWT.ExpiresIn
	ctx.SetCookie("token", token, expires)

	return helper.SuccessWithShow("LOGIN_SUCCESS", userInfo)
}

// CreateAdmin 创建管理员
func (s *Service) CreateAdmin(ctx *star.Context) *star.Response {
	in := ctx.GetBodyModel().(*CreateAdminDTO)
	// 加密密码
	hashedPassword, salt, err := helper.HashPassword(in.Password)
	if err != nil {
		return helper.FailWithShow("INTERNAL_SERVER_ERROR")
	}

	admin := &Admin{
		Username: in.Username,
		Password: hashedPassword,
		Salt:     salt,
		Nickname: in.Nickname,
		Avatar:   in.Avatar,
		Email:    in.Email,
		Phone:    in.Phone,
		Status:   in.Status,
		RoleID:   in.RoleID,
	}

	if err := s.repo.CreateAdmin(admin); err != nil {
		return helper.FailWithShow("CREATE_USER_ERROR")
	}

	return helper.SuccessWithShow("CREATE_USER_SUCCESS", admin)
}
