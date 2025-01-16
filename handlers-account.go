package main

import (
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"net/http"
	"fmt"
)


func postRegisterHandler(c *gin.Context){
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
}

func postLoginHandler(c *gin.Context){
	var req LoginRequest
	if err := c.ShouldBindWith(&req, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if gin.Mode() == gin.DebugMode {
		fmt.Println("Trying login...")
	}

	user, err := Login(req.Email, req.Password)
	if err == nil {
		c.SetCookie("email", req.Email, 3600, "/", "", false, true)
		c.SetCookie("username", user["username"].(string), 3600, "/", "", false, true)
		c.SetCookie("admin", fmt.Sprintf("%v", user["admin"]), 3600, "/", "", false, true)
		c.SetCookie("password", req.Password, 3600, "/", "", false, true) // Store password for auto-login
		c.Redirect(http.StatusFound, "/")
	} else {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Error during login sequence:", err)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
	}
}



func GETAutoLoginHandler(c *gin.Context){
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
}