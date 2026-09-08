package main

import (
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
	"strings"
	"unicode/utf8"
)

var xpThresholds = []int{0, 80, 220, 460, 800, 1250, 1850, 2650}

func makeSheep(breedID, name, sex string, at int64, adult bool) Sheep {
	s := Sheep{ID: newID(), Name: name, BreedID: breedID, Sex: sex, BornAt: at, AdultAt: at + 300000, Hunger: 85, Happiness: 80, Wool: 0, Position: Vec2{X: -8 + rand.Float64()*6, Z: rand.Float64() * 6}, Trait: catalog.Traits[rand.IntN(len(catalog.Traits))]}
	if adult {
		s.BornAt = at - 600000
		s.AdultAt = at - 1
		s.Wool = 100
	}
	return s
}
func initialState(at int64) FarmState {
	s := FarmState{Version: 1, CreatedAt: at, UpdatedAt: at, Coins: 180, Level: 1,
		Inventory: map[string]int{"feed": 2}, Sheep: []Sheep{}, Plots: []Plot{}, Orders: []Order{}, Discoveries: []string{},
		Regions: []string{"home"}, Grazing: GrazingState{RegionID: "home"}, ForageNodes: []ForageNode{},
		Day: 1, DayProgress: 1.0 / 3, Season: "春日", Weather: "sunny", ClockSeconds: 240}
	for _, node := range worldMap.Forest.ForageNodes {
		s.ForageNodes = append(s.ForageNodes, ForageNode{ID: node.ID, RegionID: "forest", ItemID: node.ItemID, Position: node.Position})
	}
	return s
}
func makeGarden() []Plot {
	plots := make([]Plot, 0, 6)
	for i := 0; i < 6; i++ {
		plots = append(plots, Plot{ID: fmt.Sprintf("plot-%d", i+1), Position: Vec2{X: 3 + float64(i%3)*1.7, Z: -3 + float64(i/3)*1.7}})
	}
	return plots
}
func tick(s *FarmState, at int64, active bool) {
	dt := clamp(float64(at-s.UpdatedAt)/1000, 0, 10)
	s.UpdatedAt = at
	if active {
		s.ClockSeconds += dt
		oldDay := s.Day
		s.Day = int(s.ClockSeconds/720) + 1
		s.DayProgress = float64(int64(s.ClockSeconds*1000)%720000) / 720000
		s.Season = []string{"春日", "夏日", "秋日", "冬日"}[((s.Day-1)/7)%4]
		if s.Day != oldDay {
			if s.Day%4 == 0 {
				s.Weather = "rain"
			} else {
				s.Weather = "sunny"
			}
			for i := range s.Orders {
				if s.Orders[i].Completed {
					s.Orders[i] = newOrder(s)
				}
			}
		}
		for i := range s.Sheep {
			sh := &s.Sheep[i]
			sh.Hunger = clamp(sh.Hunger-dt*.025, 10, 100)
			sh.Happiness = clamp(sh.Happiness-dt*.008, 30, 100)
			if sh.AdultAt <= at {
				rate := .5
				if sh.BreedID == "cloud" {
					rate *= 1.1
				}
				if sh.Hunger < 25 {
					rate *= .4
				}
				if sh.BreedID == "moon" && (s.DayProgress < .24 || s.DayProgress > .78) {
					rate *= 1.2
				}
				sh.Wool = clamp(sh.Wool+dt*rate, 0, 100)
			}
		}
	}
	if s.Weather == "rain" {
		for i := range s.Plots {
			p := &s.Plots[i]
			if p.CropID != nil && p.WateredAt == 0 {
				waterPlot(s, p, at)
			}
		}
	}
}
func addXP(s *FarmState, n int) {
	s.XP += n
	for i, t := range xpThresholds {
		if s.XP >= t {
			s.Level = i + 1
		}
	}
}
func capacity(s *FarmState) int { return []int{8, 14, 24}[s.Upgrades.Pasture] }
func sheepByID(s *FarmState, id string) *Sheep {
	for i := range s.Sheep {
		if s.Sheep[i].ID == id {
			return &s.Sheep[i]
		}
	}
	return nil
}
func plotByID(s *FarmState, id string) *Plot {
	for i := range s.Plots {
		if s.Plots[i].ID == id {
			return &s.Plots[i]
		}
	}
	return nil
}
func itemPrice(id string, buy bool) int {
	if !buy {
		if id == "mushroom" {
			return 12
		}
		if id == "herb" {
			return 16
		}
	}
	if id == "feed" {
		if buy {
			return 5
		}
		return 0
	}
	if strings.HasPrefix(id, "seed_") {
		if c := cropByID(strings.TrimPrefix(id, "seed_")); c != nil && buy {
			return c.SeedPrice
		}
		return 0
	}
	if strings.HasPrefix(id, "wool_") {
		if b := breedByID(strings.TrimPrefix(id, "wool_")); b != nil && !buy {
			return b.WoolValue
		}
		return 0
	}
	if c := cropByID(id); c != nil && !buy {
		return c.SellPrice
	}
	return 0
}
func discover(s *FarmState, id string) bool {
	if slices.Contains(s.Discoveries, id) {
		return false
	}
	s.Discoveries = append(s.Discoveries, id)
	addXP(s, 35)
	return true
}
func randomBreed(s *FarmState) string {
	n := rand.IntN(1000)
	tier := "common"
	if n < 10 && s.Level >= 5 && slices.Contains(s.Regions, "highland") {
		tier = "legendary"
	} else if n < 80 && slices.Contains(s.Regions, "highland") {
		tier = "epic"
	} else if n < 280 && slices.Contains(s.Regions, "forest") {
		tier = "rare"
	} else if n < 600 {
		tier = "uncommon"
	}
	ids := []string{}
	for _, b := range catalog.Breeds {
		if b.Rarity == tier {
			ids = append(ids, b.ID)
		}
	}
	return ids[rand.IntN(len(ids))]
}
func waterPlot(s *FarmState, p *Plot, at int64) {
	if p.CropID == nil || p.WateredAt > 0 {
		return
	}
	p.WateredAt = at
	c := cropByID(*p.CropID)
	p.ReadyAt = at + int64(float64(c.GrowSeconds)*1000*(1-float64(s.Upgrades.Watering)*.1))
}
func newOrder(s *FarmState) Order {
	ids := []string{}
	for _, crop := range catalog.Crops {
		if cropUnlocked(s, crop.ID) {
			ids = append(ids, crop.ID)
		}
	}
	for _, b := range s.Discoveries {
		ids = append(ids, "wool_"+b)
	}
	id := ids[rand.IntN(len(ids))]
	n := 2 + rand.IntN(3)
	return Order{ID: newID(), Title: []string{"村口集市的订单", "邻居的小小心愿", "小镇庆典的准备", "邮差带来的约定"}[rand.IntN(4)], ItemID: id, Quantity: n, Reward: int(float64(itemPrice(id, false)*n)*1.4) + 5, XP: 20 + n*5}
}

func applyAction(s *FarmState, a Action, at int64) (string, error) {
	fail := func(msg string) (string, error) { return "", errors.New(msg) }
	if err := checkProgression(s, a); err != nil {
		return "", err
	}
	var message string
	switch a.Type {
	case "build", "startGraze", "waterFlock", "finishGraze", "unlockRegion", "forage", "rehome", "stargaze":
		var err error
		message, err = applyProgressionAction(s, a, at)
		if err != nil {
			return "", err
		}
	case "pet", "feed", "shear", "rename", "breed":
		sh := sheepByID(s, a.SheepID)
		if sh == nil {
			return fail("没有找到这只小羊")
		}
		switch a.Type {
		case "pet":
			if at-sh.PetAt < 15000 {
				return fail("小羊正享受你的摸摸，稍等一会儿再来吧")
			}
			sh.PetAt = at
			sh.Happiness = clamp(sh.Happiness+15, 0, 100)
			addXP(s, 3)
			message = sh.Name + "开心地蹭了蹭你 ♡"
		case "feed":
			if sh.Hunger > 95 {
				return fail("小羊已经吃得饱饱的啦")
			}
			food := ""
			for _, id := range []string{"feed", "clover", "carrot"} {
				if s.Inventory[id] > 0 {
					food = id
					break
				}
			}
			if food == "" {
				return fail("饲料用完啦，也可以种一些三叶草或胡萝卜")
			}
			s.Inventory[food]--
			sh.Hunger = clamp(sh.Hunger+35, 0, 100)
			sh.Happiness = clamp(sh.Happiness+8, 0, 100)
			addXP(s, 2)
			message = sh.Name + "吃得香喷喷，心情也变好了"
		case "shear":
			if at < sh.AdultAt {
				return fail("小羊还在长身体，长大后再剪毛吧")
			}
			if sh.Wool < 100 {
				return fail("绒毛还没有长好，再耐心等一等")
			}
			n := 2
			if sh.Happiness >= 90 {
				n = 3
			}
			s.Inventory["wool_"+sh.BreedID] += n
			s.Stats.WoolCollected += n
			sh.Wool = 0
			addXP(s, 8)
			message = fmt.Sprintf("收获 %d 团%s绒毛，清清爽爽！", n, breedByID(sh.BreedID).Name)
		case "rename":
			name := strings.TrimSpace(a.Name)
			if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 16 {
				return fail("给小羊取一个 1–16 字的名字吧")
			}
			sh.Name = name
			message = "以后就叫你" + name + "啦"
		case "breed":
			p := sheepByID(s, a.PartnerID)
			if p == nil || p.ID == sh.ID {
				return fail("请选择两只不同的小羊")
			}
			if sh.Sex == p.Sex {
				return fail("需要一只羊妈妈和一只羊爸爸")
			}
			if at < sh.AdultAt || at < p.AdultAt {
				return fail("小羊长大后才能拥有自己的宝宝")
			}
			if sh.Hunger < 55 || p.Hunger < 55 || sh.Happiness < 65 || p.Happiness < 65 {
				return fail("先照顾好它们：饱腹至少 55，心情至少 65")
			}
			if (sh.LastBredAt > 0 && at-sh.LastBredAt < 360000) || (p.LastBredAt > 0 && at-p.LastBredAt < 360000) {
				return fail("羊爸妈还需要休息一下，六分钟后再来吧")
			}
			if len(s.Sheep) >= capacity(s) {
				return fail("牧场住满啦，先扩建牧场吧")
			}
			if s.Coins < 45 {
				return fail("爱心点心需要 45 金币")
			}
			s.Coins -= 45
			sh.LastBredAt = at
			p.LastBredAt = at
			id := sh.BreedID
			if rand.IntN(2) == 0 {
				id = p.BreedID
			}
			if rand.IntN(100) < 35 {
				id = randomBreed(s)
			}
			sex := "female"
			if rand.IntN(2) == 0 {
				sex = "male"
			}
			child := makeSheep(id, "小"+breedByID(id).Name, sex, at, false)
			s.Sheep = append(s.Sheep, child)
			s.Stats.Births++
			addXP(s, 30)
			message = "新生命来啦！欢迎" + child.Name + " ♡"
			if discover(s, id) {
				message += " · 发现全新品种！"
			}
		}
	case "buy", "sell":
		if a.Quantity < 1 || a.Quantity > 99 {
			return fail("数量需要在 1–99 之间")
		}
		price := itemPrice(a.ItemID, a.Type == "buy")
		if price <= 0 {
			return fail("商店没有这件物品")
		}
		total := price * a.Quantity
		if a.Type == "buy" {
			if s.Coins < total {
				return fail("金币不够啦，出售收获或完成订单赚一些吧")
			}
			s.Coins -= total
			s.Inventory[a.ItemID] += a.Quantity
			message = fmt.Sprintf("补给已放进背包 · −%d 金币", total)
		} else {
			if s.Inventory[a.ItemID] < a.Quantity {
				return fail("背包里的数量不够")
			}
			s.Inventory[a.ItemID] -= a.Quantity
			s.Coins += total
			message = fmt.Sprintf("收获卖出啦 · +%d 金币", total)
		}
	case "plant", "water", "harvest":
		p := plotByID(s, a.PlotID)
		if p == nil {
			return fail("没有找到这块田地")
		}
		switch a.Type {
		case "plant":
			if p.CropID != nil {
				return fail("这块地已经种着东西啦")
			}
			c := cropByID(a.CropID)
			if c == nil {
				return fail("还不认识这种种子")
			}
			if s.Inventory[c.SeedID] < 1 {
				return fail("种子用完啦，去小店补充一些吧")
			}
			s.Inventory[c.SeedID]--
			id := c.ID
			p.CropID = &id
			p.PlantedAt = at
			p.WateredAt = 0
			p.ReadyAt = 0
			if s.Weather == "rain" {
				waterPlot(s, p, at)
			}
			addXP(s, 2)
			message = c.Name + "种好啦，记得浇水哦"
		case "water":
			if p.CropID == nil {
				return fail("先种下种子再浇水吧")
			}
			if p.WateredAt > 0 {
				if s.Progression.Step == 7 {
					message = "雨水已经帮你浇好啦，等小苗长大就能收获了"
					break
				}
				return fail("土壤湿润，小苗正在好好长大")
			}
			waterPlot(s, p, at)
			if s.Upgrades.Watering >= 2 {
				for i := range s.Plots {
					waterPlot(s, &s.Plots[i], at)
				}
			}
			addXP(s, 1)
			message = "咕噜咕噜，小苗喝饱水啦"
		case "harvest":
			if p.CropID == nil {
				return fail("这里还没有种下作物")
			}
			if p.WateredAt == 0 {
				return fail("小苗有点渴，先给它浇水吧")
			}
			if at < p.ReadyAt {
				return fail("作物还在生长，再等一小会儿吧")
			}
			c := cropByID(*p.CropID)
			s.Inventory[c.ID] += c.Yield
			s.Stats.Harvested += c.Yield
			addXP(s, c.XP)
			message = fmt.Sprintf("丰收啦！+%d %s", c.Yield, c.Name)
			p.CropID = nil
			p.PlantedAt = 0
			p.WateredAt = 0
			p.ReadyAt = 0
		}
	case "order":
		var o *Order
		for i := range s.Orders {
			if s.Orders[i].ID == a.OrderID {
				o = &s.Orders[i]
				break
			}
		}
		if o == nil {
			return fail("没有找到这份订单")
		}
		if o.Completed {
			return fail("这份订单已经送达啦")
		}
		if s.Inventory[o.ItemID] < o.Quantity {
			return fail("收获还不够，再照顾一下农场吧")
		}
		s.Inventory[o.ItemID] -= o.Quantity
		s.Coins += o.Reward
		addXP(s, o.XP)
		s.Stats.OrdersCompleted++
		message = fmt.Sprintf("心愿达成！+%d 金币 · +%d 经验", o.Reward, o.XP)
		*o = newOrder(s)
	case "upgrade":
		var level *int
		var prices []int
		switch a.UpgradeID {
		case "pasture":
			level = &s.Upgrades.Pasture
			prices = []int{260, 680}
		case "watering":
			level = &s.Upgrades.Watering
			prices = []int{180, 420}
		default:
			return fail("没有这项农场升级")
		}
		if *level >= len(prices) {
			return fail("已经升级到最好啦")
		}
		price := prices[*level]
		if s.Coins < price {
			return fail(fmt.Sprintf("这次升级需要 %d 金币", price))
		}
		s.Coins -= price
		*level++
		addXP(s, 35)
		if a.UpgradeID == "pasture" {
			message = fmt.Sprintf("牧场扩建完成！现在能住 %d 只小羊", capacity(s))
		} else {
			message = "灌溉升级完成！作物长得更快啦"
		}
	case "adopt":
		if len(s.Sheep) >= capacity(s) {
			return fail("牧场住满啦，先扩建牧场吧")
		}
		if s.Coins < 110 {
			return fail("领养一位新朋友需要 110 金币")
		}
		s.Coins -= 110
		id := randomBreed(s)
		sex := "female"
		if rand.IntN(2) == 0 {
			sex = "male"
		}
		if len(s.Sheep) == 0 {
			id, sex = "cloud", "female"
		}
		if len(s.Sheep) == 1 {
			if s.Stats.Births == 0 {
				id = "milktea"
			}
			sex = "male"
			if s.Sheep[0].Sex == "male" {
				sex = "female"
			}
		}
		name := breedByID(id).Name
		if s.Progression.Step == 1 {
			name = "棉花糖"
		}
		s.Sheep = append(s.Sheep, makeSheep(id, name, sex, at, true))
		addXP(s, 12)
		message = "欢迎新朋友：" + breedByID(id).Name
		if discover(s, id) {
			message += " · 图鉴点亮啦！"
		}
	default:
		return fail("不认识这个操作")
	}
	advanceProgression(s, a)
	s.Version++
	s.UpdatedAt = at
	return message, nil
}
