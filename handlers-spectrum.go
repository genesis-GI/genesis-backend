package main

import(
	"net/http"
	"github.com/gin-gonic/gin"
	"time"
	"io"
)

func spectrumHandler(c *gin.Context){
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
}


func spectrumChannelsHandler(c *gin.Context){
	channels, err := GetChannels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK, channels)
}

func spectrumGetMotdHandler(c *gin.Context){
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
}

func spectrumGetUserHandler(c *gin.Context){
	staffBackers, err := GetUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	c.JSON(http.StatusOK, staffBackers)
}

func motdUpdatesHandler(c *gin.Context){
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
}




func spectrumChannelUpdatesHandler(c *gin.Context){
	c.Stream(func(w io.Writer) bool {
		channels, err := GetChannels()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
			return false
		}
		c.SSEvent("message", channels)
		return true
	})
}


func POSTmotdHandler(c *gin.Context){
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

}

func GETmessages(c *gin.Context){
	channel := c.Param("channel")
	messages, err := GetChannelMessages(channel)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error"})
		return
	}
	c.JSON(http.StatusOK, messages)
}

func POSTcreateChannel(c *gin.Context){
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
}

func DELETEchannel(c *gin.Context){
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
}

func POSTstarChannel(c *gin.Context){
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
}

func GETchannel(c *gin.Context){
	channel := c.Param("channel")
	exists, err := GetChannel(channel)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Channel not found"})
		return
	}
	c.File("public/spectrum.html")
}

func GETchannelMOTD(c *gin.Context){
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
}

func POSTupdateMOTD(c *gin.Context){
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
}
