package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
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
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Error during database initialization phase.\nDatabase is not available")
		}
		reachable = false
	}
	if gin.Mode() == gin.DebugMode {
		fmt.Println("Connected to Firestore.")
	}

}

func Register(username, email, password string) bool {
	if !isValidEmail(email) {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Invalid email format")
		}
		return false
	}

	ctx := context.Background()
	userRef := client.Collection("accounts")

	userSnapshot, err := userRef.Where("username", "==", username).Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) > 0 {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("User already registered")
		}
		return false
	}

	emailSnapshot, err := userRef.Where("email", "==", email).Documents(ctx).GetAll()
	if err != nil || len(emailSnapshot) > 0 {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("User already registered")
		}
		return false
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Error hashing password")
		}
		return false
	}

	_, _, err = userRef.Add(ctx, map[string]interface{}{
		"username":       username,
		"email":          email,
		"password":       string(hashedPassword),
		"admin":          false,
		"wave":           5,
		"created_at":     time.Now(),
		"ownsGame":       false,
		"ingame":         map[string]interface{}{"inventory": map[string]interface{}{}, "currency": 0},
		"playerLocation": map[string]interface{}{"x": 0, "y": 0, "z": 0},
	})
	if err != nil {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Error during register sequence")
		}
		return false
	}

	if gin.Mode() == gin.DebugMode {
		fmt.Println("User registered successfully")
	}
	return true
}

func Login(email, password string) (map[string]interface{}, error) {
	ctx := context.Background()
	userRef := client.Collection("accounts")
	userSnapshot, err := userRef.Where("email", "==", email).Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) == 0 {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("user not found: ", err)
		}
		return nil, errors.New("user not found")
	}

	user := userSnapshot[0].Data()
	hashedPassword := user["password"].(string)
	err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	if err != nil {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("invalid password: ", err)
		}
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

	gameConfig, err := GetGameConfig()
	if err != nil {
		return nil, err
	}

	builds, ok := gameConfig["builds"].([]interface{})
	if !ok {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Invalid builds data:", gameConfig["builds"])
		}
		return nil, errors.New("invalid builds data")
	}

	userWave := user["wave"].(int)
	allowedBuilds := []interface{}{}
	for _, build := range builds {
		buildMap, ok := build.(map[string]interface{})
		if !ok {
			if gin.Mode() == gin.DebugMode {
				fmt.Println("Invalid build map:", build)
			}
			continue
		}
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
	ctx := context.Background()
	doc, err := client.Collection("config").Doc("gameConfig").Get(ctx)
	if err != nil {
		return nil, err
	}

	configData := doc.Data()
	if configData == nil {
		return nil, errors.New("config data is nil")
	}

	parameters, ok := configData["parameters"].(map[string]interface{})
	if !ok {
		return nil, errors.New("invalid parameters data")
	}

	configJson := make(map[string]interface{})
	for key, value := range parameters {
		paramMap, ok := value.(map[string]interface{})
		if !ok {
			continue
		}
		defaultValue, ok := paramMap["defaultValue"].(map[string]interface{})
		if !ok {
			continue
		}
		configJson[key] = defaultValue["value"]
	}

	if gin.Mode() == gin.DebugMode {
		fmt.Println("Fetched remote config:", configJson)
	}
	return configJson, nil
}

func GetGameConfig() (map[string]interface{}, error) {
	rawData, err := FetchRemoteConfig()
	if err != nil {
		return nil, err
	}

	gameConfigStr, ok := rawData["gameConfig"].(string)
	if !ok {
		return nil, errors.New("invalid remote config data: 'gameConfig' missing")
	}

	var gameConfig map[string]interface{}
	err = json.Unmarshal([]byte(gameConfigStr), &gameConfig)
	if err != nil {
		return nil, err
	}

	return gameConfig, nil
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
	_, err := client.Collection("spectrum-"+channel).
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
		username, _ := data["username"].(string)
		isAdmin, _ := data["admin"].(bool)
		status, _ := data["status"].(string)
		if isAdmin {
			staff = append(staff, fmt.Sprintf("%s|%s", username, status))
		} else {
			backers = append(backers, fmt.Sprintf("%s|%s", username, status))
		}
	}
	return map[string][]string{
		"staff":   staff,
		"backers": backers,
	}, nil
}

func GetChannelMessages(channel string) ([]map[string]interface{}, error) {
	ctx := context.Background()
	messagesRef := client.Collection("spectrum-" + channel).Doc("chat").Collection("messages")
	docs, err := messagesRef.OrderBy("timestamp", firestore.Asc).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}

	var messages []map[string]interface{}
	for _, doc := range docs {
		msg := doc.Data()
		msg["id"] = doc.Ref.ID // Include the message ID
		messages = append(messages, msg)
	}
	return messages, nil
}

func CreateChannel(channel string) error {
	ctx := context.Background()
	_, err := client.Collection("spectrum-"+channel).Doc("chat").Set(ctx, map[string]interface{}{
		"created_at": time.Now(),
	})
	return err
}

func DeleteChannel(channel string) error {
	ctx := context.Background()
	batch := client.Batch()
	collectionRef := client.Collection("spectrum-" + channel)
	docs, err := collectionRef.Documents(ctx).GetAll()
	if err != nil {
		return err
	}
	for _, doc := range docs {
		batch.Delete(doc.Ref)
	}
	_, err = batch.Commit(ctx)
	return err
}

func StarChannel(email, channel string, isStarred bool) error {
	ctx := context.Background()
	userRef := client.Collection("accounts").Where("email", "==", email)
	userSnapshot, err := userRef.Documents(ctx).GetAll()
	if err != nil || len(userSnapshot) == 0 {
		return errors.New("user not found")
	}
	userDoc := userSnapshot[0].Ref
	userData := userSnapshot[0].Data()
	starredChannels := userData["starredChannels"].([]interface{})
	if isStarred {
		starredChannels = append(starredChannels, channel)
	} else {
		for i, ch := range starredChannels {
			if ch == channel {
				starredChannels = append(starredChannels[:i], starredChannels[i+1:]...)
				break
			}
		}
	}
	_, err = userDoc.Update(ctx, []firestore.Update{
		{Path: "starredChannels", Value: starredChannels},
	})
	return err
}

func GetChannel(channel string) (bool, error) {
	ctx := context.Background()
	collectionRef := client.Collection("spectrum-" + channel)
	docs, err := collectionRef.Documents(ctx).GetAll()
	if err != nil {
		return false, err
	}
	return len(docs) > 0, nil
}

func UpdateUserStatus(email, status string) error {
	ctx := context.Background()
	userRef := client.Collection("accounts").Where("email", "==", email)
	snaps, err := userRef.Documents(ctx).GetAll()
	if err != nil || len(snaps) == 0 {
		return errors.New("user not found")
	}
	_, err = snaps[0].Ref.Update(ctx, []firestore.Update{
		{Path: "status", Value: status},
		{Path: "lastActive", Value: firestore.ServerTimestamp},
	})
	return err
}

func getUserWantedStatus(email string) string {
	ctx := context.Background()
	userRef := client.Collection("accounts").Where("email", "==", email)
	snaps, err := userRef.Documents(ctx).GetAll()
	if err != nil || len(snaps) == 0 {
		return "Error fetching user"
	}
	data := snaps[0].Data()
	status, _ := data["wantedStatus"].(string)
	return status
}

func updateUserWantedStatus(email, status string) error {
	ctx := context.Background()
	userRef := client.Collection("accounts").Where("email", "==", email)
	snaps, err := userRef.Documents(ctx).GetAll()
	if err != nil || len(snaps) == 0 {
		return fmt.Errorf("Error fetching user: %v", err)
	}
	_, err = snaps[0].Ref.Update(ctx, []firestore.Update{
		{Path: "wantedStatus", Value: status},
	})
	if err != nil {
		return fmt.Errorf("Error updating user wanted status: %v", err)
	}
	return nil
}

func CreateMessage(channel, email, message string) error {
	ctx := context.Background()
	if gin.Mode() == gin.DebugMode {
		fmt.Println("Saving message for channel:", channel)
	}
	user, err := GetUserByEmail(email)
	if err != nil {
		return err
	}
	username, _ := user["username"].(string)
	admin, _ := user["admin"].(bool)
	_, _, err = client.Collection("spectrum-"+channel).
		Doc("chat").Collection("messages").
		Add(ctx, map[string]interface{}{
			"username":  username,
			"email":     email,
			"admin":     admin,
			"message":   message,
			"timestamp": time.Now(),
		})
	if err != nil {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Error saving message:", err)
		}
	} else {
		if gin.Mode() == gin.DebugMode {
			fmt.Println("Message saved successfully: ", message)
		}

	}
	return err
}

func DeleteMessage(channel, email, messageID string) error {
	ctx := context.Background()
	user, err := GetUserByEmail(email)
	if err != nil {
		return err
	}
	admin, _ := user["admin"].(bool)

	messageRef := client.Collection("spectrum-" + channel).Doc("chat").Collection("messages").Doc(messageID)
	messageDoc, err := messageRef.Get(ctx)
	if err != nil {
		return err
	}

	messageData := messageDoc.Data()
	messageOwner, _ := messageData["email"].(string)

	if admin || messageOwner == email {
		_, err = messageRef.Delete(ctx)
		if err != nil {
			return err
		}
	} else {
		return errors.New("permission denied")
	}

	return nil
}

func StartFirestoreListeners() {
	ctx := context.Background()

	// Example listener for all user accounts (to get user status updates).
	accountsIter := client.Collection("accounts").Snapshots(ctx)
	go func() {
		for {
			snap, err := accountsIter.Next()
			if err != nil {
				if gin.Mode() == gin.DebugMode {
					fmt.Println("Error in accounts listener:", err)
				}
				return
			}
			if gin.Mode() == gin.DebugMode {
				fmt.Println("Accounts changed:", snap.Changes)
			}
			// Broadcast these changes via SSE or WebSockets
		}
	}()

	// Example listener for a specific channel’s MOTD doc.
	motdIter := client.Collection("spectrum-mychannel").Doc("motd").Snapshots(ctx)
	go func() {
		for {
			snap, err := motdIter.Next()
			if err != nil {
				if gin.Mode() == gin.DebugMode {
					fmt.Println("Error in MOTD listener:", err)
				}
				return
			}
			if gin.Mode() == gin.DebugMode {
				fmt.Println("MOTD changed:", snap.Data())
			}
		}
	}()

	// Example listener for channel messages (already present).
	chRef := client.Collection("spectrum-mychannel").Doc("chat").Collection("messages")
	snapIter := chRef.Snapshots(ctx)
	go func() {
		for {
			snap, err := snapIter.Next()
			if err != nil {
				if gin.Mode() == gin.DebugMode {
					fmt.Println("Error in Firestore listener:", err)
				}
				return
			}
			if gin.Mode() == gin.DebugMode {
				fmt.Println("New messages snapshot:", snap.Changes)
				fmt.Println("New messages snapshot:", snap.Changes)
			}
		}
	}()
}
