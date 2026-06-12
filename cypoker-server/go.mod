module server

go 1.26.1

require (
	github.com/bwmarrin/snowflake v0.3.0
	github.com/fsnotify/fsnotify v1.9.0
	github.com/go-redis/redis v6.15.9+incompatible
	github.com/golang-jwt/jwt/v5 v5.3.1
	golang.org/x/crypto v0.49.0
	gopkg.in/yaml.v3 v3.0.1
	gorm.io/datatypes v1.2.7
	gorm.io/driver/mysql v1.6.0
	gorm.io/gorm v1.31.1
	star v0.0.1-beta.1
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/go-sql-driver/mysql v1.8.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/onsi/ginkgo v1.16.5 // indirect
	github.com/onsi/gomega v1.39.1 // indirect
	golang.org/x/sys v0.42.0 // indirect
	golang.org/x/text v0.35.0 // indirect
)

replace star => ../star
