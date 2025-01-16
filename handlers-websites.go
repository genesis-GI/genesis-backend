package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)



func indexHandler(c *gin.Context){
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
}


func getLoginHandler(c *gin.Context){
	c.File("public/login.html")
}

func getRegisterHandler(c *gin.Context){
	c.File("public/register.html")
}


func launcherDownloadHandler(c *gin.Context){
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
}

func performanceViewHandler(c *gin.Context){
	c.File("public/Genesis-website-performance-report-2.html")
}