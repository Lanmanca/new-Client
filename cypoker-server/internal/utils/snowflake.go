package utils

import (
	"os"
	"star"

	"github.com/bwmarrin/snowflake"
)

var sfNode *snowflake.Node

func init() {
	var err error
	sfNode, err = snowflake.NewNode(1)
	if err != nil {
		star.Log.E("SNOWFLAKE", "Failed to create snowflake node: %v", err)
		os.Exit(1)
	}
}

// GenerateSnowflakeID 生成雪花 ID
func GenerateSnowflakeID() int64 {
	return sfNode.Generate().Int64()
}
