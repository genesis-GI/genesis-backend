package main

import (

	"fmt"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	r.Static("/public/css", "./public/css")

	r.GET("/css/styles.css", func(c *gin.Context) {
		c.File("public/css/styles.css")
	})

	r.GET("/", func(c *gin.Context) {
		c.File("public/landing.html")
	})


	r.GET("/login", func(c *gin.Context) {
		c.File("public/login.html")
	})

	r.GET("/register", func(c *gin.Context){
		c.File("public/register.html")
	})

	r.GET("/download", func(c *gin.Context) {
		c.File("public/launcherdownload.html")
	})

	r.GET("/spectrum", func(c *gin.Context) {
		c.File("public/spectrum.html")
	})

	r.GET("/performance", func(c *gin.Context) {
		c.File("public/Genesis-website-performance-report-2.html")
	})

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})
	}

	fmt.Println("Server is running on http://localhost:8089")
	r.Run(":8089")
}
