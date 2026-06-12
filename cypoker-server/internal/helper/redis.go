package helper

import (
	"fmt"
	"os"
	"star"
	"sync"
	"time"

	"github.com/go-redis/redis"
)

// RedisUtil 带 key 前缀的 Redis 封装。
type RedisUtil struct {
	conn   *redis.Client
	prefix string
}

var (
	redisCache map[string]*RedisUtil
	redisMu    sync.RWMutex
)

// GetRedis 按名称取连接池实例；name 为空或未传时使用 default。
func GetRedis(name ...string) *RedisUtil {
	redisMu.RLock()
	defer redisMu.RUnlock()
	if redisCache == nil {
		return nil
	}
	key := "default"
	if len(name) > 0 && name[0] != "" {
		key = name[0]
	}
	return redisCache[key]
}

// pkey 逻辑键 -> Redis 实际键名。
func (r *RedisUtil) pkey(logical string) string {
	return r.prefix + logical
}

// pkeys 批量逻辑键 -> 实际键名（用于 MGET/DEL/EXISTS 等）。
func (r *RedisUtil) pkeys(logical ...string) []string {
	out := make([]string, len(logical))
	for i, k := range logical {
		out[i] = r.pkey(k)
	}
	return out
}

// Ping 连通检测。
func (r *RedisUtil) Ping() error {
	return r.conn.Ping().Err()
}

// Client 底层 *redis.Client，未封装命令可走这里。
func (r *RedisUtil) Client() *redis.Client {
	return r.conn
}

// 字符串键

// Set 写入字符串；expiration=0 表示不过期。
func (r *RedisUtil) Set(key string, value any, expiration time.Duration) error {
	return r.conn.Set(r.pkey(key), value, expiration).Err()
}

// Get 读取字符串；不存在为 redis.Nil。
func (r *RedisUtil) Get(key string) (string, error) {
	return r.conn.Get(r.pkey(key)).Result()
}

// Del 删除键，返回删除个数。
func (r *RedisUtil) Del(keys ...string) (int64, error) {
	if len(keys) == 0 {
		return 0, nil
	}
	return r.conn.Del(r.pkeys(keys...)...).Result()
}

// Exists 存在的键数量。
func (r *RedisUtil) Exists(keys ...string) (int64, error) {
	if len(keys) == 0 {
		return 0, nil
	}
	return r.conn.Exists(r.pkeys(keys...)...).Result()
}

// Expire 设置 TTL。
func (r *RedisUtil) Expire(key string, expiration time.Duration) (bool, error) {
	return r.conn.Expire(r.pkey(key), expiration).Result()
}

// ExpireAt 在指定时刻过期。
func (r *RedisUtil) ExpireAt(key string, at time.Time) (bool, error) {
	return r.conn.ExpireAt(r.pkey(key), at).Result()
}

// Persist 取消过期（持久键）。
func (r *RedisUtil) Persist(key string) (bool, error) {
	return r.conn.Persist(r.pkey(key)).Result()
}

// TTL 剩余时间；-2 无键，-1 无过期。
func (r *RedisUtil) TTL(key string) (time.Duration, error) {
	return r.conn.TTL(r.pkey(key)).Result()
}

// Incr +1，返回新值。
func (r *RedisUtil) Incr(key string) (int64, error) {
	return r.conn.Incr(r.pkey(key)).Result()
}

// IncrBy 增加 n。
func (r *RedisUtil) IncrBy(key string, n int64) (int64, error) {
	return r.conn.IncrBy(r.pkey(key), n).Result()
}

// Decr -1。
func (r *RedisUtil) Decr(key string) (int64, error) {
	return r.conn.Decr(r.pkey(key)).Result()
}

// DecrBy 减少 n。
func (r *RedisUtil) DecrBy(key string, n int64) (int64, error) {
	return r.conn.DecrBy(r.pkey(key), n).Result()
}

// SetNX 仅不存在时写入；成功返回 true。
func (r *RedisUtil) SetNX(key string, value any, expiration time.Duration) (bool, error) {
	return r.conn.SetNX(r.pkey(key), value, expiration).Result()
}

// MGet 批量读，与 keys 顺序一致；缺键对应 redis.Nil。
func (r *RedisUtil) MGet(keys ...string) ([]any, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	return r.conn.MGet(r.pkeys(keys...)...).Result()
}

// 哈希

// HSet 设字段。
func (r *RedisUtil) HSet(key, field string, value any) error {
	return r.conn.HSet(r.pkey(key), field, value).Err()
}

// HMSet 批量设字段。
func (r *RedisUtil) HMSet(key string, fields map[string]any) error {
	return r.conn.HMSet(r.pkey(key), fields).Err()
}

// HGet 读字段；不存在 redis.Nil。
func (r *RedisUtil) HGet(key, field string) (string, error) {
	return r.conn.HGet(r.pkey(key), field).Result()
}

// HGetAll 全部字段。
func (r *RedisUtil) HGetAll(key string) (map[string]string, error) {
	return r.conn.HGetAll(r.pkey(key)).Result()
}

// HDel 删字段，返回删除个数。
func (r *RedisUtil) HDel(key string, fields ...string) (int64, error) {
	if len(fields) == 0 {
		return 0, nil
	}
	return r.conn.HDel(r.pkey(key), fields...).Result()
}

// HExists 字段是否存在。
func (r *RedisUtil) HExists(key, field string) (bool, error) {
	return r.conn.HExists(r.pkey(key), field).Result()
}

// 列表

// LPush 左侧入队，返回新长度。
func (r *RedisUtil) LPush(key string, values ...any) (int64, error) {
	return r.conn.LPush(r.pkey(key), values...).Result()
}

// RPush 右侧入队。
func (r *RedisUtil) RPush(key string, values ...any) (int64, error) {
	return r.conn.RPush(r.pkey(key), values...).Result()
}

// LPop 左侧弹出。
func (r *RedisUtil) LPop(key string) (string, error) {
	return r.conn.LPop(r.pkey(key)).Result()
}

// RPop 右侧弹出。
func (r *RedisUtil) RPop(key string) (string, error) {
	return r.conn.RPop(r.pkey(key)).Result()
}

// LLen 列表长度。
func (r *RedisUtil) LLen(key string) (int64, error) {
	return r.conn.LLen(r.pkey(key)).Result()
}

// 有序集合

// ZAdd 添加成员，返回新增个数。
func (r *RedisUtil) ZAdd(key string, members ...redis.Z) (int64, error) {
	return r.conn.ZAdd(r.pkey(key), members...).Result()
}

// ZRange 按排名区间取成员（闭区间）。
func (r *RedisUtil) ZRange(key string, start, stop int64) ([]string, error) {
	return r.conn.ZRange(r.pkey(key), start, stop).Result()
}

// ZRem 移除成员，返回删除个数。
func (r *RedisUtil) ZRem(key string, members ...any) (int64, error) {
	return r.conn.ZRem(r.pkey(key), members...).Result()
}

// 其它

// Keys 按模式列键；pattern 为逻辑后缀（如 user:*），慎用大库。
func (r *RedisUtil) Keys(pattern string) ([]string, error) {
	return r.conn.Keys(r.pkey(pattern)).Result()
}

// InitRedis 根据配置建连并写入缓存；失败则退出进程。
func InitRedis() {
	redisMu.Lock()
	defer redisMu.Unlock()

	redisCache = make(map[string]*RedisUtil)
	for _, cfg := range Config.Redis {
		key := cfg.Name
		if key == "" {
			key = "default"
		}
		c := redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
			Password: cfg.Password,
			DB:       cfg.DB,
		})
		if err := c.Ping().Err(); err != nil {
			star.Log.E("REDIS", "Failed to connect to Redis %s: %v", key, err)
			os.Exit(1)
		}
		redisCache[key] = &RedisUtil{conn: c, prefix: cfg.Prefix}
	}
}
