package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/option"
)

var client *firestore.Client
var reachable = true

func init() {
	ctx := context.Background()
	sa := option.WithCredentialsFile("./fireBaseInfo.json")
	var err error
	client, err = firestore.NewClient(ctx, "genesis-1f378", sa)
	if err != nil {
		fmt.Println("Error during database initialization phase.\nDatabase is not available")
		reachable = false
	}
	fmt.Println("Connected to Firestore.")
}

func Register(username, email, password string) bool {
	if !isValidEmail(email) {
		fmt.Println("Invalid email format")
		return false
	}

	ctx := context.Background()
	userRef := client.Collection("accounts")

	userSnapshot, err := userRef.Where("username", "==", username).Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) > 0 {
		fmt.Println("User already registered")
		return false
	}

	emailSnapshot, err := userRef.Where("email", "==", email).Documents(ctx).GetAll()
	if err != nil || len(emailSnapshot) > 0 {
		fmt.Println("User already registered")
		return false
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Error hashing password")
		return false
	}

	_, _, err = userRef.Add(ctx, map[string]interface{}{
		"username":      username,
		"email":         email,
		"password":      string(hashedPassword),
		"admin":         false,
		"wave":          5,
		"created_at":    time.Now(),
		"ownsGame":      false,
		"ingame":        map[string]interface{}{"inventory": map[string]interface{}{}, "currency": 0},
		"playerLocation": map[string]interface{}{"x": 0, "y": 0, "z": 0},
	})
	if err != nil {
		fmt.Println("Error during register sequence")
		return false
	}

	fmt.Println("User registered successfully")
	return true
}

func Login(email, password string) (map[string]interface{}, error) {
	ctx := context.Background()
	userRef := client.Collection("accounts")
	userSnapshot, err := userRef.Where("email", "==", email).Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) == 0 {
		return nil, errors.New("user not found")
	}

	user := userSnapshot[0].Data()
	hashedPassword := user["password"].(string)
	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	if err != nil {
		return nil, errors.New("invalid password")
	}
	return user, nil
}

func GetUserByEmail(email string) (map[string]interface{}, error) {
	ctx := context.Background()
	userRef := client.Collection("accounts")
	userSnapshot, err := userRef.Where("email", "==", email).Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) == 0 {
		return nil, errors.New("user not found")
	}
	return userSnapshot[0].Data(), nil
}

func isValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

func GetVersions(game, email string) (map[string]interface{}, error) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return nil, err
	}

	gameConfig, err := FetchRemoteConfig()
	if err != nil {
		return nil, err
	}

	builds := gameConfig["builds"].([]interface{})
	userWave := user["wave"].(int)
	allowedBuilds := []interface{}{}
	for _, build := range builds {
		buildMap := build.(map[string]interface{})
		if userWave <= buildMap["requiredWaveAccess"].(int) {
			allowedBuilds = append(allowedBuilds, build)
		}
	}

	return map[string]interface{}{
		"email":         email,
		"waveAccess":    userWave,
		"allowedBuilds": allowedBuilds,
	}, nil
}

func FetchRemoteConfig() (map[string]interface{}, error) {
	// Implement fetching remote config from Firebase
	return nil, nil
}

func GetChannels() ([]string, error) {
	ctx := context.Background()
	collections, err := client.Collections(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	var channels []string
	for _, collection := range collections {
		if strings.HasPrefix(collection.ID, "spectrum-") {
			channels = append(channels, strings.TrimPrefix(collection.ID, "spectrum-"))
		}
	}
	return channels, nil
}

func GetMOTD(channel string) (map[string]interface{}, error) {
	ctx := context.Background()
	doc, err := client.Collection("spectrum-" + channel).Doc("motd").Get(ctx)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, nil
		}
		return nil, err
	}
	return doc.Data(), nil
}

func SetMOTD(channel, message string) error {
	ctx := context.Background()
	_, err := client.Collection("spectrum-" + strings.ToLower(channel)).
		Doc("motd").
		Set(ctx, map[string]interface{}{
			"message": message,
			"date":    firestore.ServerTimestamp,
		})
	return err
}

func GetUsers() (map[string][]string, error) {
	ctx := context.Background()
	accounts, err := client.Collection("accounts").Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	var staff []string
	var backers []string
	for _, doc := range accounts {
		data := doc.Data()
		username, ok := data["username"].(string)
		if !ok {
			continue
		}
		isAdmin, _ := data["admin"].(bool)
		if isAdmin {
			staff = append(staff, username)
		} else {
			backers = append(backers, username)
		}
	}

	return map[string][]string{
		"staff":   staff,
		"backers": backers,
	}, nil
}
