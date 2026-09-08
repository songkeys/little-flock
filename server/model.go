package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"math"
	"time"
)

//go:embed catalog.json
var catalogJSON []byte

type Breed struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Rarity    string `json:"rarity"`
	WoolValue int    `json:"woolValue"`
}
type Crop struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	SeedID      string `json:"seedId"`
	GrowSeconds int    `json:"growSeconds"`
	SeedPrice   int    `json:"seedPrice"`
	SellPrice   int    `json:"sellPrice"`
	XP          int    `json:"xp"`
	Yield       int    `json:"yield"`
}

var catalog struct {
	Breeds []Breed  `json:"breeds"`
	Crops  []Crop   `json:"crops"`
	Traits []string `json:"traits"`
}

func init() {
	if err := json.Unmarshal(catalogJSON, &catalog); err != nil {
		panic(err)
	}
}

type AvatarAppearance struct {
	Skin   int `json:"skin"`
	Hair   int `json:"hair"`
	Outfit int `json:"outfit"`
	Hat    int `json:"hat"`
}
type User struct {
	Avatar       AvatarAppearance `json:"avatar"`
	ID           string           `json:"id"`
	Username     string           `json:"username"`
	PasswordHash string           `json:"-"`
}
type Account struct {
	Avatar       AvatarAppearance `json:"avatar"`
	ID           string           `json:"id"`
	Username     string           `json:"username"`
	PasswordHash string           `json:"passwordHash"`
}
type Session struct {
	TokenHash string `json:"tokenHash"`
	UserID    string `json:"userId"`
	ExpiresAt int64  `json:"expiresAt"`
}
type Vec2 struct {
	X float64 `json:"x"`
	Z float64 `json:"z"`
}
type Sheep struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	BreedID    string  `json:"breedId"`
	Sex        string  `json:"sex"`
	BornAt     int64   `json:"bornAt"`
	AdultAt    int64   `json:"adultAt"`
	Hunger     float64 `json:"hunger"`
	Happiness  float64 `json:"happiness"`
	Wool       float64 `json:"wool"`
	LastBredAt int64   `json:"lastBredAt"`
	PetAt      int64   `json:"petAt"`
	Position   Vec2    `json:"position"`
	Trait      string  `json:"trait"`
}
type Plot struct {
	ID        string  `json:"id"`
	Position  Vec2    `json:"position"`
	CropID    *string `json:"cropId"`
	PlantedAt int64   `json:"plantedAt"`
	WateredAt int64   `json:"wateredAt"`
	ReadyAt   int64   `json:"readyAt"`
}
type Order struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	ItemID    string `json:"itemId"`
	Quantity  int    `json:"quantity"`
	Reward    int    `json:"reward"`
	XP        int    `json:"xp"`
	Completed bool   `json:"completed"`
}
type Upgrades struct {
	Pasture  int `json:"pasture"`
	Watering int `json:"watering"`
}
type Stats struct {
	Harvested       int `json:"harvested"`
	WoolCollected   int `json:"woolCollected"`
	Births          int `json:"births"`
	OrdersCompleted int `json:"ordersCompleted"`
}
type Progression struct {
	LastStargazeDay int `json:"lastStargazeDay"`
	Step            int `json:"step"`
	ForestFinds     int `json:"forestFinds"`
}
type Buildings struct {
	Shelter bool `json:"shelter"`
	Garden  bool `json:"garden"`
}
type GrazingState struct {
	Active         bool    `json:"active"`
	LeaderID       *string `json:"leaderId"`
	RegionID       string  `json:"regionId"`
	StartedAt      int64   `json:"startedAt"`
	GrazeSeconds   float64 `json:"grazeSeconds"`
	Watered        bool    `json:"watered"`
	CompletedCount int     `json:"completedCount"`
}
type ForageNode struct {
	ID       string `json:"id"`
	RegionID string `json:"regionId"`
	ItemID   string `json:"itemId"`
	Position Vec2   `json:"position"`
	ReadyAt  int64  `json:"readyAt"`
}
type FarmState struct {
	Progression  Progression    `json:"progression"`
	Buildings    Buildings      `json:"buildings"`
	Regions      []string       `json:"regions"`
	Grazing      GrazingState   `json:"grazing"`
	ForageNodes  []ForageNode   `json:"forageNodes"`
	Version      int            `json:"version"`
	CreatedAt    int64          `json:"createdAt"`
	UpdatedAt    int64          `json:"updatedAt"`
	Coins        int            `json:"coins"`
	XP           int            `json:"xp"`
	Level        int            `json:"level"`
	Inventory    map[string]int `json:"inventory"`
	Sheep        []Sheep        `json:"sheep"`
	Plots        []Plot         `json:"plots"`
	Orders       []Order        `json:"orders"`
	Upgrades     Upgrades       `json:"upgrades"`
	Stats        Stats          `json:"stats"`
	Discoveries  []string       `json:"discoveries"`
	Weather      string         `json:"weather"`
	Day          int            `json:"day"`
	DayProgress  float64        `json:"dayProgress"`
	Season       string         `json:"season"`
	ClockSeconds float64        `json:"clockSeconds"`
}
type Room struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Code        string `json:"code"`
	OwnerID     string `json:"ownerId"`
	MemberCount int    `json:"memberCount"`
	OnlineCount int    `json:"onlineCount"`
	CreatedAt   int64  `json:"createdAt"`
}
type RoomRecord struct {
	Room    Room            `json:"room"`
	Members map[string]bool `json:"members"`
	State   FarmState       `json:"state"`
}
type Action struct {
	Facility string `json:"facility,omitempty"`
	RegionID string `json:"regionId,omitempty"`
	NodeID   string `json:"nodeId,omitempty"`
	// Request context is populated under the room lock, never decoded from JSON.
	actorID       string
	actorPosition *Vec2
	leaderOnline  bool
	Type          string `json:"type"`
	SheepID       string `json:"sheepId,omitempty"`
	PartnerID     string `json:"partnerId,omitempty"`
	Name          string `json:"name,omitempty"`
	ItemID        string `json:"itemId,omitempty"`
	Quantity      int    `json:"quantity,omitempty"`
	PlotID        string `json:"plotId,omitempty"`
	CropID        string `json:"cropId,omitempty"`
	OrderID       string `json:"orderId,omitempty"`
	UpgradeID     string `json:"upgradeId,omitempty"`
}
type Player struct {
	Avatar   AvatarAppearance `json:"avatar"`
	ID       string           `json:"id"`
	Username string           `json:"username"`
	Position Vec2             `json:"position"`
	Facing   float64          `json:"facing"`
	Color    string           `json:"color"`
	JumpAt   int64            `json:"jumpAt,omitempty"`
}

func nowMS() int64 { return time.Now().UnixMilli() }
func newID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }
func breedByID(id string) *Breed {
	for i := range catalog.Breeds {
		if catalog.Breeds[i].ID == id {
			return &catalog.Breeds[i]
		}
	}
	return nil
}
func cropByID(id string) *Crop {
	for i := range catalog.Crops {
		if catalog.Crops[i].ID == id {
			return &catalog.Crops[i]
		}
	}
	return nil
}
func cloneState(s FarmState) FarmState {
	b, _ := json.Marshal(s)
	var out FarmState
	_ = json.Unmarshal(b, &out)
	return out
}
