package helper

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"star"
	"strings"

	"github.com/fsnotify/fsnotify"
)

// WatchDir 监控指定目录
// dir: 要监控的目录路径
// callback: 文件变化时的回调函数，参数为事件类型和文件路径
// fileTypes: 可选参数，指定要监控的文件类型扩展名列表（如 [".go", ".txt"]）
func WatchDir(dir string, callback func(event string, path string), fileTypes ...[]string) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		star.Log.E("WATCH", "Create watcher failed: %s", err.Error())
		return
	}
	defer watcher.Close()

	// 递归添加目录及其所有子目录
	err = addDirRecursive(watcher, dir)
	if err != nil {
		star.Log.E("WATCH", "Add watch directory failed: %s", err.Error())
		return
	}

	if len(fileTypes) > 0 && len(fileTypes[0]) > 0 {
		filterFileTypes := strings.Join(fileTypes[0], ",")
		star.Log.I("WATCH", "Start watching directory: %s, file types: %s", dir, filterFileTypes)
	} else {
		star.Log.I("WATCH", "Start watching directory: %s", dir)
	}

	// 监控文件变化
	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				star.Log.W("WATCH", "Watcher closed")
				return
			}

			// 处理新目录创建，自动添加到监控
			if event.Op&fsnotify.Create == fsnotify.Create {
				if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
					star.Log.I("WATCH", "New directory detected, adding to watch: %s", event.Name)
					if err := addDirRecursive(watcher, event.Name); err != nil {
						star.Log.E("WATCH", "Add new directory to watch failed: %s - %s", event.Name, err.Error())
					}
				}
			}

			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create ||
				event.Op&fsnotify.Remove == fsnotify.Remove ||
				event.Op&fsnotify.Rename == fsnotify.Rename {

				option := ""
				if event.Op&fsnotify.Write == fsnotify.Write {
					option = "W"
				} else if event.Op&fsnotify.Create == fsnotify.Create {
					option = "C"
				} else if event.Op&fsnotify.Remove == fsnotify.Remove {
					option = "D"
				} else if event.Op&fsnotify.Rename == fsnotify.Rename {
					option = "R"
				}

				// 如果指定了文件类型，则只处理指定类型的文件
				if len(fileTypes) > 0 && len(fileTypes[0]) > 0 {
					ext := strings.ToLower(filepath.Ext(event.Name))
					if slices.Contains(fileTypes[0], ext) {
						callback(option, event.Name)
					}
				} else {
					// 没有指定文件类型，处理所有文件
					callback(option, event.Name)
				}
			}

		case err, ok := <-watcher.Errors:
			if !ok {
				star.Log.W("WATCH", "Watcher closed: %s", err.Error())
				return
			}
			star.Log.E("WATCH", "Watcher error: %s", err.Error())
		}
	}
}

// 递归添加目录及其所有子目录到监控
func addDirRecursive(watcher *fsnotify.Watcher, dir string) error {
	// 添加当前目录
	err := watcher.Add(dir)
	if err != nil {
		return fmt.Errorf("add directory %s failed: %w", dir, err)
	}

	// 递归遍历子目录
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			star.Log.W("WATCH", "Access path failed: %s - %s", path, err.Error())
			return nil
		}

		if info.IsDir() {
			err = watcher.Add(path)
			if err != nil {
				star.Log.W("WATCH", "Add sub directory to watch failed: %s - %s", path, err.Error())
			}
		}
		return nil
	})
}
