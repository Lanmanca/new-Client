package helper

import (
	"context"
	"errors"
	"fmt"
	"os"
	"star"
	"strings"
	"sync"
	"time"

	"server/internal/utils"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// starGormLogger GORM 日志重写
type starGormLogger struct {
	slowThreshold time.Duration
	level         gormlogger.LogLevel
	logAllSQL     bool // sql_log.enable：打印每条成功 SQL（与应用 debug 无关）
}

func (l *starGormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	n := *l
	n.level = level
	return &n
}

func (l *starGormLogger) Info(ctx context.Context, msg string, data ...any) {
	if l.level < gormlogger.Info {
		return
	}
	if l.logAllSQL {
		star.Log.D("GORM", "%s", fmt.Sprintf(msg, data...))
	}
}

// 这两个留空，用Trace处理
func (l *starGormLogger) Warn(ctx context.Context, msg string, data ...any)  {}
func (l *starGormLogger) Error(ctx context.Context, msg string, data ...any) {}

func gormFormatRows(rows int64) string {
	if rows == -1 {
		return "-"
	}
	return fmt.Sprintf("%d", rows)
}

// formatGormSQLLog 将 GORM 返回的多行 SQL 压成单行、空白归一
func formatGormSQLLog(sql string) string {
	s := strings.TrimSpace(sql)
	if s == "" {
		return s
	}
	s = strings.NewReplacer("\r\n", " ", "\r", " ", "\n", " ", "\t", " ").Replace(s)
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return strings.TrimSpace(s)
}

// Trace 重写 GORM Logger Trace
func (l *starGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	_ = ctx
	if l.level <= gormlogger.Silent {
		return
	}
	if err != nil {
		sql, _ := fc()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return
		}
		if l.level >= gormlogger.Error {
			star.Log.E("GORM", "%s | %v", formatGormSQLLog(sql), err)
		}
		return
	}

	elapsed := time.Since(begin)
	ms := float64(elapsed.Nanoseconds()) / 1e6
	sql, rows := fc()
	sqlLog := formatGormSQLLog(sql)

	if elapsed > l.slowThreshold && l.slowThreshold != 0 && l.level >= gormlogger.Warn {
		star.Log.W("GORM", "SLOW SQL >= %v | [%.3fms] [rows:%s] %s", l.slowThreshold, ms, gormFormatRows(rows), sqlLog)
		return
	}

	if l.level == gormlogger.Info && l.logAllSQL {
		star.Log.D("GORM", "[%.3fms] [rows:%s] %s", ms, gormFormatRows(rows), sqlLog)
	}
}

func newGORMLogger() gormlogger.Interface {
	cfg := Config.SQLLog
	logAllSQL := cfg.Enable

	slowThr := time.Duration(cfg.SlowQueryThreshold) * time.Millisecond
	if cfg.SlowQueryThreshold <= 0 {
		slowThr = 400 * time.Millisecond
	}
	if !cfg.SlowQuery {
		slowThr = 0
	}

	var level gormlogger.LogLevel
	switch {
	case logAllSQL:
		level = gormlogger.Info
	case cfg.SlowQuery:
		level = gormlogger.Warn
	default:
		level = gormlogger.Error
	}

	return &starGormLogger{
		slowThreshold: slowThr,
		level:         level,
		logAllSQL:     logAllSQL,
	}
}

// Model 公共字段
type Model struct {
	ID        int64          `json:"id" gorm:"primaryKey;column:id"`
	CreatedAt time.Time      `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index;column:deleted_at"`
}

// BeforeCreate 未指定 ID 时生成雪花 ID
func (m *Model) BeforeCreate(tx *gorm.DB) error {
	if m.ID == 0 {
		m.ID = utils.GenerateSnowflakeID()
	}
	return nil
}

var (
	conn       map[string]*gorm.DB // conn 数据库连接
	models     = []any{}           // models 需要自动迁移的模型
	modelMutex = sync.RWMutex{}    // modelMutex 模型迁移锁
)

// InitDataSource 初始化数据源
func InitDataSource() {
	conn = make(map[string]*gorm.DB)

	for _, d := range Config.Database {
		key := d.Name
		if key == "" {
			key = "default"
		}
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			d.User, d.Password, d.Host, d.Port, d.DBName)
		gdb, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: newGORMLogger(),
			NamingStrategy: schema.NamingStrategy{
				TablePrefix: d.Prefix,
			},
		})
		if err != nil {
			star.Log.E("DATABASE", "Failed to connect to database %s: %v", key, err)
			os.Exit(1)
		}
		conn[key] = gdb
	}
}

// GetDB 获取数据库连接，name 省略时为 default
func GetDB(name ...string) *gorm.DB {
	if conn == nil {
		return nil
	}
	key := "default"
	if len(name) > 0 && name[0] != "" {
		key = name[0]
	}
	return conn[key]
}

// RegisterModel 注册模型到数据库
func RegisterModel(model ...any) {
	modelMutex.Lock()
	defer modelMutex.Unlock()
	models = append(models, model...)
}

// InitModel 自动迁移模型
func InitModel() {
	for _, model := range models {
		if err := GetDB().AutoMigrate(model); err != nil {
			star.Log.E("DATABASE", "Failed to migrate model %T: %v", model, err)
			os.Exit(1)
		}
	}
}
