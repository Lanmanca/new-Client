package helper

import (
	"os"
	"strings"

	"star"

	"gopkg.in/yaml.v3"
)

// 与 AppConfig 对应的 YAML 顶层键
var reservedTopLevelKeys = map[string]struct{}{
	"debug":    {},
	"port":     {},
	"log":      {},
	"sql_log":  {},
	"cors":     {},
	"i18n":     {},
	"database": {},
	"redis":    {},
}

// extra 自定义扩展配置
var extra map[string]any

// I18NConfig 国际化配置
type I18NConfig struct {
	Path        string `yaml:"path"`         // 语言文件路径
	DefaultLang string `yaml:"default_lang"` // 默认语言
}

// DBConfig 数据库连接配置
type DBConfig struct {
	Name     string `yaml:"name"`     // 连接名，空则视为 default
	Host     string `yaml:"host"`     // 地址
	Port     int    `yaml:"port"`     // 端口
	User     string `yaml:"user"`     // 用户名
	Password string `yaml:"password"` // 密码
	DBName   string `yaml:"db_name"`  // 库名
	Prefix   string `yaml:"prefix"`   // 表前缀
}

// RedisConfig Redis 连接配置
type RedisConfig struct {
	Name     string `yaml:"name"`     // 连接名，空则视为 default
	Host     string `yaml:"host"`     // 地址
	Port     int    `yaml:"port"`     // 端口
	Password string `yaml:"password"` // 密码，无则留空
	DB       int    `yaml:"db_name"`  // 逻辑库编号 0～15
	Prefix   string `yaml:"prefix"`   // 键前缀
}

// JWTConfig JWT 配置
type JWTConfig struct {
	Secret    string `yaml:"secret"`     // 密钥
	ExpiresIn int    `yaml:"expires_in"` // 过期时间（秒）
}

// SQLLogConfig GORM / SQL 日志（与顶层 debug 无关，仅由 sql_log 控制）
type SQLLogConfig struct {
	Enable             bool `yaml:"enable"`               // 是否打印每条成功 SQL
	SlowQuery          bool `yaml:"slow_query"`           // 是否开启慢查询日志
	SlowQueryThreshold int  `yaml:"slow_query_threshold"` // 慢查询阈值（毫秒），≤0 时默认 400
}

// AppConfig 应用配置
type AppConfig struct {
	Debug    bool            `yaml:"debug"`    // 是否开启调试模式
	Port     int             `yaml:"port"`     // 监听端口
	Log      star.Logger     `yaml:"log"`      // 日志配置
	SQLLog   SQLLogConfig    `yaml:"sql_log"`  // SQL 日志配置
	Cors     star.CorsConfig `yaml:"cors"`     // 跨域配置
	I18N     I18NConfig      `yaml:"i18n"`     // 国际化配置
	Database []DBConfig      `yaml:"database"` // 数据库配置
	Redis    []RedisConfig   `yaml:"redis"`    // Redis 配置
	JWT      JWTConfig       `yaml:"jwt"`      // JWT 配置
}

// Config 全局配置
var Config AppConfig

// loadConfig 加载配置文件
func loadConfig(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var raw map[string]any
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return err
	}
	extra = make(map[string]any)
	for k, v := range raw {
		if _, reserved := reservedTopLevelKeys[k]; reserved {
			continue
		}
		extra[k] = v
	}

	if err := yaml.Unmarshal(data, &Config); err != nil {
		return err
	}
	if Config.Port == 0 {
		Config.Port = 8000
	}
	return nil
}

// Get 仅在 extra（自定义扩展配置）中按点号路径取值，例如 my_service.timeout
func Get(path string) any {
	path = strings.TrimSpace(path)
	if path == "" || extra == nil {
		return nil
	}

	return star.GetValueByPath(extra, path)
}

// InitConfig 初始化配置
func InitConfig() {
	// 配置文件路径，指定路径优先
	cfgPath := "./config.yaml"
	if len(os.Args) > 1 {
		cfgPath = os.Args[1]
	}

	if err := loadConfig(cfgPath); err != nil {
		star.Log.E("CONFIG", "Initialize config failed: %v", err)
		os.Exit(1)
	}
}
