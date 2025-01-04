package main

import(
	"github.com/gin-gonic/gin"
	"fmt"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()


	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "Hello World",
		})
	})



	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})
	}

	fmt.Println("Server is running on http://localhost:8088")
	r.Run(":8088")
}
