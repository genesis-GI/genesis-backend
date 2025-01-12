package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Static("/public/css", "./public/css")

	r.GET("/css/styles.css", func(c *gin.Context) {
		c.File("public/css/styles.css")
	})

	r.GET("/", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.File("public/landing.html")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.File("public/landing.html")
			return
		}

		_, err = Login(email, password)
		if err == nil {
			c.File("public/loggedIn.html")
		} else {
			c.File("public/landing.html")
		}
	})

	r.GET("/favicon.ico", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "favicon.ico coming soon"})
		//c.File("public/favicon.ico")
	})

	r.GET("/login", func(c *gin.Context) {
		c.File("public/login.html")
	})

	r.GET("/register", func(c *gin.Context) {
		c.File("public/register.html")
	})

	r.GET("/download", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		_, err = Login(email, password)
		if err == nil {
			c.File("public/launcherdownload.html")
		} else {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
		}
	})

	r.GET("/spectrum", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		_, err = Login(email, password)
		if err == nil {
			c.File("public/spectrum.html")
		} else {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
		}
	})

	r.GET("/spectrum/channels", func(c *gin.Context) {
		channels, err := GetChannels()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		c.JSON(http.StatusOK, channels)
	})

	r.GET("/spectrum/motd/:channel", func(c *gin.Context) {
		channel := c.Param("channel")
		motd, err := GetMOTD(channel)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		if motd == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "MOTD not found"})
			return
		}

		// Convert date to { _seconds, _nanoseconds }
		if rawDate, ok := motd["date"]; ok {
			if t, ok := rawDate.(time.Time); ok {
				motd["date"] = map[string]interface{}{
					"_seconds":     t.Unix(),
					"_nanoseconds": t.UnixNano() % 1e9,
				}
			}
		}

		c.JSON(http.StatusOK, motd)
	})

	r.GET("/spectrum/users", func(c *gin.Context) {
		staffBackers, err := GetUsers()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}
		c.JSON(http.StatusOK, staffBackers)
	})

	r.GET("/spectrum/motd/updates/:channel", func(c *gin.Context) {
		channel := c.Param("channel")
		c.Stream(func(w io.Writer) bool {
			motd, err := GetMOTD(channel)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return false
			}
			if motd == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "MOTD not found"})
				return false
			}

			if rawDate, ok := motd["date"]; ok {
				if t, ok := rawDate.(time.Time); ok {
					motd["date"] = map[string]interface{}{
						"_seconds":     t.Unix(),
						"_nanoseconds": t.UnixNano() % 1e9,
					}
				}
			}

			c.SSEvent("message", motd)
			return false // send once, then end
		})
	})

	r.GET("/spectrum/channels/updates", func(c *gin.Context) {
		c.Stream(func(w io.Writer) bool {
			channels, err := GetChannels()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return false
			}
			c.SSEvent("message", channels)
			return true
		})
	})

	r.GET("/performance", func(c *gin.Context) {
		c.File("public/Genesis-website-performance-report-2.html")
	})

	r.POST("/register", func(c *gin.Context) {
		var req RegisterRequest
		if err := c.ShouldBindWith(&req, binding.JSON); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		// Call register function from dbInteraction.go
		success := Register(req.Username, req.Email, req.Password)
		if success {
			c.JSON(http.StatusOK, gin.H{"message": "User registered"})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Error during register sequence"})
		}
	})

	r.POST("/login", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindWith(&req, binding.JSON); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		fmt.Println("Trying login...")
		user, err := Login(req.Email, req.Password)
		if err == nil {
			c.SetCookie("email", req.Email, 3600, "/", "", false, true)
			c.SetCookie("username", user["username"].(string), 3600, "/", "", false, true)
			c.SetCookie("admin", fmt.Sprintf("%v", user["admin"]), 3600, "/", "", false, true)
			c.SetCookie("password", req.Password, 3600, "/", "", false, true) // Store password for auto-login
			c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
			fmt.Println("User logged in successfully")
		} else {
			fmt.Println("Error during login sequence:", err)
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
		}
	})

	r.GET("/auto-login", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Not logged in"})
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Not logged in"})
			return
		}

		user, err := Login(email, password)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"email":        email,
				"username":     user["username"],
				"admin":        user["admin"],
				"wantedStatus": user["wantedStatus"],
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
		}
	})

	r.POST("/spectrum/motd/:channel", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		_, err = Login(email, password)
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		channel := c.Param("channel")
		var req struct {
			Message string `json:"message"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err = SetMOTD(channel, req.Message)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "MOTD updated successfully"})
	})

	r.GET("/spectrum/messages/:channel", func(c *gin.Context) {
		channel := c.Param("channel")
		messages, err := GetChannelMessages(channel)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	r.POST("/spectrum/channel", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		if _, err := Login(email, password); err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		var req struct {
			ChannelName string `json:"channelName"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err == nil {
			err = CreateChannel(req.ChannelName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to create channel"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Channel created"})
	})

	r.DELETE("/spectrum/channel/:channel", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		if _, err := Login(email, password); err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		channel := c.Param("channel")
		if err == nil {
			err = DeleteChannel(channel)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to delete channel"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Channel deleted"})
	})

	r.POST("/spectrum/starChannel/:channel", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		if _, err := Login(email, password); err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		channel := c.Param("channel")
		var req struct {
			IsStarred bool `json:"isStarred"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err == nil {
			err = StarChannel(email, channel, req.IsStarred)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to star channel"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"message": "Channel star updated"})
	})

	r.GET("/spectrum/:channel/", func(c *gin.Context) {
		channel := c.Param("channel")
		exists, err := GetChannel(channel)
		if err != nil || !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
			return
		}
		c.File("public/spectrum.html")
	})

	r.GET("/spectrum/:channel/motd", func(c *gin.Context) {
		channel := c.Param("channel")
		motd, err := GetMOTD(channel)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		if motd == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "MOTD not found"})
			return
		}

		// Convert date to { _seconds, _nanoseconds }
		if rawDate, ok := motd["date"]; ok {
			if t, ok := rawDate.(time.Time); ok {
				motd["date"] = map[string]interface{}{
					"_seconds":     t.Unix(),
					"_nanoseconds": t.UnixNano() % 1e9,
				}
			}
		}

		c.JSON(http.StatusOK, motd)
	})

	r.POST("/spectrum/:channel/motd", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		_, err = Login(email, password)
		if err != nil {
			c.String(http.StatusOK, "Access forbidden: You must be logged in")
			return
		}

		channel := c.Param("channel")
		var req struct {
			Message string `json:"message"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		err = SetMOTD(channel, req.Message)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "MOTD updated successfully"})
	})

	r.GET("/spectrum/:channel/messages", func(c *gin.Context) {
		channel := c.Param("channel")
		messages, err := GetChannelMessages(channel)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	r.GET("/spectrum/:channel/motd/updates", func(c *gin.Context) {
		channel := c.Param("channel")
		c.Stream(func(w io.Writer) bool {
			motd, err := GetMOTD(channel)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return false
			}
			if motd == nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "MOTD not found"})
				return false
			}

			if rawDate, ok := motd["date"]; ok {
				if t, ok := rawDate.(time.Time); ok {
					motd["date"] = map[string]interface{}{
						"_seconds":     t.Unix(),
						"_nanoseconds": t.UnixNano() % 1e9,
					}
				}
			}

			c.SSEvent("message", motd)
			return false // send once, then end
		})
	})

	r.POST("/spectrum/status", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		if _, err := Login(email, password); err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}

		var req struct {
			Status string `json:"status"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := UpdateUserStatus(email, req.Status); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot update status"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
	})

	r.GET("/spectrum/status/updates", func(c *gin.Context) {
		c.Stream(func(w io.Writer) bool {
			users, err := GetUsers()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return false
			}
			c.SSEvent("message", users)
			return true
		})
	})

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})

		api.GET("/getVersions/:game/:email", func(c *gin.Context) {
			game := c.Param("game")
			email := c.Param("email")
			if game != "genesis" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid game (at the moment)"})
				return
			}
			// Call getVersions function from dbInteraction.go
			versions, err := GetVersions(game, email)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, versions)
		})

		api.GET("/getChecksums/:game/:version", func(c *gin.Context) {
			game := c.Param("game")
			version := c.Param("version")
			buildPath := filepath.Join("data", game, "builds", version)
			if _, err := os.Stat(buildPath); os.IsNotExist(err) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Build path not found"})
				return
			}
			checksums, err := calculateChecksums(buildPath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"game": game, "version": version, "checksums": checksums})
		})

		api.GET("/download/:game/:version", func(c *gin.Context) {
			c.String(300, "This is an old endpoint. Please ask the support if this issue persists.")
			/* 			game := c.Param("game")
			   			version := c.Param("version")
			   			buildPath := filepath.Join("data", game, "builds", version)
			   			if _, err := os.Stat(buildPath); os.IsNotExist(err) {
			   				c.JSON(http.StatusNotFound, gin.H{"error": "Requested game version not found"})
			   				return
			   			}
			   			c.Writer.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-%s.zip", game, version))
			   			c.Writer.Header().Set("Content-Type", "application/zip") */
			// Stream folder contents for download
			// Implement ZIP streaming logic here
		})
	}

	r.GET("/logout", func(c *gin.Context) {
		c.SetCookie("email", "", -1, "/", "localhost", false, true)
		c.SetCookie("username", "", -1, "/", "localhost", false, true)
		c.SetCookie("admin", "", -1, "/", "localhost", false, true)
		c.SetCookie("password", "", -1, "/", "localhost", false, true)
		c.File("public/landing.html")
	})

	r.POST("/spectrum/messages/:channel", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		_, err = Login(email, password)
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		channel := c.Param("channel")
		var body struct {
			Message string `json:"message"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		err = CreateMessage(channel, email, body.Message)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Message sent"})
	})

	r.GET("/spectrum/:channel/messages/updates", func(c *gin.Context) {
		channel := c.Param("channel")
		c.Stream(func(w io.Writer) bool {
			messages, err := GetChannelMessages(channel)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
				return false
			}
			c.SSEvent("message", messages)
			return true // keep connection open for real-time updates
		})
	})

	r.DELETE("/spectrum/messages/:channel/:messageID", func(c *gin.Context) {
		email, err := c.Cookie("email")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		password, err := c.Cookie("password")
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}
		_, err = Login(email, password)
		if err != nil {
			c.String(http.StatusForbidden, "Access forbidden: You must be logged in")
			return
		}

		channel := c.Param("channel")
		messageID := c.Param("messageID")

		err = DeleteMessage(channel, email, messageID)
		if err != nil {
			if err.Error() == "permission denied" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
			}
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
	})

	fmt.Println("Server is running on http://localhost:8088")
	r.Run(":8088")
}

func calculateChecksums(dir string) (map[string]string, error) {
	checksums := make(map[string]string)
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	for _, file := range files {
		fullPath := filepath.Join(dir, file.Name())
		if file.IsDir() {
			subChecksums, err := calculateChecksums(fullPath)
			if err != nil {
				return nil, err
			}
			for k, v := range subChecksums {
				checksums[filepath.Join(file.Name(), k)] = v
			}
		} else {
			data, err := ioutil.ReadFile(fullPath)
			if err != nil {
				return nil, err
			}
			hash := md5.Sum(data)
			checksums[file.Name()] = hex.EncodeToString(hash[:])
		}
	}
	return checksums, nil
}
