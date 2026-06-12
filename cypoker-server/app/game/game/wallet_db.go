package game

import (
	"errors"
	"fmt"
	"server/internal/helper"

	"gorm.io/gorm"
)

var (
	ErrInsufficientOffTableBalance = errors.New("INSUFFICIENT_OFF_TABLE_BALANCE")
	ErrDatabaseUnavailable         = errors.New("DATABASE_UNAVAILABLE")
)

// dbOffTableBalance 账外余额（game_users.wallet）。
func dbOffTableBalance(userID string) (float64, error) {
	if userID == "" {
		return 0, nil
	}
	db := helper.GetDB()
	if db == nil {
		return 0, ErrDatabaseUnavailable
	}
	var row struct {
		Wallet float64 `gorm:"column:wallet"`
	}
	err := db.Table("game_users").Select("wallet").Where("user_id = ?", userID).Take(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrInsufficientOffTableBalance
		}
		return 0, err
	}
	return row.Wallet, nil
}

// dbSubtractOffTable 从账外扣除；余额不足则失败。
func dbSubtractOffTable(userID string, amount float64) error {
	if userID == "" || amount <= chipEps {
		return nil
	}
	db := helper.GetDB()
	if db == nil {
		return ErrDatabaseUnavailable
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var row struct {
			Wallet float64 `gorm:"column:wallet"`
		}
		if err := tx.Table("game_users").Select("wallet").Where("user_id = ?", userID).Take(&row).Error; err != nil {
			return err
		}
		w := row.Wallet
		if w+chipEps < amount {
			return ErrInsufficientOffTableBalance
		}
		return tx.Table("game_users").Where("user_id = ?", userID).Update("wallet", w-amount).Error
	})
}

// dbAddOffTable 向账外增加（桌上退回）。
func dbAddOffTable(userID string, amount float64) error {
	if userID == "" || amount <= chipEps {
		return nil
	}
	db := helper.GetDB()
	if db == nil {
		return ErrDatabaseUnavailable
	}
	return db.Table("game_users").Where("user_id = ?", userID).
		Update("wallet", gorm.Expr("wallet + ?", amount)).Error
}

// CreditOwnerRakeOffTable 将本手抽水记入房主账外；失败只打日志，不阻断桌内派奖。
func CreditOwnerRakeOffTable(ownerUserID string, rake float64) {
	if ownerUserID == "" || rake <= chipEps {
		return
	}
	if err := dbAddOffTable(ownerUserID, rake); err != nil {
		fmt.Printf("[game.wallet] CreditOwnerRakeOffTable owner=%s rake=%v err=%v\n", ownerUserID, rake, err)
	}
}

// refundSeatStackToDB 将桌上筹码退回账外并清零桌上 stack。
func refundSeatStackToDB(p *PlayerSeat) error {
	if p == nil || p.UserID == "" || p.Wallet <= chipEps {
		return nil
	}
	amt := p.Wallet
	if err := dbAddOffTable(p.UserID, amt); err != nil {
		return err
	}
	p.Wallet = 0
	return nil
}
