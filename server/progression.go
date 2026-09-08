package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"math"
	"slices"
	"strings"
)

//go:embed regions.json
var regionsJSON []byte

type Bounds struct {
	MinX float64 `json:"minX"`
	MaxX float64 `json:"maxX"`
	MinZ float64 `json:"minZ"`
	MaxZ float64 `json:"maxZ"`
}

func (b Bounds) contains(p Vec2) bool {
	return p.X >= b.MinX && p.X <= b.MaxX && p.Z >= b.MinZ && p.Z <= b.MaxZ
}

type Region struct {
	ViewPoint    Vec2         `json:"viewPoint"`
	ViewRadius   float64      `json:"viewRadius"`
	ID           string       `json:"id"`
	Bounds       Bounds       `json:"bounds"`
	ReturnPoint  Vec2         `json:"returnPoint"`
	ReturnRadius float64      `json:"returnRadius"`
	GrazePoint   Vec2         `json:"grazePoint"`
	GrazeRadius  float64      `json:"grazeRadius"`
	WaterPoint   Vec2         `json:"waterPoint"`
	WaterRadius  float64      `json:"waterRadius"`
	ForageRadius float64      `json:"forageRadius"`
	ForageNodes  []ForageNode `json:"forageNodes"`
}

var worldMap struct {
	Bounds   Bounds `json:"bounds"`
	Home     Region `json:"home"`
	Meadow   Region `json:"meadow"`
	Forest   Region `json:"forest"`
	Highland Region `json:"highland"`
}

func init() {
	if err := json.Unmarshal(regionsJSON, &worldMap); err != nil {
		panic(err)
	}
}

func cropUnlocked(s *FarmState, id string) bool {
	step, ok := map[string]int{"clover": 6, "carrot": 9, "wheat": 10, "daisy": 12, "lavender": 13, "pumpkin": 14, "moonflower": 15}[id]
	return ok && s.Progression.Step >= step
}

func checkProgression(s *FarmState, a Action) error {
	step, minimum := s.Progression.Step, 0
	switch a.Type {
	case "adopt":
		minimum = 1
		if !s.Buildings.Shelter || (len(s.Sheep) > 0 && step < 12) {
			return errors.New("先完成眼前的小目标，再迎接下一位朋友吧")
		}
	case "pet", "rename":
		minimum = 2
	case "feed":
		minimum = 3
	case "shear", "sell":
		minimum = 4
	case "buy":
		minimum = 3
		if a.ItemID != "feed" {
			crop := cropByID(strings.TrimPrefix(a.ItemID, "seed_"))
			if crop == nil || crop.SeedID != a.ItemID || !cropUnlocked(s, crop.ID) {
				return errors.New("这种种子会在之后的牧场旅程中解锁")
			}
		}
	case "plant":
		minimum = 6
		if !cropUnlocked(s, a.CropID) {
			return errors.New("这种作物还没有解锁，先种眼前的小苗吧")
		}
	case "water":
		minimum = 7
	case "harvest":
		minimum = 8
	case "order":
		minimum = 9
	case "startGraze":
		minimum = 10
	case "waterFlock", "finishGraze":
		minimum = 11
	case "breed", "rehome", "upgrade":
		minimum = 12
	case "forage":
		minimum = 13
	case "unlockRegion":
		minimum = 14
	case "stargaze":
		minimum = 15
	}
	if step < minimum {
		return errors.New("这个玩法还没有解锁，先完成当前的小目标吧")
	}
	return nil
}

func advanceProgression(s *FarmState, a Action) {
	completed := false
	switch s.Progression.Step {
	case 0:
		completed = a.Type == "build" && a.Facility == "shelter"
	case 1:
		completed = a.Type == "adopt"
	case 2:
		completed = a.Type == "pet"
	case 3:
		completed = a.Type == "feed"
	case 4:
		completed = a.Type == "shear"
	case 5:
		completed = a.Type == "build" && a.Facility == "garden"
	case 6:
		completed = a.Type == "plant"
	case 7:
		completed = a.Type == "water"
	case 8:
		completed = a.Type == "harvest"
	case 9:
		completed = a.Type == "order"
	case 10:
		completed = a.Type == "startGraze"
	case 11:
		completed = a.Type == "finishGraze"
	case 12:
		completed = a.Type == "breed"
	case 13:
		completed = s.Progression.ForestFinds >= 3
	case 14:
		completed = a.Type == "unlockRegion"
	}
	if !completed {
		return
	}
	s.Progression.Step++
	switch s.Progression.Step {
	case 9:
		s.Inventory["seed_carrot"] += 3
		s.Orders = []Order{{ID: newID(), Title: "邻居送来的第一份心愿", ItemID: "clover", Quantity: 3, Reward: 70, XP: 25}}
	case 10:
		s.Regions = append(s.Regions, "meadow")
	case 12:
		s.Inventory["seed_daisy"] += 2
	case 13:
		s.Regions = append(s.Regions, "forest")
	}
}

func near(position *Vec2, target Vec2, radius float64) bool {
	return position != nil && math.Hypot(position.X-target.X, position.Z-target.Z) <= radius
}

func applyProgressionAction(s *FarmState, a Action, at int64) (string, error) {
	fail := func(text string) (string, error) { return "", errors.New(text) }
	switch a.Type {
	case "build":
		switch a.Facility {
		case "shelter":
			if s.Buildings.Shelter || s.Progression.Step != 0 {
				return fail("小羊的家已经建好啦")
			}
			s.Buildings.Shelter = true
			addXP(s, 10)
			return "小羊的家建好啦！去迎接第一位朋友吧", nil
		case "garden":
			if s.Buildings.Garden || s.Progression.Step != 5 {
				return fail("先完成当前的小目标，再开垦菜园吧")
			}
			s.Buildings.Garden = true
			s.Plots = makeGarden()
			s.Inventory["seed_clover"] += 3
			addXP(s, 10)
			return "六块小田开垦好啦，三包三叶草种子已放入背包", nil
		default:
			return fail("没有这项建设")
		}
	case "startGraze":
		if !near(a.actorPosition, worldMap.Home.ReturnPoint, worldMap.Home.ReturnRadius) || a.actorID == "" {
			return fail("回到基地的集合点，再带羊群出发吧")
		}
		if len(s.Sheep) == 0 {
			return fail("先迎接一位小羊朋友吧")
		}
		if s.Grazing.Active {
			if a.leaderOnline {
				return fail("羊群已经在放牧旅途中了")
			}
			s.Grazing.LeaderID = &a.actorID
			return "你接过了牧羊铃，继续这次放牧吧", nil
		}
		s.Grazing = GrazingState{Active: true, LeaderID: &a.actorID, RegionID: "meadow", StartedAt: at, CompletedCount: s.Grazing.CompletedCount}
		return "羊群跟上来啦！带它们去铃兰花坡吃草吧", nil
	case "waterFlock", "finishGraze":
		if !s.Grazing.Active || s.Grazing.LeaderID == nil || *s.Grazing.LeaderID != a.actorID {
			return fail("由这次领队带羊群完成放牧吧")
		}
		if a.Type == "waterFlock" {
			if !near(a.actorPosition, worldMap.Meadow.WaterPoint, worldMap.Meadow.WaterRadius) {
				return fail("带羊群靠近花坡泉水，再让它们喝水吧")
			}
			if s.Grazing.Watered {
				return fail("羊群已经喝过清凉的泉水啦")
			}
			s.Grazing.Watered = true
			return "咕噜咕噜，羊群喝到了清凉的泉水", nil
		}
		if s.Grazing.GrazeSeconds < 20 || !s.Grazing.Watered {
			return fail("先在花坡吃草 20 秒，再带羊群到泉水喝水吧")
		}
		if !near(a.actorPosition, worldMap.Home.ReturnPoint, worldMap.Home.ReturnRadius) {
			return fail("把羊群带回基地集合点，才能完成这次放牧")
		}
		reward := 25
		if s.Grazing.CompletedCount == 0 {
			reward = 180
		}
		s.Coins += reward
		addXP(s, 50)
		for i := range s.Sheep {
			s.Sheep[i].Hunger = clamp(s.Sheep[i].Hunger+30, 0, 100)
			s.Sheep[i].Happiness = clamp(s.Sheep[i].Happiness+15, 0, 100)
		}
		s.Grazing.Active = false
		s.Grazing.LeaderID = nil
		s.Grazing.RegionID = "home"
		s.Grazing.CompletedCount++
		if reward == 180 {
			return "第一次放牧完成！+180 金币，迎接一位新朋友吧", nil
		}
		return "羊群平安回家，吃饱喝足！+25 金币", nil
	case "forage":
		if !slices.Contains(s.Regions, "forest") {
			return fail("蘑菇秘林还没有开放")
		}
		for i := range s.ForageNodes {
			node := &s.ForageNodes[i]
			if node.ID != a.NodeID {
				continue
			}
			if !near(a.actorPosition, node.Position, worldMap.Forest.ForageRadius) {
				return fail("走近这丛林间收获，再采集吧")
			}
			if at < node.ReadyAt {
				return fail("让森林休息一会儿，三分钟后会有新收获")
			}
			node.ReadyAt = at + 180000
			s.Inventory[node.ItemID]++
			if node.ItemID == "mushroom" {
				s.Progression.ForestFinds = min(3, s.Progression.ForestFinds+1)
			}
			addXP(s, 8)
			if node.ItemID == "mushroom" {
				return "发现一朵林间蘑菇！+1 蘑菇", nil
			}
			return "闻到了清新的香气！+1 香草", nil
		}
		return fail("没有找到这丛林间收获")
	case "unlockRegion":
		if a.RegionID != "highland" || slices.Contains(s.Regions, "highland") {
			return fail("没有可以修复的新栖息地")
		}
		if s.Level < 3 || s.Coins < 120 || s.Inventory["mushroom"] < 3 || s.Inventory["carrot"] < 3 {
			return fail("修复高地需要牧场 3 级、120 金币、3 朵蘑菇和 3 根胡萝卜")
		}
		s.Coins -= 120
		s.Inventory["mushroom"] -= 3
		s.Inventory["carrot"] -= 3
		s.Regions = append(s.Regions, "highland")
		addXP(s, 50)
		return "星落高地重新开放了！新的梦幻品种正在等你", nil
	case "stargaze":
		if !slices.Contains(s.Regions, "highland") || !near(a.actorPosition, worldMap.Highland.ViewPoint, worldMap.Highland.ViewRadius) {
			return fail("走到星落高地的观星台，再抬头看看夜空吧")
		}
		if s.DayProgress >= .24 && s.DayProgress <= .78 {
			return fail("星星还没亮起来，夜晚再来观星台吧")
		}
		if s.Progression.LastStargazeDay == s.Day {
			return fail("今晚的星光已经收进背包啦，明天再来吧")
		}
		s.Progression.LastStargazeDay = s.Day
		s.Inventory["seed_moonflower"]++
		s.Coins += 15
		addXP(s, 15)
		return "收下今晚的星光！+1 月光花种子 · +15 金币 · +15 经验", nil
	case "rehome":
		if len(s.Sheep) <= 1 {
			return fail("牧场至少要留下一位小羊朋友哦")
		}
		for i, sh := range s.Sheep {
			if sh.ID == a.SheepID {
				s.Sheep = slices.Delete(s.Sheep, i, i+1)
				return sh.Name + "搬去了邻居的牧场，图鉴会记住它", nil
			}
		}
		return fail("没有找到这只小羊")
	}
	return fail("不认识这个操作")
}

func allowedPosition(s *FarmState, proposed, previous Vec2) Vec2 {
	bounds := worldMap.Bounds
	proposed = Vec2{clamp(proposed.X, bounds.MinX, bounds.MaxX), clamp(proposed.Z, bounds.MinZ, bounds.MaxZ)}
	for _, region := range []Region{worldMap.Meadow, worldMap.Forest, worldMap.Highland} {
		if region.Bounds.contains(proposed) && !slices.Contains(s.Regions, region.ID) {
			return previous
		}
	}
	return proposed
}

// Called under the room lock, including before presence positions change.
func (rr *RuntimeRoom) tick(at int64) {
	s := &rr.record.State
	dt := clamp(float64(at-s.UpdatedAt)/1000, 0, 10)
	if s.Grazing.Active && s.Grazing.LeaderID != nil {
		if position := rr.playerPosition(*s.Grazing.LeaderID); near(position, worldMap.Meadow.GrazePoint, worldMap.Meadow.GrazeRadius) {
			s.Grazing.GrazeSeconds = math.Min(20, s.Grazing.GrazeSeconds+dt)
		}
	}
	tick(s, at, len(rr.clients) > 0)
}

func (rr *RuntimeRoom) playerPosition(userID string) *Vec2 {
	for c := range rr.clients {
		if c.user.ID == userID {
			position := c.player.Position
			return &position
		}
	}
	return nil
}
